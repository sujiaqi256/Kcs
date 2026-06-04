"""
教务系统登录验证 + 自动同步课表 API
部署到阿里云服务器，供前端调用验证学号密码
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
import re
import os
import uuid
import time
import json
import secrets
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client
from bs4 import BeautifulSoup
from cryptography.fernet import Fernet

load_dotenv()

app = Flask(__name__)

# --- CORS: 只允许配置的域名 ---
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:4173"]
    print("WARNING: ALLOWED_ORIGINS 未配置，使用默认值")
CORS(app, origins=ALLOWED_ORIGINS)

# --- 速率限制 ---
rate_limit_cache = defaultdict(list)
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10

def check_rate_limit(ip):
    now = time.time()
    rate_limit_cache[ip] = [t for t in rate_limit_cache[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(rate_limit_cache[ip]) >= RATE_LIMIT_MAX:
        return False
    rate_limit_cache[ip].append(now)
    return True

# --- Supabase: 后端用 service_role key（有完整读写权限） ---
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("VITE_SUPABASE_KEY"))
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Cookie 加密 ---
COOKIE_ENC_KEY = os.getenv("COOKIE_ENC_KEY", "")
if not COOKIE_ENC_KEY:
    COOKIE_ENC_KEY = Fernet.generate_key().decode()
    print(f"WARNING: COOKIE_ENC_KEY 未配置，生成临时密钥: {COOKIE_ENC_KEY}")
    print("  生产环境请在 .env 中设置 COOKIE_ENC_KEY 并持久化")
_fernet = Fernet(COOKIE_ENC_KEY.encode() if isinstance(COOKIE_ENC_KEY, str) else COOKIE_ENC_KEY)

BASE_URL = "https://jw.educationgroup.cn/gzasc_jsxsd"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

def do_login(student_id, password):
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        session.get("https://jw.educationgroup.cn/gzasc_jsxsd/", timeout=10)
    except Exception:
        pass
    captcha_text = ""
    ocr = None
    try:
        import ddddocr
        ocr = ddddocr.DdddOcr(show_ad=False)
        # 加时间戳防止缓存旧验证码图片
        ts = int(time.time() * 1000)
        resp = session.get(f"{BASE_URL}/verifycode.servlet?t={ts}", timeout=5)
        captcha_text = ocr.classification(resp.content).strip()
    except Exception:
        pass
    encoded = base64.b64encode(student_id.encode()).decode() + "%%%" + base64.b64encode(password.encode()).decode()
    data = {"userAccount": student_id, "userPassword": "", "RANDOMCODE": captcha_text, "encoded": encoded}
    try:
        resp = session.post(f"{BASE_URL}/xk/LoginToXk", data=data, allow_redirects=True, timeout=10)
        if "xsMain" in resp.url or "教学一体化" in resp.text:
            return session
        if "验证码" in resp.text:
            try:
                ts = int(time.time() * 1000)
                resp2 = session.get(f"{BASE_URL}/verifycode.servlet?t={ts}", timeout=5)
                captcha_text = ocr.classification(resp2.content).strip() if ocr else ""
            except Exception:
                return None
            data["RANDOMCODE"] = captcha_text
            resp = session.post(f"{BASE_URL}/xk/LoginToXk", data=data, allow_redirects=True, timeout=10)
            if "xsMain" in resp.url or "教学一体化" in resp.text:
                return session
    except Exception:
        pass
    return None

COOKIE_MAX_AGE_MINUTES = 25
CN_TZ = timezone(timedelta(hours=8))

def _cn_now():
    """返回当前中国时间（朴素时间，无时区）"""
    return datetime.now(CN_TZ).replace(tzinfo=None)

def _parse_ts(s):
    """解析时间戳，返回朴素时间（直接当作中国时间）"""
    if isinstance(s, datetime):
        dt = s
    else:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    # Supabase 会把带时区的时间转成 UTC 存储，但实际用户输入的是中国时间
    # 直接取年月日时分秒，不转换时区
    return dt.replace(tzinfo=None)

def get_or_create_session(student_id):
    try:
        result = supabase.table("users").select("jw_session_cookies, jw_cookies_updated_at").eq("student_id", student_id).execute()
        if not result.data:
            return None
        user = result.data[0]
        saved_cookies = user.get("jw_session_cookies")
        updated_at = user.get("jw_cookies_updated_at")
        if not saved_cookies or not updated_at:
            return None
        updated_at = _parse_ts(updated_at)
        now = _cn_now()
        if now - updated_at > timedelta(minutes=COOKIE_MAX_AGE_MINUTES):
            return None
        # 解密 cookies
        if isinstance(saved_cookies, str):
            try:
                saved_cookies = json.loads(_fernet.decrypt(saved_cookies.encode()).decode())
            except Exception:
                return None
        session = requests.Session()
        session.headers.update(HEADERS)
        session.cookies.update(saved_cookies)
        resp = session.get(f"{BASE_URL}/framework/xsMain.jsp", timeout=5)
        if "教学一体化" in resp.text or "退出" in resp.text:
            return session
    except Exception:
        pass
    return None

def save_session_cookies(student_id, session):
    try:
        cookies_dict = session.cookies.get_dict()
        # 加密后存储
        encrypted = _fernet.encrypt(json.dumps(cookies_dict).encode()).decode()
        supabase.table("users").update({
            "jw_session_cookies": encrypted,
            "jw_cookies_updated_at": _cn_now().isoformat()
        }).eq("student_id", student_id).execute()
    except Exception:
        pass

def _clean_weeks(raw):
    if not raw:
        return ""
    s = re.sub(r'\[.*?\]', '', raw)
    s = re.sub(r'[第周\(\)（）\s]', '', s)
    segments = re.findall(r'\d+-\d+|\d+', s)
    return ",".join(segments)

def _parse_cell_courses(cell_text):
    parts = cell_text.split("\n\n")
    full_part = parts[-1] if len(parts) > 1 else parts[0]
    blocks = re.split(r'[-—]{3,}', full_part)
    result = []
    for block in blocks:
        lines = []
        for l in block.split("\n"):
            l = l.strip().replace("\xa0", "").replace("&nbsp;", "").replace("&nbsp", "").replace("nbsp;", "").replace("nbsp", "")
            if l and l not in ["P", "&nbspP", "nbspP"]:
                lines.append(l)
        if not lines:
            continue
        name = teacher = room = weeks_raw = ""
        for line in lines:
            if re.fullmatch(r'[-—=]+', line):
                continue
            if "周" in line:
                weeks_raw = line
            elif re.search(r'(J|S|A|B|C|D)\d|实验|机房|楼|致用', line):
                room = line
            elif re.match(r'^[一-龥]{2,5}$', line):
                if not name:
                    name = line
                elif not teacher:
                    teacher = line
            else:
                if len(line) >= 2 and "----" not in line:
                    if len(line) > len(name):
                        if name and re.match(r'^[一-龥]{2,5}$', name):
                            teacher = name
                        name = line
        weeks_clean = _clean_weeks(weeks_raw)
        if name and len(name) >= 2:
            result.append({"name": name, "teacher": teacher, "room": room, "weeks": weeks_clean})
    return result

def fetch_courses(session):
    courses = []
    url = f"{BASE_URL}/xskb/xskb_list.do"
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code != 200:
            return courses
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        table = soup.find("table", {"id": "kbtable"})
        if not table:
            return courses
        rows = table.find_all("tr")
        row_node = {1: "1-2", 2: "3-4", 3: "5-6", 4: "7-8", 5: "9-11"}
        for ri, row in enumerate(rows):
            if ri not in row_node:
                continue
            node = row_node[ri]
            cells = row.find_all(["td", "th"])
            for ci in range(1, min(8, len(cells))):
                cell = cells[ci]
                text = cell.get_text("\n").strip()
                if not text or len(text) <= 2:
                    continue
                cell_courses = _parse_cell_courses(text)
                for c in cell_courses:
                    courses.append({"name": c["name"], "teacher": c["teacher"], "room": c["room"], "day": ci, "node": node, "weeks": c["weeks"]})
    except Exception:
        pass
    return courses

def save_courses_to_supabase(student_id, courses):
    if not courses:
        return
    try:
        supabase.table("schedule").delete().eq("student_id", student_id).execute()
    except Exception:
        pass
    for c in courses:
        try:
            supabase.table("schedule").insert({"name": c["name"], "teacher": c.get("teacher", ""), "room": c.get("room", ""), "day": c["day"], "node": c.get("node", ""), "weeks": c.get("weeks", ""), "student_id": student_id}).execute()
        except Exception:
            pass

def fetch_grades(session):
    from bs4 import BeautifulSoup
    grades = []
    grade_url = f"{BASE_URL}/kbcx/kbxx_cxXsgrcj.do"
    referer_headers = {
        "Referer": f"{BASE_URL}/framework/xsMain.jsp",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
    }
    try:
        session.headers.update(referer_headers)
        resp = session.get(grade_url, timeout=15)
        if resp.status_code != 200:
            return grades
        soup = BeautifulSoup(resp.text, "html.parser")
        iframes = soup.find_all("iframe")
        if iframes:
            for iframe in iframes:
                src = iframe.get("src", "")
                if src:
                    iframe_url = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"
                    resp2 = session.get(iframe_url, timeout=15)
                    soup = BeautifulSoup(resp2.text, "html.parser")
                    break
        table = soup.find("table", {"id": "dataList"})
        if not table:
            tables = soup.find_all("table")
            for t in tables:
                rows = t.find_all("tr")
                if len(rows) > 5:
                    table = t
                    break
        if not table:
            return grades
        rows = table.find_all("tr")
        for row in rows[1:]:
            cells = row.find_all("td")
            if len(cells) < 6:
                continue
            texts = [c.get_text(strip=True) for c in cells]
            term = texts[1] if len(texts) > 1 else ""
            name = texts[3] if len(texts) > 3 else ""
            score = texts[5] if len(texts) > 5 else ""
            credit = texts[7] if len(texts) > 7 else ""
            gpa = texts[9] if len(texts) > 9 else ""
            if name and score and re.match(r'^\d+\.?\d*$', score):
                grades.append({"name": name, "score": score, "credit": credit, "gpa": gpa, "term": term})
    except Exception:
        pass
    return grades

def save_grades_to_supabase(student_id, grades):
    if not grades:
        return
    try:
        supabase.table("grades").delete().eq("student_id", student_id).execute()
    except Exception:
        pass
    for g in grades:
        try:
            supabase.table("grades").insert({"name": g["name"], "score": str(g.get("score", "")), "credit": str(g.get("credit", "")), "gpa": str(g.get("gpa", "")), "term": g.get("term", ""), "student_id": student_id}).execute()
        except Exception:
            pass

def supabase_auth_login(student_id, password):
    email = f"{student_id}@zqu.edu.cn"
    try:
        result = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return result.session.access_token, result.user.id, result.session.refresh_token
    except Exception:
        try:
            result = supabase.auth.sign_up({"email": email, "password": password})
            if result.session:
                return result.session.access_token, result.user.id, result.session.refresh_token
            return None, None, None
        except Exception:
            return None, None, None

@app.route("/api/login", methods=["POST"])
def login():
    client_ip = request.remote_addr
    if not check_rate_limit(client_ip):
        return jsonify({"ok": False, "error": "请求过于频繁，请稍后再试"}), 429
    body = request.get_json()
    student_id = body.get("student_id", "").strip()
    password = body.get("password", "").strip()
    if not student_id or not password:
        return jsonify({"ok": False, "error": "请输入学号和密码"}), 400
    if not re.match(r'^\d{10,12}$', student_id):
        return jsonify({"ok": False, "error": "学号格式不正确"}), 400
    if len(password) < 6 or len(password) > 50:
        return jsonify({"ok": False, "error": "密码长度应在 6-50 位之间"}), 400

    session = do_login(student_id, password)
    if not session:
        return jsonify({"ok": False, "error": "学号或密码错误"}), 401

    save_session_cookies(student_id, session)

    courses = fetch_courses(session)
    if courses:
        save_courses_to_supabase(student_id, courses)

    grades = fetch_grades(session)
    if grades:
        save_grades_to_supabase(student_id, grades)

    auth_token, auth_user_id, refresh_token = supabase_auth_login(student_id, password)
    token = str(uuid.uuid4())
    existing = supabase.table("users").select("*").eq("student_id", student_id).execute()
    if existing.data:
        user = existing.data[0]
        update_data = {"token": token}
        if auth_user_id:
            update_data["auth_user_id"] = auth_user_id
        supabase.table("users").update(update_data).eq("id", user["id"]).execute()
        user_id = user["id"]
        nickname = user.get("nickname")
        avatar = user.get("avatar")
    else:
        insert_data = {"student_id": student_id, "token": token, "nickname": f"同学{student_id[-4:]}", "avatar": "🦊", "nickname_change_count": 0, "is_banned": False}
        if auth_user_id:
            insert_data["auth_user_id"] = auth_user_id
        result = supabase.table("users").insert(insert_data).execute()
        user = result.data[0]
        user_id = user["id"]
        nickname = user["nickname"]
        avatar = user["avatar"]
    return jsonify({"ok": True, "user_id": user_id, "student_id": student_id, "nickname": nickname, "avatar": avatar, "token": token, "auth_token": auth_token, "refresh_token": refresh_token, "courses_synced": len(courses)})

@app.route("/api/user", methods=["GET"])
def get_user():
    client_ip = request.remote_addr
    if not check_rate_limit(client_ip):
        return jsonify({"ok": False, "error": "请求过于频繁"}), 429
    token = request.args.get("token", "")
    if not token:
        return jsonify({"ok": False, "error": "缺少 token"}), 400
    if not re.match(r'^[0-9a-f-]{36}$', token):
        return jsonify({"ok": False, "error": "token 格式不正确"}), 400
    result = supabase.table("users").select("*").eq("token", token).execute()
    if not result.data:
        return jsonify({"ok": False, "error": "token 无效"}), 404
    user = result.data[0]
    if user.get("is_banned"):
        return jsonify({"ok": False, "error": "账号已被禁言", "banned_reason": user.get("banned_reason", "")}), 403
    return jsonify({"ok": True, "user": {"id": user["id"], "student_id": user["student_id"], "nickname": user.get("nickname"), "avatar": user.get("avatar"), "nickname_change_count": user.get("nickname_change_count", 0), "nickname_changed_at": user.get("nickname_changed_at"), "is_banned": user.get("is_banned", False)}})

def _validate_token_get_student_id(token):
    if not token or not re.match(r'^[0-9a-f-]{36}$', token):
        return None
    result = supabase.table("users").select("student_id").eq("token", token).execute()
    if result.data:
        return result.data[0].get("student_id")
    return None

@app.route("/api/available-courses", methods=["POST"])
def available_courses():
    client_ip = request.remote_addr
    if not check_rate_limit(client_ip):
        return jsonify({"ok": False, "error": "请求过于频繁，请稍后再试"}), 429
    body = request.get_json()
    token = body.get("token", "")
    course_type = body.get("course_type", "gx")
    keyword = body.get("keyword", "")
    student_id = _validate_token_get_student_id(token)
    if not student_id:
        return jsonify({"ok": False, "error": "未登录，请先登录"}), 401
    session = get_or_create_session(student_id)
    if not session:
        return jsonify({"ok": False, "error": "教务系统会话已过期，请重新登录"}), 401
    endpoint_map = {"gx": "xsxkkc/gxkcxkOper", "bx": "xsxkkc/bxkcxkOper"}
    url = f"{BASE_URL}/{endpoint_map.get(course_type, 'xsxkkc/gxkcxkOper')}"
    try:
        resp = session.post(url, data={"kcxx": keyword}, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
        courses = []
        for row in soup.find_all("tr")[1:]:
            cells = row.find_all("td")
            if len(cells) < 4:
                continue
            course_id = ""
            btn = row.find("input", {"type": "button"})
            if btn:
                m = re.search(r"jx0404id=([^&'\"]+)", btn.get("onclick", ""))
                if m:
                    course_id = m.group(1)
            courses.append({
                "id": course_id,
                "name": cells[1].get_text().strip() if len(cells) > 1 else "",
                "teacher": cells[3].get_text().strip() if len(cells) > 3 else "",
                "credit": cells[2].get_text().strip() if len(cells) > 2 else "",
                "hours": cells[4].get_text().strip() if len(cells) > 4 else "",
                "capacity": cells[5].get_text().strip() if len(cells) > 5 else "",
                "selected": cells[6].get_text().strip() if len(cells) > 6 else "",
                "remaining": cells[7].get_text().strip() if len(cells) > 7 else "",
            })
        save_session_cookies(student_id, session)
        return jsonify({"ok": True, "courses": courses})
    except Exception:
        return jsonify({"ok": False, "error": "获取课程列表失败"}), 500

@app.route("/api/select-course", methods=["POST"])
def select_course():
    client_ip = request.remote_addr
    if not check_rate_limit(client_ip):
        return jsonify({"ok": False, "error": "请求过于频繁，请稍后再试"}), 429
    body = request.get_json()
    token = body.get("token", "")
    course_id = body.get("course_id", "")
    course_type = body.get("course_type", "bx")
    if not course_id:
        return jsonify({"ok": False, "error": "缺少课程 ID"}), 400
    student_id = _validate_token_get_student_id(token)
    if not student_id:
        return jsonify({"ok": False, "error": "未登录，请先登录"}), 401
    session = get_or_create_session(student_id)
    if not session:
        return jsonify({"ok": False, "error": "教务系统会话已过期，请重新登录"}), 401
    endpoint_map = {"bx": "xsxkkc/bxxkOper", "gx": "xsxkkc/gxxkOper", "rx": "xsxkkc/xxxkOper"}
    url = f"{BASE_URL}/{endpoint_map.get(course_type, 'xsxkkc/bxxkOper')}"
    try:
        resp = session.get(url, params={"jx0404id": course_id, "xkzy": ""}, timeout=10)
        result_text = resp.text.strip()
        save_session_cookies(student_id, session)
        if "成功" in result_text or "success" in result_text.lower():
            return jsonify({"ok": True, "message": "选课成功"})
        elif "已选" in result_text or "重复" in result_text:
            return jsonify({"ok": True, "message": "该课程已选过", "already_selected": True})
        elif "未开放" in result_text or "时间" in result_text:
            return jsonify({"ok": False, "message": "选课尚未开放"})
        else:
            return jsonify({"ok": False, "message": result_text[:200] or "选课失败"})
    except Exception:
        return jsonify({"ok": False, "message": "选课请求失败"}), 500


# ═══════════════════════════════════════════════════════════════
# 选课系统 API（独立于教务系统，数据库课大作业用）
# ═══════════════════════════════════════════════════════════════

@app.route("/api/ss/courses", methods=["GET"])
def ss_courses():
    """查询可选课程 — 支持搜索、分院系筛选、分页"""
    keyword = request.args.get("keyword", "")
    department = request.args.get("department", "")
    page = max(1, int(request.args.get("page", 1)))
    size = min(50, max(1, int(request.args.get("size", 20))))
    offset = (page - 1) * size
    try:
        q = supabase.table("cs_courses").select("*", count="exact").eq("status", "active")
        if keyword:
            q = q.or_(f"name.ilike.%{keyword}%,teacher.ilike.%{keyword}%,course_code.ilike.%{keyword}%")
        if department:
            q = q.eq("department", department)
        result = q.order("id").range(offset, offset + size - 1).execute()
        courses = result.data or []
        total = result.count or 0
        depts = supabase.table("cs_courses").select("department").execute()
        departments = sorted(list(set(d["department"] for d in (depts.data or []) if d["department"])))
        return jsonify({"ok": True, "courses": courses, "total": total, "page": page, "size": size, "departments": departments})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/windows", methods=["GET"])
def ss_windows():
    """查询选课窗口 — 返回所有活跃窗口（含当前开放和即将开放）"""
    try:
        now = _cn_now()
        result = supabase.table("cs_time_windows").select("*").eq("is_active", True).order("start_time").execute()
        windows = []
        for w in (result.data or []):
            st = _parse_ts(w["start_time"])
            et = _parse_ts(w["end_time"])
            status = "closed"
            if st <= now <= et:
                status = "open"
            elif now < st:
                status = "upcoming"
            windows.append({**w, "status": status, "start_time": st.isoformat(), "end_time": et.isoformat()})
        return jsonify({"ok": True, "windows": windows})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/select", methods=["POST"])
def ss_select():
    """
    选课 — 包含完整校验：
    1. 检查选课窗口是否开放
    2. 检查课程是否已满
    3. 检查是否已选过该课程
    4. 检查是否超过最大选课数
    5. 检查时间冲突
    6. 原子操作：插入选课记录 + 更新已选人数
    """
    body = request.get_json()
    student_id = body.get("student_id", "")
    course_id = body.get("course_id")
    ip = request.remote_addr or ""
    if not student_id or not course_id:
        return jsonify({"ok": False, "result": "fail", "message": "参数不完整"}), 400
    try:
        # 1. 检查选课窗口
        windows = supabase.table("cs_time_windows").select("*").eq("is_active", True).execute()
        now = _cn_now()
        window_open = False
        next_window = None
        for w in (windows.data or []):
            st = _parse_ts(w["start_time"])
            et = _parse_ts(w["end_time"])
            if st <= now <= et:
                window_open = True
                break
            elif now < st and (next_window is None or st.isoformat() < next_window["start_time"]):
                next_window = {"name": w.get("name", ""), "start_time": st.isoformat(), "end_time": et.isoformat()}
        if not window_open:
            msg = "选课窗口未开放"
            if next_window:
                msg = f"选课即将开放：{next_window['name']}，开始时间 {next_window['start_time'][:16].replace('T',' ')}"
            supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "select", "result": "not_open", "message": msg, "ip_address": ip}).execute()
            return jsonify({"ok": False, "result": "not_open", "message": msg, "next_window": next_window})

        # 2. 检查课程是否存在且未满
        course = supabase.table("cs_courses").select("*").eq("id", course_id).execute()
        if not course.data:
            return jsonify({"ok": False, "result": "fail", "message": "课程不存在"})
        c = course.data[0]
        if c["selected"] >= c["max_capacity"]:
            supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "select", "result": "full", "message": "课程已满", "ip_address": ip}).execute()
            return jsonify({"ok": False, "result": "full", "message": "课程已满，已加入抢课队列"})

        # 3. 检查是否已选
        exist = supabase.table("cs_selections").select("id").eq("student_id", student_id).eq("course_id", course_id).eq("status", "selected").execute()
        if exist.data:
            return jsonify({"ok": False, "result": "already", "message": "你已选过该课程"})

        # 4. 检查最大选课数
        stu = supabase.table("cs_students").select("max_courses").eq("student_id", student_id).execute()
        max_c = stu.data[0]["max_courses"] if stu.data else 5
        my_count = supabase.table("cs_selections").select("id", count="exact").eq("student_id", student_id).eq("status", "selected").execute()
        if (my_count.count or 0) >= max_c:
            return jsonify({"ok": False, "result": "limit", "message": f"已达到最大选课数 {max_c} 门"})

        # 5. 检查时间冲突
        my_courses = supabase.table("cs_selections").select("course_id").eq("student_id", student_id).eq("status", "selected").execute()
        my_ids = [s["course_id"] for s in (my_courses.data or [])]
        if my_ids:
            existing = supabase.table("cs_courses").select("schedule").in_("id", my_ids).execute()
            new_schedule = c.get("schedule", "")
            for ec in (existing.data or []):
                old_schedule = ec.get("schedule", "")
                if new_schedule and old_schedule:
                    import re as _re
                    old_times = set(_re.findall(r'[周一二三四五六日]\d+-\d+节', old_schedule))
                    new_times = set(_re.findall(r'[周一二三四五六日]\d+-\d+节', new_schedule))
                    if old_times & new_times:
                        return jsonify({"ok": False, "result": "conflict", "message": f"与已选课程时间冲突"})

        # 6. 执行选课
        supabase.table("cs_selections").insert({"student_id": student_id, "course_id": course_id, "status": "selected"}).execute()
        supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "select", "result": "success", "message": "选课成功", "ip_address": ip}).execute()
        return jsonify({"ok": True, "result": "success", "message": f"选课成功：{c['name']}"})
    except Exception as e:
        return jsonify({"ok": False, "result": "fail", "message": f"选课异常: {str(e)}"}), 500

@app.route("/api/ss/drop", methods=["POST"])
def ss_drop():
    """退课"""
    body = request.get_json()
    student_id = body.get("student_id", "")
    course_id = body.get("course_id")
    if not student_id or not course_id:
        return jsonify({"ok": False, "message": "参数不完整"}), 400
    try:
        result = supabase.table("cs_selections").update({"status": "dropped", "dropped_at": datetime.now(timezone.utc).isoformat()}).eq("student_id", student_id).eq("course_id", course_id).eq("status", "selected").execute()
        if result.data:
            supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "drop", "result": "success", "message": "退课成功", "ip_address": request.remote_addr or ""}).execute()
            return jsonify({"ok": True, "message": "退课成功"})
        return jsonify({"ok": False, "message": "未找到选课记录"})
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500

@app.route("/api/ss/my-selections", methods=["GET"])
def ss_my_selections():
    """查询已选课程 — JOIN 查询课程详情"""
    student_id = request.args.get("student_id", "")
    if not student_id:
        return jsonify({"ok": False, "message": "缺少学号"}), 400
    try:
        sels = supabase.table("cs_selections").select("*").eq("student_id", student_id).eq("status", "selected").execute()
        if not sels.data:
            return jsonify({"ok": True, "courses": []})
        course_ids = [s["course_id"] for s in sels.data]
        courses = supabase.table("cs_courses").select("*").in_("id", course_ids).execute()
        course_map = {c["id"]: c for c in (courses.data or [])}
        result = []
        for s in sels.data:
            c = course_map.get(s["course_id"], {})
            result.append({**c, "selected_at": s.get("selected_at")})
        return jsonify({"ok": True, "courses": result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/logs", methods=["GET"])
def ss_logs():
    """查询选课日志 — 按时间倒序"""
    student_id = request.args.get("student_id", "")
    limit = min(100, int(request.args.get("limit", 50)))
    try:
        q = supabase.table("cs_selection_logs").select("*").order("created_at", desc=True).limit(limit)
        if student_id:
            q = q.eq("student_id", student_id)
        result = q.execute()
        return jsonify({"ok": True, "logs": result.data or []})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/stats", methods=["GET"])
def ss_stats():
    """选课统计 — 聚合查询"""
    try:
        total_courses = supabase.table("cs_courses").select("id", count="exact").eq("status", "active").execute()
        total_selected = supabase.table("cs_selections").select("id", count="exact").eq("status", "selected").execute()
        depts = supabase.table("cs_courses").select("department,selected,max_capacity").execute()
        dept_stats = {}
        for d in (depts.data or []):
            dept = d["department"]
            if dept not in dept_stats:
                dept_stats[dept] = {"department": dept, "total_selected": 0, "total_capacity": 0, "course_count": 0}
            dept_stats[dept]["total_selected"] += d["selected"]
            dept_stats[dept]["total_capacity"] += d["max_capacity"]
            dept_stats[dept]["course_count"] += 1
        top_courses = supabase.table("cs_courses").select("course_code,name,teacher,selected,max_capacity").order("selected", desc=True).limit(5).execute()
        full_courses = supabase.table("cs_courses").select("id", count="exact").execute()
        return jsonify({
            "ok": True,
            "total_courses": total_courses.count or 0,
            "total_selections": total_selected.count or 0,
            "department_stats": list(dept_stats.values()),
            "top_courses": top_courses.data or [],
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/auto-grab", methods=["POST"])
def ss_auto_grab():
    """
    自动抢课 — 前端轮询调用，每次检查并尝试选课
    返回当前课程状态，前端根据结果决定是否继续轮询
    """
    body = request.get_json()
    student_id = body.get("student_id", "")
    course_id = body.get("course_id")
    ip = request.remote_addr or ""
    if not student_id or not course_id:
        return jsonify({"ok": False, "message": "参数不完整"}), 400
    try:
        course = supabase.table("cs_courses").select("*").eq("id", course_id).execute()
        if not course.data:
            return jsonify({"ok": False, "message": "课程不存在", "continue": False})
        c = course.data[0]
        if c["selected"] >= c["max_capacity"]:
            supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "auto_grab", "result": "full", "message": f"课程已满 ({c['selected']}/{c['max_capacity']})", "ip_address": ip}).execute()
            return jsonify({"ok": False, "message": f"课程已满 ({c['selected']}/{c['max_capacity']})，继续抢课...", "continue": True, "capacity": {"selected": c["selected"], "max": c["max_capacity"]}})
        exist = supabase.table("cs_selections").select("id").eq("student_id", student_id).eq("course_id", course_id).eq("status", "selected").execute()
        if exist.data:
            return jsonify({"ok": True, "message": "你已选过该课程", "continue": False})
        supabase.table("cs_selections").insert({"student_id": student_id, "course_id": course_id, "status": "selected"}).execute()
        supabase.table("cs_selection_logs").insert({"student_id": student_id, "course_id": course_id, "action": "auto_grab", "result": "success", "message": "自动抢课成功", "ip_address": ip}).execute()
        return jsonify({"ok": True, "message": f"抢课成功：{c['name']}", "continue": False})
    except Exception as e:
        return jsonify({"ok": False, "message": str(e), "continue": True}), 500

@app.route("/api/ss/student-info", methods=["GET"])
def ss_student_info():
    """获取学生选课信息 — 已选数量/上限/已选课程时间"""
    student_id = request.args.get("student_id", "")
    if not student_id:
        return jsonify({"ok": False, "message": "缺少学号"}), 400
    try:
        stu = supabase.table("cs_students").select("*").eq("student_id", student_id).execute()
        if not stu.data:
            return jsonify({"ok": False, "message": "学生不存在"})
        s = stu.data[0]
        my_count = supabase.table("cs_selections").select("id", count="exact").eq("student_id", student_id).eq("status", "selected").execute()
        my_courses = supabase.table("cs_selections").select("course_id").eq("student_id", student_id).eq("status", "selected").execute()
        my_ids = [c["course_id"] for c in (my_courses.data or [])]
        schedules = []
        if my_ids:
            courses = supabase.table("cs_courses").select("id,schedule,name").in_("id", my_ids).execute()
            schedules = courses.data or []
        return jsonify({
            "ok": True,
            "student_id": student_id,
            "name": s.get("name", ""),
            "max_courses": s.get("max_courses", 5),
            "selected_count": my_count.count or 0,
            "selected_schedules": schedules,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/check-conflict", methods=["POST"])
def ss_check_conflict():
    """检查选课冲突 — 返回冲突详情"""
    body = request.get_json()
    student_id = body.get("student_id", "")
    course_id = body.get("course_id")
    if not student_id or not course_id:
        return jsonify({"ok": False, "message": "参数不完整"}), 400
    try:
        course = supabase.table("cs_courses").select("schedule,name").eq("id", course_id).execute()
        if not course.data:
            return jsonify({"ok": False, "message": "课程不存在"})
        new_schedule = course.data[0].get("schedule", "")
        my_courses = supabase.table("cs_selections").select("course_id").eq("student_id", student_id).eq("status", "selected").execute()
        my_ids = [c["course_id"] for c in (my_courses.data or [])]
        conflicts = []
        if my_ids and new_schedule:
            existing = supabase.table("cs_courses").select("id,schedule,name").in_("id", my_ids).execute()
            new_times = set(re.findall(r'[周一二三四五六日]\d+-\d+节', new_schedule))
            for ec in (existing.data or []):
                old_schedule = ec.get("schedule", "")
                if old_schedule:
                    old_times = set(re.findall(r'[周一二三四五六日]\d+-\d+节', old_schedule))
                    overlap = new_times & old_times
                    if overlap:
                        conflicts.append({"course_id": ec["id"], "name": ec["name"], "conflict_times": list(overlap)})
        return jsonify({"ok": True, "has_conflict": len(conflicts) > 0, "conflicts": conflicts})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════
# 管理接口 — 选课时间窗口管理
# ═══════════════════════════════════════════════════════════════

ADMIN_TOKEN = os.getenv("SS_ADMIN_TOKEN", "")
if not ADMIN_TOKEN:
    ADMIN_TOKEN = secrets.token_urlsafe(32)
    print(f"WARNING: SS_ADMIN_TOKEN 未配置，生成临时 token: {ADMIN_TOKEN}")
    print("  生产环境请在 .env 中设置 SS_ADMIN_TOKEN")

def _check_admin(request):
    token = request.headers.get("X-Admin-Token", "")
    return token == ADMIN_TOKEN

@app.route("/api/ss/admin/windows", methods=["GET"])
def ss_admin_list_windows():
    """列出所有选课窗口（含未激活的）"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        result = supabase.table("cs_time_windows").select("*").order("start_time").execute()
        windows = []
        for w in (result.data or []):
            st = _parse_ts(w["start_time"])
            et = _parse_ts(w["end_time"])
            now = _cn_now()
            if st <= now <= et:
                status = "open"
            elif now < st:
                status = "upcoming"
            else:
                status = "closed"
            windows.append({**w, "status": status})
        return jsonify({"ok": True, "windows": windows})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/window", methods=["POST"])
def ss_admin_set_window():
    """
    创建或更新选课窗口
    请求体: {name, start_time, end_time, course_type?, is_active?}
    start_time / end_time 格式: "2026-05-25 20:00:00" 或 ISO8601
    如果传 id 则更新已有窗口，否则创建新窗口
    """
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    body = request.get_json()
    name = body.get("name", "")
    start_time = body.get("start_time", "")
    end_time = body.get("end_time", "")
    if not name or not start_time or not end_time:
        return jsonify({"ok": False, "error": "缺少 name / start_time / end_time"}), 400
    # 统一转成 ISO 格式
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
        try:
            st = datetime.strptime(start_time, fmt)
            start_time = st.replace(tzinfo=timezone(timedelta(hours=8))).isoformat()
            break
        except ValueError:
            continue
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
        try:
            et = datetime.strptime(end_time, fmt)
            end_time = et.replace(tzinfo=timezone(timedelta(hours=8))).isoformat()
            break
        except ValueError:
            continue
    data = {
        "name": name,
        "start_time": start_time,
        "end_time": end_time,
        "course_type": body.get("course_type", "required"),
        "is_active": body.get("is_active", True),
    }
    try:
        win_id = body.get("id")
        if win_id:
            supabase.table("cs_time_windows").update(data).eq("id", win_id).execute()
            return jsonify({"ok": True, "message": f"窗口 {win_id} 已更新", "id": win_id})
        else:
            result = supabase.table("cs_time_windows").insert(data).execute()
            new_id = result.data[0]["id"] if result.data else None
            return jsonify({"ok": True, "message": "窗口已创建", "id": new_id})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/window/<int:win_id>", methods=["DELETE"])
def ss_admin_delete_window(win_id):
    """删除选课窗口"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        supabase.table("cs_time_windows").delete().eq("id", win_id).execute()
        return jsonify({"ok": True, "message": f"窗口 {win_id} 已删除"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/window/<int:win_id>/toggle", methods=["POST"])
def ss_admin_toggle_window(win_id):
    """启用/禁用选课窗口"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        result = supabase.table("cs_time_windows").select("is_active").eq("id", win_id).execute()
        if not result.data:
            return jsonify({"ok": False, "error": "窗口不存在"}), 404
        new_active = not result.data[0]["is_active"]
        supabase.table("cs_time_windows").update({"is_active": new_active}).eq("id", win_id).execute()
        return jsonify({"ok": True, "message": f"窗口 {win_id} 已{'启用' if new_active else '禁用'}", "is_active": new_active})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════
# 管理接口 — 课程管理
# ═══════════════════════════════════════════════════════════════

@app.route("/api/ss/admin/courses", methods=["GET"])
def ss_admin_list_courses():
    """列出所有课程"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        result = supabase.table("cs_courses").select("*").order("id").execute()
        return jsonify({"ok": True, "courses": result.data or []})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/course", methods=["POST"])
def ss_admin_set_course():
    """
    创建或更新课程
    传 id 则更新，否则创建
    """
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    body = request.get_json()
    required = ["course_code", "name", "teacher"]
    for f in required:
        if not body.get(f):
            return jsonify({"ok": False, "error": f"缺少 {f}"}), 400
    data = {
        "course_code": body["course_code"],
        "name": body["name"],
        "teacher": body["teacher"],
        "credit": float(body.get("credit", 3.0)),
        "hours": int(body.get("hours", 48)),
        "max_capacity": int(body.get("max_capacity", 60)),
        "selected": int(body.get("selected", 0)),
        "department": body.get("department", ""),
        "description": body.get("description", ""),
        "schedule": body.get("schedule", ""),
        "location": body.get("location", ""),
        "status": body.get("status", "active"),
    }
    try:
        cid = body.get("id")
        if cid:
            supabase.table("cs_courses").update(data).eq("id", cid).execute()
            return jsonify({"ok": True, "message": f"课程 {cid} 已更新"})
        else:
            result = supabase.table("cs_courses").insert(data).execute()
            new_id = result.data[0]["id"] if result.data else None
            return jsonify({"ok": True, "message": "课程已创建", "id": new_id})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/course/<int:cid>", methods=["DELETE"])
def ss_admin_delete_course(cid):
    """删除课程"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        supabase.table("cs_courses").delete().eq("id", cid).execute()
        return jsonify({"ok": True, "message": f"课程 {cid} 已删除"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/ss/admin/course/<int:cid>/toggle", methods=["POST"])
def ss_admin_toggle_course(cid):
    """启用/禁用课程（active/closed）"""
    if not _check_admin(request):
        return jsonify({"ok": False, "error": "无权限"}), 403
    try:
        result = supabase.table("cs_courses").select("status").eq("id", cid).execute()
        if not result.data:
            return jsonify({"ok": False, "error": "课程不存在"}), 404
        new_status = "closed" if result.data[0]["status"] == "active" else "active"
        supabase.table("cs_courses").update({"status": new_status}).eq("id", cid).execute()
        return jsonify({"ok": True, "message": f"课程已{'启用' if new_status=='active' else '禁用'}", "status": new_status})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/admin", methods=["GET"])
def ss_admin_page():
    """选课管理面板 — 浏览器打开即可操作"""
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>选课管理面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;max-width:700px;margin:0 auto}
h1{font-size:20px;margin-bottom:6px;color:#58a6ff}
h2{font-size:16px;margin:20px 0 10px;color:#e6edf3;border-bottom:1px solid #30363d;padding-bottom:6px}
.tabs{display:flex;gap:0;margin-bottom:16px}
.tab{flex:1;text-align:center;padding:10px;cursor:pointer;background:#161b22;border:1px solid #30363d;font-size:14px;font-weight:600}
.tab:first-child{border-radius:8px 0 0 8px}
.tab:last-child{border-radius:0 8px 8px 0}
.tab.active{background:#238636;color:#fff;border-color:#238636}
.panel{display:none}.panel.active{display:block}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:12px}
.label{color:#8b949e;font-size:12px;margin-bottom:4px}
input,select,textarea{width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:14px;margin-bottom:10px;font-family:inherit}
textarea{resize:vertical;min-height:60px}
button{padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
.btn-green{background:#238636;color:#fff}.btn-green:hover{background:#2ea043}
.btn-yellow{background:#9e6a03;color:#fff}
.btn-red{background:#da3633;color:#fff}
.btn-gray{background:#30363d;color:#e6edf3}
.item{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;margin-bottom:10px}
.item-title{font-weight:700;font-size:15px}
.item-sub{color:#8b949e;font-size:13px;margin-top:4px}
.tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-left:8px}
.tag-open{background:#238636;color:#fff}
.tag-upcoming{background:#9e6a03;color:#fff}
.tag-closed{background:#30363d;color:#8b949e}
.tag-off{background:#da3633;color:#fff}
.msg{padding:10px;border-radius:6px;margin-bottom:12px;font-size:13px;display:none}
.msg-ok{background:#23863622;color:#3fb950;border:1px solid #238636}
.msg-err{background:#da363322;color:#f85149;border:1px solid #da3633}
.row{display:flex;gap:8px}.row>div{flex:1}
.actions{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}
</style>
</head>
<body>
<h1>选课系统管理面板</h1>
<div id="msg" class="msg"></div>
<div class="tabs">
<div class="tab active" onclick="switchTab('windows')">时间窗口</div>
<div class="tab" onclick="switchTab('courses')">课程管理</div>
</div>

<!-- 时间窗口 -->
<div id="p-windows" class="panel active">
<div class="card">
<div class="label">窗口名称</div>
<input id="wName" placeholder="如：今晚抢课">
<div class="row">
<div><div class="label">开始时间</div><input id="wStart" type="datetime-local"></div>
<div><div class="label">结束时间</div><input id="wEnd" type="datetime-local"></div>
</div>
<button class="btn-green" onclick="createWindow()">创建窗口</button>
</div>
<div id="wList"></div>
</div>

<!-- 课程管理 -->
<div id="p-courses" class="panel">
<div class="card">
<div class="row">
<div><div class="label">课程编号</div><input id="cCode" placeholder="如 CS201"></div>
<div><div class="label">课程名称</div><input id="cName" placeholder="如 数据结构"></div>
</div>
<div class="row">
<div><div class="label">授课教师</div><input id="cTeacher" placeholder="如 张老师"></div>
<div><div class="label">学分</div><input id="cCredit" type="number" step="0.5" value="3"></div>
</div>
<div class="row">
<div><div class="label">学时</div><input id="cHours" type="number" value="48"></div>
<div><div class="label">最大容量</div><input id="cCap" type="number" value="60"></div>
</div>
<div class="row">
<div><div class="label">开课学院</div><input id="cDept" placeholder="如 计算机学院"></div>
<div><div class="label">上课时间</div><input id="cSched" placeholder="如 周一3-4节"></div>
</div>
<div class="label">上课地点</div>
<input id="cLoc" placeholder="如 致用楼301">
<div class="label">课程简介</div>
<textarea id="cDesc" placeholder="课程描述..."></textarea>
<input id="cEditId" type="hidden">
<button class="btn-green" onclick="saveCourse()">保存课程</button>
<button class="btn-yellow" onclick="randomFill()">随机生成</button>
<button class="btn-gray" onclick="cancelEdit()" style="display:none" id="cancelBtn">取消编辑</button>
</div>
<div id="cList"></div>
</div>

<script>
const T="{ADMIN_TOKEN}";
const API="";
const H={"X-Admin-Token":T};
const JH={"Content-Type":"application/json","X-Admin-Token":T};
function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML}

function showMsg(t,ok){const m=document.getElementById("msg");m.textContent=t;m.className="msg "+(ok?"msg-ok":"msg-err");m.style.display="block";setTimeout(()=>m.style.display="none",3000)}
function fmt(s){return s.replace("T"," ").slice(0,16)}
function switchTab(name){
  document.querySelectorAll(".tab").forEach((t,i)=>{t.classList.toggle("active",i===(name==="windows"?0:1))});
  document.getElementById("p-windows").classList.toggle("active",name==="windows");
  document.getElementById("p-courses").classList.toggle("active",name==="courses");
}

// ========== 时间窗口 ==========
async function loadWindows(){
  try{
    const r=await fetch(API+"/api/ss/admin/windows",{headers:H});
    const d=await r.json();
    const el=document.getElementById("wList");
    if(!d.windows||!d.windows.length){el.innerHTML='<div style="color:#8b949e;text-align:center;padding:30px">暂无窗口</div>';return}
    el.innerHTML=d.windows.map(w=>{
      const st=w.status==="open"?"tag-open":w.status==="upcoming"?"tag-upcoming":"tag-closed";
      const stText=w.status==="open"?"进行中":w.status==="upcoming"?"未开始":"已结束";
      const actText=w.is_active?"禁用":"启用";
      return '<div class="item"><div class="item-title">'+esc(w.name)+'<span class="tag '+st+'">'+stText+'</span>'+(!w.is_active?'<span class="tag tag-off">已禁用</span>':'')+'</div><div class="item-sub">'+fmt(w.start_time)+' ~ '+fmt(w.end_time)+'</div><div class="actions"><button class="'+(w.is_active?"btn-yellow":"btn-gray")+'" onclick="toggleWin('+w.id+')">'+actText+'</button><button class="btn-red" onclick="delWin('+w.id+')">删除</button></div></div>'
    }).join("")
  }catch(e){showMsg("加载窗口失败",false)}
}
async function createWindow(){
  const name=document.getElementById("wName").value.trim();
  const s=document.getElementById("wStart").value;
  const e=document.getElementById("wEnd").value;
  if(!name||!s||!e){showMsg("请填写完整",false);return}
  try{
    const r=await fetch(API+"/api/ss/admin/window",{method:"POST",headers:JH,body:JSON.stringify({name,start_time:s.replace("T"," "),end_time:e.replace("T"," ")})});
    const d=await r.json();
    if(d.ok){showMsg("创建成功",true);document.getElementById("wName").value="";loadWindows()}else showMsg(d.error,false)
  }catch(e){showMsg("请求失败",false)}
}
async function toggleWin(id){
  const r=await fetch(API+"/api/ss/admin/window/"+id+"/toggle",{method:"POST",headers:H});
  const d=await r.json();if(d.ok){showMsg(d.message,true);loadWindows()}else showMsg(d.error,false)
}
async function delWin(id){
  if(!confirm("确定删除？"))return;
  const r=await fetch(API+"/api/ss/admin/window/"+id,{method:"DELETE",headers:H});
  const d=await r.json();if(d.ok){showMsg("已删除",true);loadWindows()}else showMsg(d.error,false)
}

// ========== 课程管理 ==========
async function loadCourses(){
  try{
    const r=await fetch(API+"/api/ss/admin/courses",{headers:H});
    const d=await r.json();
    const el=document.getElementById("cList");
    if(!d.courses||!d.courses.length){el.innerHTML='<div style="color:#8b949e;text-align:center;padding:30px">暂无课程</div>';return}
    el.innerHTML=d.courses.map(c=>{
      const st=c.status==="active"?"tag-open":"tag-off";
      const stText=c.status==="active"?"启用":"禁用";
      return '<div class="item"><div class="item-title">'+esc(c.course_code)+' '+esc(c.name)+'<span class="tag '+st+'">'+stText+'</span></div><div class="item-sub">'+esc(c.teacher)+' | '+esc(c.credit)+'学分 | '+esc(c.department)+' | '+esc(c.schedule)+' | '+esc(c.location)+' | '+c.selected+'/'+c.max_capacity+'</div><div class="actions"><button class="btn-yellow" onclick="editCourse('+c.id+')">编辑</button><button class="'+(c.status==="active"?"btn-red":"btn-green")+'" onclick="toggleCourse('+c.id+')">'+(c.status==="active"?"禁用":"启用")+'</button><button class="btn-red" onclick="delCourse('+c.id+')">删除</button></div></div>'
    }).join("")
  }catch(e){showMsg("加载课程失败",false)}
}
function clearForm(){
  ["cCode","cName","cTeacher","cCredit","cHours","cCap","cDept","cSched","cLoc","cDesc"].forEach(id=>{document.getElementById(id).value=id==="cCredit"?"3":id==="cHours"?"48":id==="cCap"?"60":""});
  document.getElementById("cEditId").value="";
  document.getElementById("cancelBtn").style.display="none";
}
function cancelEdit(){clearForm()}
async function editCourse(id){
  const r=await fetch(API+"/api/ss/admin/courses",{headers:H});
  const d=await r.json();
  const c=d.courses.find(x=>x.id===id);
  if(!c)return;
  document.getElementById("cEditId").value=c.id;
  document.getElementById("cCode").value=c.course_code;
  document.getElementById("cName").value=c.name;
  document.getElementById("cTeacher").value=c.teacher;
  document.getElementById("cCredit").value=c.credit;
  document.getElementById("cHours").value=c.hours;
  document.getElementById("cCap").value=c.max_capacity;
  document.getElementById("cDept").value=c.department;
  document.getElementById("cSched").value=c.schedule;
  document.getElementById("cLoc").value=c.location;
  document.getElementById("cDesc").value=c.description;
  document.getElementById("cancelBtn").style.display="";
  window.scrollTo(0,0);
}
function randomFill(){
  const depts=["计算机学院","电子信息学院","管理学院","外国语学院","数学学院","人文学院","艺术学院","机械工程学院"];
  const teachers=["张明华","李建国","王秀英","赵丽娟","刘伟","陈志强","黄晓峰","林小红","孙国栋","周建华","吴明","郑天宇","钱学礼","许文静","蒋国强","韩梅梅","杨启明","马丽华","曹志刚","徐明德","朱文华","范长江","Michael Brown","田中惠子","Sarah Johnson"];
  const courses=["数据结构","操作系统","计算机网络","数据库系统","软件工程","编译原理","人工智能","Web开发","电路分析","模拟电子","数字电子","信号与系统","管理学原理","市场营销","财务管理","人力资源","大学英语","日语入门","口语训练","高等数学","线性代数","概率统计","近代史","大学语文","演讲与口才","Python程序设计","机器学习","网络安全","嵌入式系统","数字图像处理","物联网技术","大数据分析","云计算基础","区块链导论","机器人学"];
  const buildings=["致用楼","致远楼","实验楼","语言实验室","工程训练中心"];
  const days=["周一","周二","周三","周四","周五"];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const code="CS"+(100+Math.floor(Math.random()*900));
  const credit=[2,2.5,3,3.5,4][Math.floor(Math.random()*5)];
  const hours=credit*16;
  const cap=[40,45,50,55,60,65,70,80,100][Math.floor(Math.random()*9)];
  const d1=pick(days),d2=pick(days);
  const s1=Math.ceil(Math.random()*4)*2-1;
  const sched=d1+(s1)+"-"+(s1+1)+"节 "+d2+(s1)+"-"+(s1+1)+"节";
  const loc=pick(buildings)+Math.floor(Math.random()*5+1)*100+Math.floor(Math.random()*9+1);
  document.getElementById("cCode").value=code;
  document.getElementById("cName").value=pick(courses);
  document.getElementById("cTeacher").value=pick(teachers);
  document.getElementById("cCredit").value=credit;
  document.getElementById("cHours").value=hours;
  document.getElementById("cCap").value=cap;
  document.getElementById("cDept").value=pick(depts);
  document.getElementById("cSched").value=sched;
  document.getElementById("cLoc").value=loc;
  document.getElementById("cDesc").value="本课程介绍"+pick(courses)+"的基本概念、原理和应用方法";
}
async function saveCourse(){
  const body={
    course_code:document.getElementById("cCode").value.trim(),
    name:document.getElementById("cName").value.trim(),
    teacher:document.getElementById("cTeacher").value.trim(),
    credit:parseFloat(document.getElementById("cCredit").value)||3,
    hours:parseInt(document.getElementById("cHours").value)||48,
    max_capacity:parseInt(document.getElementById("cCap").value)||60,
    department:document.getElementById("cDept").value.trim(),
    schedule:document.getElementById("cSched").value.trim(),
    location:document.getElementById("cLoc").value.trim(),
    description:document.getElementById("cDesc").value.trim()
  };
  if(!body.course_code||!body.name||!body.teacher){showMsg("编号、名称、教师必填",false);return}
  const editId=document.getElementById("cEditId").value;
  if(editId)body.id=parseInt(editId);
  try{
    const r=await fetch(API+"/api/ss/admin/course",{method:"POST",headers:JH,body:JSON.stringify(body)});
    const d=await r.json();
    if(d.ok){showMsg(editId?"课程已更新":"课程已创建",true);clearForm();loadCourses()}else showMsg(d.error,false)
  }catch(e){showMsg("请求失败",false)}
}
async function toggleCourse(id){
  const r=await fetch(API+"/api/ss/admin/course/"+id+"/toggle",{method:"POST",headers:H});
  const d=await r.json();if(d.ok){showMsg(d.message,true);loadCourses()}else showMsg(d.error,false)
}
async function delCourse(id){
  if(!confirm("确定删除该课程？"))return;
  const r=await fetch(API+"/api/ss/admin/course/"+id,{method:"DELETE",headers:H});
  const d=await r.json();if(d.ok){showMsg("已删除",true);loadCourses()}else showMsg(d.error,false)
}

loadWindows();loadCourses();
</script>
</body></html>"""
    return html.replace("{ADMIN_TOKEN}", ADMIN_TOKEN)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"启动登录验证 API，端口 {port}")
    app.run(host="0.0.0.0", port=port, debug=False)

from dotenv import load_dotenv
import os

load_dotenv()

"""
GZASC学院教务系统爬虫
支持：自动登录 / 获取课程表 / 查询空教室 / 抢课

安装依赖：pip install requests beautifulsoup4 ddddocr pillow
运行方式：python jwxt.py
"""
# -*- coding: utf-8 -*-

import requests
import json
import time
import re
import os
import base64
import random
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

from supabase import create_client

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("❌ .env 没有正确加载 SUPABASE_URL / SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
SUPABASE_TABLE_SCHEDULE = "schedule"  # 你 Supabase 里已经有的 table 名称
SUPABASE_TABLE_EMPTY_ROOMS = "empty_rooms"
SUPABASE_TABLE_AVAILABLE_COURSES = "available_courses"

USERNAME  = os.getenv("JWXT_USERNAME", "")
PASSWORD  = os.getenv("JWXT_PASSWORD", "")
if not USERNAME or not PASSWORD:
    print("⚠️  环境变量 JWXT_USERNAME / JWXT_PASSWORD 未设置，请在 .env 中配置")
    USERNAME = USERNAME or ""
    PASSWORD = PASSWORD or ""

# ─── 配置区（只需修改这里）─────────────────────────────────────────
BASE_URL  = "https://jw.educationgroup.cn/gzasc_jsxsd"
DATA_DIR  = "./data"

# 学年学期映射（第1周的开始日期）
SEMESTER_START_DATES = {
    "2024-2025-1": "2024-09-02",
    "2024-2025-2": "2025-02-17",
    "2025-2026-1": "2025-09-01",
    "2025-2026-2": "2026-03-02",
}

CURRENT_SEMESTER = "2025-2026-2"  # 当前学年学期
TOTAL_WEEKS      = 18             # 本学期总周数

# 教务系统里肇庆校区的教学楼ID映射（留空=全部）
BUILDING_IDS = {
    "全部": "",
    "J1":  "",
    "J2":  "",
    "J3":  "",
    "J4":  "",
    "S1":  "",
    "S2":  "",
    "S3":  "",
    "S4":  "",
}

# 断点续爬进度文件
PROGRESS_FILE = f"{DATA_DIR}/crawl_progress.json"
# ──────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;"
        "q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


# ─── 工具函数 ─────────────────────────────────────────────────────
def get_current_week() -> int:
    """根据开学日期计算当前是第几周"""
    from datetime import datetime, timedelta
    start_str = SEMESTER_START_DATES.get(CURRENT_SEMESTER)
    if not start_str:
        return 1
    start = datetime.strptime(start_str, "%Y-%m-%d")
    delta = (datetime.now() - start).days
    return max(1, min(TOTAL_WEEKS, delta // 7 + 1))


def random_sleep(min_sec=2.0, max_sec=4.0):
    """随机等待，避免触发WAF"""
    import random
    t = random.uniform(min_sec, max_sec)
    time.sleep(t)


def save_progress(week: int, day: int):
    """保存断点进度"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"week": week, "day": day, "time": datetime.now().isoformat()}, f)


def load_progress() -> tuple:
    """读取断点进度，返回 (week, day)"""
    if not os.path.exists(PROGRESS_FILE):
        return 1, 1
    try:
        with open(PROGRESS_FILE) as f:
            p = json.load(f)
        print(f"   📌 发现断点：第{p['week']}周 星期{p['day']}，从断点继续...")
        return p["week"], p["day"]
    except Exception:
        return 1, 1


def clear_progress():
    """清除断点进度"""
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)



class JWXT:

    def merge_schedule(raw_list):
        merged = {}

        for item in raw_list:
            key = (
                item["room_name"],
                item["week"],
                item["weekday"],
                item["period"]
            )

            # busy 优先级更高
            if key not in merged:
                merged[key] = item
            else:
                # 如果已有 free，但新的是 busy → 覆盖
                if item["status"] == "busy":
                    merged[key] = item

        return list(merged.values())
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        os.makedirs(DATA_DIR, exist_ok=True)

    def _extract_weeks_range(self, weeks_str):
        if not weeks_str:
            return None, None

        nums = re.findall(r'\d+', weeks_str)
        if not nums:
            return None, None

        weeks = list(map(int, nums))

        return min(weeks), max(weeks)

    def _calculate_course_dates(self, weeks_str, semester=None):
        """根据周次和学年学期计算课程的开始和结课日期"""
        if not semester:
            semester = CURRENT_SEMESTER
        
        # 获取学年学期第1周的开始日期
        semester_start = SEMESTER_START_DATES.get(semester)
        if not semester_start:
            return None, None
        
        try:
            start_date = datetime.strptime(semester_start, "%Y-%m-%d")
        except:
            return None, None
        
        start_week, end_week = self._extract_weeks_range(weeks_str)
        if start_week is None:
            return None, None
        
        # 计算课程开始日期 = 学期开始日期 + (开始周 - 1) * 7天
        course_start = start_date + __import__('datetime').timedelta(days=(start_week - 1) * 7)
        # 计算课程结束日期 = 学期开始日期 + 结束周 * 7天 - 1天
        course_end = start_date + __import__('datetime').timedelta(days=end_week * 7 - 1)
        
        return course_start.strftime("%Y-%m-%d"), course_end.strftime("%Y-%m-%d")

    # ─── 1. 登录 ────────────────────────────────────────────────────
    def login(self, retry=0, max_retry=5): # retry: 重试次数
        print("🔐 正在登录...")

        # 第一步：访问首页触发WAF Cookie
        try:
            self.session.get(
                "https://jw.educationgroup.cn/gzasc_jsxsd/",
                timeout=10
            )
        except Exception as e:
            print(f"   ⚠️  访问首页失败: {e}")

        # 第二步：获取验证码
        captcha_text = self._get_captcha()

        # 第三步：构造encoded字段（base64学号 + %%% + base64密码）
        encoded = (
            base64.b64encode(USERNAME.encode()).decode()
            + "%%%"
            + base64.b64encode(PASSWORD.encode()).decode()
        )

        # 第四步：提交登录
        data = {
            "userAccount": USERNAME,
            "userPassword": "",
            "RANDOMCODE": captcha_text,
            "encoded": encoded,
        }
        resp = self.session.post(
            f"{BASE_URL}/xk/LoginToXk",
            data=data,
            allow_redirects=True,
            timeout=10
        )

        if "xsMain" in resp.url or "教学一体化" in resp.text:
            print("   ✅ 登录成功！")

            self._save_cookies()

            return True
        
        elif "验证码" in resp.text:

            print("   ❌ 验证码错误")

            if retry >= 5:
                print("   ❌ 重试次数过多，停止登录")
                return False

            print(f"   🔄 正在重试 ({retry + 1}/5)...")

            return self.login(retry + 1)
        else:
            print("   ❌ 登录失败，请检查账号密码")
            print(f"   当前URL: {resp.url}")
            return False

    def _get_captcha(self):
        try:
            import ddddocr
            resp = self.session.get(
                f"{BASE_URL}/verifycode.servlet", timeout=5
            )
            with open(f"{DATA_DIR}/captcha.jpg", "wb") as f:
                f.write(resp.content)
            ocr = ddddocr.DdddOcr(show_ad=False)
            result = ocr.classification(resp.content).strip()
            print(f"   🔑 验证码: {result}")
            return result
        except ImportError:
            print("   ⚠️  ddddocr未安装: pip install ddddocr")
            return ""
        except Exception as e:
            print(f"   ⚠️  验证码识别失败: {e}")
            return ""

    def _save_cookies(self):
        cookies = self.session.cookies.get_dict()
        with open(f"{DATA_DIR}/cookies.json", "w") as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)
        print(f"   💾 Cookie已保存")



    def load_cookies(self):
        cookie_file = f"{DATA_DIR}/cookies.json"
        if not os.path.exists(cookie_file):
            return False
        try:
            with open(cookie_file) as f:
                cookies = json.load(f)
            self.session.cookies.update(cookies)
            resp = self.session.get(
                f"{BASE_URL}/framework/xsMain.jsp", timeout=5
            )
            if "教学一体化" in resp.text or "退出" in resp.text:
                print("   ✅ Cookie有效，跳过登录")
                return True
        except Exception:
            pass
        return False

    def _supabase_upsert(self, table: str, records: list, conflict_cols: str) -> bool:
        """upsert：有则更新，无则插入，不产生重复数据"""
        if not records:
            return False
        try:
            result = (
                supabase.table(table)
                .upsert(records, on_conflict=conflict_cols)
                .execute()
            )
            print(f"   💾 upsert {table} 成功，{len(records)} 条")
            return True
        except Exception as e:
            print(f"   ⚠️  Supabase upsert 失败: {e}")
            return False
        return False

    def _supabase_insert(self, table, records):
        if not records:
            return False

        try:
            batch_size = 500

            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                supabase.table(table).insert(batch).execute()

            print(f"   💾 写入 {table} 成功，共 {len(records)} 条")
            return True

        except Exception as e:
            print(f"   ⚠️ Supabase 写入失败: {e}")
            return False

    def save_schedule_to_supabase(self, courses):
        records = []
        for c in courses:
            record = {
                "name": c.get("name"),
                "teacher": c.get("teacher"),
                "room": c.get("room"),
                "weeks": c.get("weeks"),
                "day": c.get("day"),
                "node": c.get("node"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "start_date": c.get("start_date"),
                "end_date": c.get("end_date"),
            }
            records.append(record)
        return self._supabase_insert(SUPABASE_TABLE_SCHEDULE, records)

    def save_available_courses_to_supabase(self, courses, course_type):
        records = []
        for c in courses:
            # 把字符串数字转成整数
            def to_int(val):
                if not val or val in ['-', '未限制', '']:
                    return 0
                try:
                    match = re.search(r'\d+', str(val))
                    return int(match.group()) if match else 0
                except:
                    return 0
            
            records.append({
                "course_id": c.get("id"),
                "name": c.get("name"),
                "teacher": c.get("teacher"),
                "credit": c.get("credit"),
                "hours": c.get("hours"),
                "capacity": to_int(c.get("capacity")),
                "selected": to_int(c.get("selected")),
                "remaining": to_int(c.get("remaining")),
                "course_type": course_type,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
        return self._supabase_insert(SUPABASE_TABLE_AVAILABLE_COURSES, records)

    # ─── 2. 获取课程表 ───────────────────────────────────────────────
    def get_schedule(self):
        print("\n📅 正在获取课程表...")

        url = f"{BASE_URL}/xskb/xskb_list.do"
        resp = self.session.get(url, timeout=10)

        # 保存原始HTML
        with open(f"{DATA_DIR}/schedule_raw.html", "w", encoding="utf-8") as f:
            f.write(resp.text)

        # 检查是否被踢回登录页
        if "登录" in BeautifulSoup(resp.text, "html.parser").title.text if BeautifulSoup(resp.text, "html.parser").title else True:
            if "登录" in resp.text and "xsMain" not in resp.url:
                print("   ⚠️  Session过期，重新登录...")
                self.login()
                resp = self.session.get(url, timeout=10)
                with open(f"{DATA_DIR}/schedule_raw.html", "w", encoding="utf-8") as f:
                    f.write(resp.text)

        courses = self._parse_schedule(resp.text)

        output = {
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total": len(courses),
            "courses": courses
        }
        with open(f"{DATA_DIR}/schedule.json", "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        self.save_schedule_to_supabase(courses)

        print(f"   ✅ 获取到 {len(courses)} 门课程")
        print(f"   💾 已保存到 {DATA_DIR}/schedule.json")

        # 打印课程列表预览
        for c in courses[:5]:
            print(f"      {c.get('day','')} {c.get('node','')} | {c.get('name','')} | {c.get('room','')}")

        return courses

    def _clean_weeks(self, raw: str) -> str:
        """清洗周次字符串，如 '3,5-11,13-18(周)[01-02节]' → '3,5-11,13-18'"""
        if not raw:
            return ""
        s = re.sub(r'\[.*?\]', '', raw)
        s = re.sub(r'[第周\(\)（）\s]', '', s)
        segments = re.findall(r'\d+-\d+|\d+', s)
        return ",".join(segments)

    def _parse_cell_courses(self, cell_text: str) -> list:
        """
        解析单元格内所有课程。
        强智系统单元格有两段：旧格式（无教师） + 完整格式（含教师），
        用双换行分隔，只取后半段（完整格式）。
        每门课之间用 ----- 分隔。
        完整格式行顺序：课程名 / 教师 / 周次[节次] / 教室
        """
        # 取双换行后的完整格式段
        parts = cell_text.split("\n\n")
        full_part = parts[-1] if len(parts) > 1 else parts[0]

        # 按分隔线拆出每门课
        blocks = re.split(r'[-—]{3,}', full_part)
        result = []

        for block in blocks:
            lines = []
            for l in block.split("\n"):
                l = (l.strip()
                      .replace("\xa0", "")
                      .replace("&nbsp;", "")
                      .replace("&nbsp", "")
                      .replace("nbsp;", "")
                      .replace("nbsp", ""))
                if l and l not in ["P", "&nbspP", "nbspP"]:
                    lines.append(l)

            if not lines:
                continue

            name = ""
            teacher = ""
            room = ""
            weeks_raw = ""

            for line in lines:
                if re.fullmatch(r'[-—=]+', line):
                    continue
                if "周" in line:
                    weeks_raw = line
                elif re.search(r'(J|S|A|B|C|D)\d|实验|机房|楼|致用', line):
                    room = line
                elif re.match(r'^[\u4e00-\u9fa5]{2,5}$', line):
                    if not name:
                        name = line   # 暂存，可能是课程名也可能是教师
                    elif not teacher:
                        teacher = line
                else:
                    if len(line) >= 2 and "----" not in line:
                        if len(line) > len(name):
                            # 更长的字符串才是课程名
                            if name and re.match(r'^[\u4e00-\u9fa5]{2,5}$', name):
                                teacher = name  # 把之前暂存的短汉字串改为教师
                            name = line

            weeks_clean = self._clean_weeks(weeks_raw)

            if name and len(name) >= 2:
                result.append({
                    "name":      name,
                    "teacher":   teacher,
                    "room":      room,
                    "weeks":     weeks_clean,
                    "weeks_raw": weeks_raw,
                })

        return result

    def _parse_schedule(self, html):
        soup = BeautifulSoup(html, "html.parser")
        courses = []

        table = soup.find("table", id="kbtable")
        if not table:
            print("⚠️ 未找到课表")
            return []

        rows = table.find_all("tr")
        day_map = {
    0: "周一",
    1: "周二",
    2: "周三",
    3: "周四",
    4: "周五",
    5: "周六",
    6: "周日",
}
        node_map = {1:"1-2", 2:"3-4", 3:"5-6", 4:"7-8", 5:"9-10"}
        rowspan_map = {}

        for row_idx, row in enumerate(rows[1:], 1):
            cells = row.find_all("td")
            real_col = 0

            for cell in cells:
                while rowspan_map.get((row_idx, real_col)):
                    real_col += 1

                rowspan = int(cell.get("rowspan", 1))
                if rowspan > 1:
                    for r in range(1, rowspan):
                        rowspan_map[(row_idx + r, real_col)] = True

                text = cell.get_text("\n").strip()
                if text and len(text) > 2:
                    cell_courses = self._parse_cell_courses(text)
                    for c in cell_courses:
                        course_start, course_end = self._calculate_course_dates(c["weeks_raw"])
                        courses.append({
                            "name":       c["name"],
                            "teacher":    c["teacher"],
                            "room":       c["room"],
                            "weeks":      c["weeks"],
                            "start_date": course_start,
                            "end_date":   course_end,
                            "day":        day_map.get(real_col, ""),
                            "node":       node_map.get(row_idx, ""),
                        })

                real_col += 1

        return courses

    # ─── 3. 空教室：单次查询 ─────────────────────────────────────────────────
    def _fetch_rooms_for_week_day(self, week: int, day: int) -> list:
        """
        爬取第week周 星期day 的全校教室占用情况
        day: 1=周一 ... 7=周日
        返回 list of room dict
        """
        self.session.headers.update({
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer":      f"{BASE_URL}/kbcx/kbxx_classroom",
            "Origin":       "https://jw.educationgroup.cn",
        })

        data = {
            "xnxqh":    CURRENT_SEMESTER,
            "kbjcmsid": "E37858B1799D43C9A598C8C6D1D21E05",
            "skyx":     "",
            "xqid":     "19",
            "jzwid":    "",
            "skjsid":   "",
            "skjs":     "",
            "zc1":      str(week),
            "zc2":      str(week),
            "skxq1":    str(day),
            "skxq2":    str(day),
            "jc1":      "",
            "jc2":      "",
        }

        try:
            resp = self.session.post(
                f"{BASE_URL}/kbcx/kbxx_classroom_ifr",
                data=data, timeout=15
            )
        except Exception as e:
            print(f"      ⚠️  请求失败: {e}")
            return []

        # 检查是否被踢回登录页
        if "登录" in resp.text and len(resp.text) < 5000:
            print("      ⚠️  Session失效，重新登录...")
            self.login()
            return self._fetch_rooms_for_week_day(week, day)

        return self._parse_rooms(resp.text, week, day)

    def _parse_rooms(self, html: str, week: int, day: int) -> list:
        """
        解析教室课表HTML，返回带schedule的room列表
        HTML表头结构：教室\节次 | 0102 0304 0506 0708 091011 | (×7天)
        只有5个时间段，对应11节课（1-2, 3-4, 5-6, 7-8, 9-10-11）
        """
        DAY_MAP = {1:"周一",2:"周二",3:"周三",4:"周四",5:"周五",6:"周六",7:"周日"}
        soup  = BeautifulSoup(html, "html.parser")
        rooms = []
        
        table = soup.find("table")
        if not table:
            return rooms

        rows = table.find_all("tr")
        if not rows or len(rows) < 2:
            return rooms

        # 提取第二行表头（节次信息）
        header_row = rows[1].find_all("td")
        if not header_row:
            return rooms
        
        # headers[0] 是"教室\节次"，后面是实际的节次（0102,0304,0506,0708,091011）
        headers = [td.get_text().strip() for td in header_row]
        
        # 计算当前星期的节次列数（应该是5个）
        num_periods_per_day = (len(headers) - 1) // 7  # 去掉教室列，除以7天
        if num_periods_per_day <= 0:
            num_periods_per_day = 5  # 默认5个时间段
        
       # 强智空教室页面：
        # 每天固定5列
        # 1-2 / 3-4 / 5-6 / 7-8 / 9-11

        day_start_col = 1 + (day - 1) * 5
        day_end_col = day_start_col + 5
        
        # 标准节次映射
        period_map = {
            "0102": ["第1节", "第2节"],
            "0304": ["第3节", "第4节"],
            "0506": ["第5节", "第6节"],
            "0708": ["第7节", "第8节"],
            "091011": ["第9节", "第10节", "第11节"],
        }

        for row in rows[2:]:  # 从第三行开始（第一行分类，第二行节次名）
            cells = row.find_all("td")
            if not cells:
                continue
            room_name = cells[0].get_text().strip()
            if not room_name:
                continue

            # 提取楼栋名（J1-201 → J1）
            building_match = re.match(r'^([A-Za-z]+\d*)', room_name)
            building = building_match.group(1) if building_match else ""

            schedule     = []
            free_periods = []
            busy_periods = []

            # 只提取当前星期的节次
            for col_idx in range(day_start_col, min(day_end_col, len(cells))):
                cell = cells[col_idx]
                text = cell.get_text(" ", strip=True)

                # 清理垃圾字符
                text = (
                    text.replace("\xa0", "")
                        .replace("&nbsp;", "")
                        .strip()
                )
                    
                # 根据header获取节次名（如"0102"）
                if col_idx >= len(headers):
                    continue

                period_key = headers[col_idx]
                period_names = period_map.get(period_key, [period_key])
                
                # 处理多节课（如091011对应第9,10,11节）
                for period_str in period_names:

                        # 转成真实节次数字
                        period_num = int(''.join(filter(str.isdigit, period_str)))

                        if text:
                            busy_periods.append(period_num)
                            schedule.append({
                                "period": period_num,
                                "status": "busy",
                                "info": text[:40]
                            })
                        else:
                            free_periods.append(period_num)
                            schedule.append({
                                "period": period_num,
                                "status": "free",
                                "info": ""
                            })
                        

            rooms.append({
                "name":         room_name,
                "building":     building,
                "week":         week,
                "day":          f"星期{day}",
                "day_num":      day,
                "date":         (datetime.strptime(SEMESTER_START_DATES[CURRENT_SEMESTER], "%Y-%m-%d") 
                               + timedelta(days=(week-1)*7 + day-1)).strftime("%Y-%m-%d"),
                "schedule":     schedule,        # 最多11节课
                "free_periods": free_periods,
                "busy_periods": busy_periods,
                "free_count":   len(free_periods),
                "semester":     CURRENT_SEMESTER,
                "updated_at":   datetime.now().isoformat(),
            })

        return rooms

    def _save_rooms_to_supabase(self, rooms: list):
        if not rooms:
            return

        import json, os

        # 读取教室主库
        master_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "rooms_master.json")
        all_rooms = {}
        if os.path.exists(master_path):
            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    all_rooms = json.load(f)
            except:
                pass

        # 已有数据的教室名集合
        existing_names = {r["name"] for r in rooms}

        # 从第一条记录获取日期等公共信息
        sample = rooms[0] if rooms else {}
        date = sample.get("date", "")
        week = sample.get("week", 0)
        day_num = sample.get("day_num", 0)
        semester = sample.get("semester", "2025-2026-2")

        # 用主库补全缺失的教室（默认全天空闲）
        for name, info in all_rooms.items():
            if name not in existing_names and info.get("building"):
                rooms.append({
                    "name": name,
                    "building": info["building"],
                    "date": date,
                    "week": week,
                    "day_num": day_num,
                    "semester": semester,
                    "free_periods": [1,2,3,4,5,6,7,8,9,10,11],
                    "busy_periods": [],
                    "free_count": 11,
                    "busy_count": 0,
                })

        records = []
        for r in rooms:
            records.append({
                "name": r["name"],
                "building": r["building"],
                "date": r["date"],
                "week": r["week"],
                "day_num": r["day_num"],
                "semester": r.get("semester", "2025-2026-2"),
                "free_count": r["free_count"],
                "busy_count": len(r["busy_periods"]),
                "free_periods": r["free_periods"],
                "busy_periods": r["busy_periods"],
                "updated_at": datetime.now().isoformat()
            })

        try:
            result = supabase.table(SUPABASE_TABLE_EMPTY_ROOMS)\
                .upsert(records, on_conflict="name,date,semester")\
                .execute()
            print(f"   💾 Supabase写入成功：{len(records)} 条")
        except Exception as e:
            print(f"   ❌ Supabase写入失败：{e}")
    def build_rooms_master(self, rooms):
        """
        建立全校教室主库
        """

        import json
        import os

        BASE_DIR = os.path.dirname(os.path.abspath(__file__))

        master_path = os.path.join(
            BASE_DIR,
            "data",
            "rooms_master.json"
        )

        # 读取旧数据
        all_rooms = {}

        if os.path.exists(master_path):
            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    all_rooms = json.load(f)
            except:
                all_rooms = {}

        # 更新教室
        for r in rooms:
            room_name = r["name"]

            all_rooms[room_name] = {
                "name": room_name,
                "building": r.get("building", ""),
                "last_seen": r.get("date", "")
            }

        # 保存
        os.makedirs(os.path.dirname(master_path), exist_ok=True)

        with open(master_path, "w", encoding="utf-8") as f:
            json.dump(
                all_rooms,
                f,
                ensure_ascii=False,
                indent=2
            )

        print(f"🏫 教室主库已更新：{len(all_rooms)} 个教室")

    # ─── 空教室：全量爬取（开学时跑一次）────────────────────────────────────
    def crawl_full_semester(self):
        """
        全量爬取整学期（18周 × 7天 = 126次请求）
        支持断点续爬，中途中断后重新运行会从断点继续
        """
        print(f"\n🚀 全量爬取模式：第1-{TOTAL_WEEKS}周，共{TOTAL_WEEKS*7}次请求")
        print(f"   预计耗时：约{TOTAL_WEEKS*7*4//60}分钟（含随机间隔）")
        print(f"   Ctrl+C 可随时中断，下次运行会从断点继续\n")

        start_week, start_day = load_progress()
        total   = TOTAL_WEEKS * 7
        done    = (start_week - 1) * 7 + (start_day - 1)
        success = 0
        failed  = []

        DAY_NAMES = {1:"周一",2:"周二",3:"周三",4:"周四",5:"周五",6:"周六",7:"周日"}

        for week in range(start_week, TOTAL_WEEKS + 1):
            day_start = start_day if week == start_week else 1
            for day in range(day_start, 8):
                done += 1
                pct   = done / total * 100
                print(f"   [{done}/{total}] {pct:.1f}% | 第{week}周 {DAY_NAMES[day]} ", end="", flush=True)

                # 保存断点
                save_progress(week, day)

                rooms = self._fetch_rooms_for_week_day(week, day)
                self._save_rooms_to_supabase(rooms)

                if rooms:
                    self.build_rooms_master(rooms)
                    self._save_rooms_to_supabase(rooms)
                    print(f"→ {len(rooms)} 个教室 ✅")
                    success += 1
                else:
                    print("→ 无数据 ⚠️")
                    failed.append((week, day))

                # 随机间隔防封IP
                random_sleep(2.0, 4.0)

        # 全量完成，清除断点
        clear_progress()

        print(f"\n✅ 全量爬取完成！")
        print(f"   成功：{success} 次 | 失败：{len(failed)} 次")
        if failed:
            print(f"   失败的请求：{failed}")
            print("   💡 可重新运行 --full 从断点继续补爬")

    # ─── 空教室：增量更新（每10天自动跑）────────────────────────────────────
    def crawl_update(self, ahead_weeks: int = 2):
        """
        增量更新：只爬当前周和接下来N周的数据
        默认更新接下来2周，约14次请求，约2分钟
        """
        from datetime import datetime, timedelta
        current_week = get_current_week()
        end_week     = min(current_week + ahead_weeks - 1, TOTAL_WEEKS)

        print(f"\n🔄 增量更新模式：第{current_week}-{end_week}周")
        print(f"   当前第{current_week}周 | 共{(end_week - current_week + 1) * 7}次请求\n")

        DAY_NAMES = {1:"周一",2:"周二",3:"周三",4:"周四",5:"周五",6:"周六",7:"周日"}
        total   = (end_week - current_week + 1) * 7
        done    = 0
        success = 0

        for week in range(current_week, end_week + 1):
            for day in range(1, 8):
                done += 1
                print(f"   [{done}/{total}] 第{week}周 {DAY_NAMES[day]} ", end="", flush=True)

                rooms = self._fetch_rooms_for_week_day(week, day)
                self._save_rooms_to_supabase(rooms)

                if rooms:
                    self._save_rooms_to_supabase(rooms)
                    self.build_rooms_master(rooms)
                    print(f"→ {len(rooms)} 个教室 ✅")
                    success += 1
                else:
                    print("→ 无数据 ⚠️")

                random_sleep(1.5, 3.0)  # 增量更新间隔略短

        print(f"\n✅ 增量更新完成！成功 {success}/{total} 次")

    # ─── 旧版单天查询（兼容保留）─────────────────────────────────────────────
    def get_empty_rooms(self, date=None, period="allday", building=""):
        print(f"\n🏫 正在查询空教室...")
        from datetime import datetime as dt
        
        # 检查 Session 是否有效
        resp_check = self.session.get(f"{BASE_URL}/framework/xsMain.jsp", timeout=5)
        if "登录" in resp_check.text or "教学一体化" not in resp_check.text:
            print("   ⚠️  Session 过期，重新登录...")
            if not self.login():
                print("   ❌ 登录失败，无法查询")
                return []
        
        # 处理日期参数
        if date is None:
            query_date = dt.now()
        else:
            try:
                query_date = dt.strptime(date, "%Y-%m-%d")
            except ValueError:
                print(f"   ⚠️  日期格式错误: {date}，使用今天")
                query_date = dt.now()
        
        # 将日期转换为星期 (1=周一, 2=周二, ..., 7=周日)
        weekday = query_date.weekday() + 1  # Python weekday: 0=周一
        if weekday == 7:
            weekday = 7  # 周日
        
        # 根据日期算出是第几周
        start_str = SEMESTER_START_DATES.get(CURRENT_SEMESTER)
        week = 1
        if start_str:
            start = dt.strptime(start_str, "%Y-%m-%d")
            week  = max(1, min(TOTAL_WEEKS, (query_date - start).days // 7 + 1))

        print(f"   📋 第{week}周 星期{weekday} | 时段={period}")
        rooms = self._fetch_rooms_for_week_day(week, weekday)
                # ==============================
        # 用教室主库补全缺失教室（周末非常重要）
        # ==============================

        master_path = os.path.join(DATA_DIR, "rooms_master.json")

        if os.path.exists(master_path):

            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    master_rooms = json.load(f)

                existing_names = set(r["name"] for r in rooms)

                for room_name, room_info in master_rooms.items():

                    # 如果今天接口没返回这个教室
                    # 默认认为全天空闲
                    if room_name not in existing_names:

                        rooms.append({
                            "name": room_name,
                            "building": room_info.get("building", ""),
                            "week": week,
                            "day": f"星期{weekday}",
                            "day_num": weekday,
                            "date": query_date.strftime("%Y-%m-%d"),

                            "schedule": [],

                            "free_periods": [1,2,3,4,5,6,7,8,9,10,11],
                            "busy_periods": [],

                            "free_count": 11,

                            "semester": CURRENT_SEMESTER,
                            "updated_at": datetime.now().isoformat(),
                        })

                print(f"   🏫 主库补全后：{len(rooms)} 个教室")

            except Exception as e:
                print(f"   ⚠️ 主库补全失败: {e}")
        self._save_rooms_to_supabase(rooms)

        if rooms:
            self.build_rooms_master(rooms)

        # 过滤时段
        if period != "allday":
            period_nodes = {
                "am":    ["第1节","第2节","第3节","第4节"],
                "pm":    ["第5节","第6节","第7节","第8节"],
                "night": ["第9节","第10节","第11节"],
            }.get(period, [])
            for r in rooms:
                r["free_periods"] = [p for p in r["free_periods"] if p in period_nodes]
                r["busy_periods"] = [p for p in r["busy_periods"] if p in period_nodes]
                r["free_count"]   = len(r["free_periods"])

        # 只保留有空闲的
        rooms = [r for r in rooms if r["free_count"] > 0]
        rooms.sort(key=lambda x: x["free_count"], reverse=True)

        # 分日期存储（而不是所有数据都放在一个文件里）
        date_str = query_date.strftime("%Y-%m-%d")
        rooms_dir = f"{DATA_DIR}/empty_rooms_by_date"
        os.makedirs(rooms_dir, exist_ok=True)
        
        output = {
            "updated_at": datetime.now().isoformat(),
            "query": {
                "date": date_str,
                "week": week,
                "day": weekday,
                "period": period,
                "building": building
            },
            "total": len(rooms),
            "rooms": rooms
        }
        
        # 按日期保存（如：empty_rooms/2026-05-18.json）
        date_file = f"./data/empty_rooms/week_{week}_day_{weekday}.json"
        save_path = date_file
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"   ✅ 找到 {len(rooms)} 个空教室")
        print(f"   💾 已保存到 {date_file}")
        return rooms

    # ─── 4. 抢课 ────────────────────────────────────────────────────
    def select_course(self, course_id, course_type="bx", max_retries=0):
        """
        抢课
        course_id:   从选课页面Network里找 jx0404id 参数
        course_type: bx=必修 / gx=公选 / rx=任选
        max_retries: 0=无限重试
        """
        endpoint_map = {
            "bx": "xsxkkc/bxxkOper",
            "gx": "xsxkkc/gxxkOper",
            "rx": "xsxkkc/xxxkOper",
        }
        url = f"{BASE_URL}/{endpoint_map.get(course_type, 'xsxkkc/bxxkOper')}"
        params = {"jx0404id": course_id, "xkzy": ""}

        print(f"\n🎯 开始抢课 | 课程ID: {course_id} | 类型: {course_type}")
        print(f"   最大重试: {'无限' if max_retries == 0 else max_retries}次 | Ctrl+C 停止\n")

        attempt = 0
        while max_retries == 0 or attempt < max_retries:
            attempt += 1
            try:
                resp = self.session.get(url, params=params, timeout=5)
                result = resp.text.strip()
                ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                print(f"   [{ts}] 第{attempt}次 → {result[:80]}")

                if "成功" in result or "success" in result.lower():
                    print(f"\n   🎉 抢课成功！")
                    return True
                elif "已选" in result or "重复" in result:
                    print(f"\n   ℹ️  该课程已选过")
                    return True
                elif "未开放" in result or "时间" in result:
                    time.sleep(5)

                time.sleep(0.3)

            except requests.Timeout:
                print(f"   [{attempt}] 超时，重试...")
            except KeyboardInterrupt:
                print(f"\n   ⏹️  已停止（共尝试{attempt}次）")
                return False
            except Exception as e:
                print(f"   [{attempt}] 错误: {e}")
                time.sleep(1)

        return False

    # ─── 5. 查询可选课程 ─────────────────────────────────────────────
    def get_available_courses(self, course_type="gx", keyword="", show_all=True):
        print(f"\n📋 查询可选课程（{course_type}）...")
        
        # 检查 Session 是否有效
        resp_check = self.session.get(f"{BASE_URL}/framework/xsMain.jsp", timeout=5)
        if "登录" in resp_check.text or "教学一体化" not in resp_check.text:
            print("   ⚠️  Session 过期，重新登录...")
            if not self.login():
                print("   ❌ 登录失败，无法查询")
                return []
        
        endpoint_map = {
            "gx": "xsxkkc/gxkcxkOper",
            "bx": "xsxkkc/bxkcxkOper",
        }
        url = f"{BASE_URL}/{endpoint_map.get(course_type, 'xsxkkc/gxkcxkOper')}"
        resp = self.session.post(url, data={"kcxx": keyword}, timeout=10)

        with open(f"{DATA_DIR}/available_courses_raw.html", "w", encoding="utf-8") as f:
            f.write(resp.text)

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
                "id":        course_id,
                "name":      cells[1].get_text().strip() if len(cells) > 1 else "",
                "teacher":   cells[3].get_text().strip() if len(cells) > 3 else "",
                "credit":    cells[2].get_text().strip() if len(cells) > 2 else "",
                "hours":     cells[4].get_text().strip() if len(cells) > 4 else "",
                "capacity":  cells[5].get_text().strip() if len(cells) > 5 else "",
                "selected":  cells[6].get_text().strip() if len(cells) > 6 else "",
                "remaining": cells[7].get_text().strip() if len(cells) > 7 else "",
            })

        with open(f"{DATA_DIR}/available_courses.json", "w", encoding="utf-8") as f:
            json.dump({"type": course_type, "courses": courses}, f, ensure_ascii=False, indent=2)

        # self.save_available_courses_to_supabase(courses, course_type)

        print(f"   ✅ 找到 {len(courses)} 门可选课程\n")
        
        # 显示课程列表
        if show_all and len(courses) > 0:
            print(f"   {'序号':<5}{'课程ID':<35}{'课程名':<20}{'教师':<12}{'剩余'}")
            print("   " + "─" * 90)
            for i, c in enumerate(courses, 1):
                print(f"   {i:<5}{c['id']:<35}{c['name'][:20]:<20}{c['teacher'][:12]:<12}{c['remaining']}")
                if i % 10 == 0 and i < len(courses):
                    input(f"   ... 还有 {len(courses)-i} 门课程，按 Enter 继续 ...")
            print("\n   💡 复制课程ID用于抢课（选项4）\n")
        else:
            for c in courses[:10]:
                print(f"   [{c['id']}] {c['name']} | 教师: {c['teacher']} | 剩余: {c['remaining']}人")
        
        return courses


# ─── 主程序 ────────────────────────────────────────────────────────
def main():
    print("=" * 50)
    print("  GZASC学院教务系统爬虫")
    print("=" * 50)

    jw = JWXT()

    if not jw.load_cookies():
        if not jw.login():
            print("\n❌ 登录失败，退出")
            return

    print("\n请选择功能：")
    print("  1. 获取课程表")
    print("  2. 查询单天空教室")
    print("  3. 🚀 全量爬取整学期空教室（开学时用）")
    print("  4. 🔄 增量更新空教室（接下来2周）")
    print("  5. 查询所有可选课程")
    print("  6. 搜索课程（按名称）")
    print("  7. 抢课")
    print("  8. 全部执行（课程表+单天空教室）")

    choice = input("\n输入数字: ").strip()

    if choice in ("1", "8"):
        jw.get_schedule()

    if choice in ("2", "8"):
        date   = input("查询日期（直接回车=今天，或如 2026-05-14）: ").strip() or None
        period = input("时段（allday/am/pm/night，回车=全天）: ").strip() or "allday"
        jw.get_empty_rooms(date=date, period=period)

    if choice == "3":
        confirm = input("⚠️  这将爬取整学期数据，约15-20分钟，确认？(y/n): ").strip()
        if confirm.lower() == "y":
            jw.crawl_full_semester()

    if choice == "4":
        jw.crawl_update(ahead_weeks=2)

    if choice == "5":
        ctype = input("课程类型（gx=公选/bx=必修，回车=公选）: ").strip() or "gx"
        jw.get_available_courses(course_type=ctype, keyword="", show_all=True)

    if choice == "6":
        ctype   = input("课程类型（gx=公选/bx=必修，回车=公选）: ").strip() or "gx"
        keyword = input("课程名关键词（如：英语、数学）: ").strip()
        if keyword:
            jw.get_available_courses(course_type=ctype, keyword=keyword, show_all=True)
        else:
            print("   ⚠️  请输入关键词")

    if choice == "7":
        print("\n💡 步骤：先选择选项 5 查看所有课程和ID，复制ID来这里")
        course_id = input("输入课程ID: ").strip()
        if course_id:
            ctype     = input("课程类型（bx=必修/gx=公选/rx=任选，回车=必修）: ").strip() or "bx"
            jw.select_course(course_id=course_id, course_type=ctype, max_retries=0)
        else:
            print("   ⚠️  课程ID不能为空")

    print("\n✅ 完成！数据在 ./data/ 目录")


if __name__ == "__main__":
    main()
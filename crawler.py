"""
强智科技教务系统爬虫
适用域名: jw.educationgroup.cn 系列
功能: 登录、获取课表、成绩、空教室
"""

import requests
import hashlib
import json
import time
import re
import os
from typing import Optional

# ── 尝试导入 ddddocr，没装就跳过 ──────────────────────────────────────────
try:
    import ddddocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("[警告] ddddocr 未安装，将使用手动输入验证码模式")
    print("       安装命令: pip install ddddocr")


class JWXTCrawler:
    """强智科技教务系统爬虫"""

    def __init__(self, base_url: str):
        """
        Args:
            base_url: 教务系统域名，如 https://jw.educationgroup.cn
        """
        self.base_url = base_url.rstrip("/")
        self.session  = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })
        self.is_logged_in = False
        self._ocr = ddddocr.DdddOcr(show_ad=False) if OCR_AVAILABLE else None

    # ── 内部工具 ─────────────────────────────────────────────────────────────

    def _md5(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()

    def _get(self, path: str, **kwargs) -> requests.Response:
        url = self.base_url + path
        resp = self.session.get(url, timeout=15, **kwargs)
        resp.raise_for_status()
        return resp

    def _post(self, path: str, **kwargs) -> requests.Response:
        url = self.base_url + path
        resp = self.session.post(url, timeout=15, **kwargs)
        resp.raise_for_status()
        return resp

    # ── 验证码 ───────────────────────────────────────────────────────────────

    def _get_captcha(self) -> tuple[bytes, str]:
        """获取验证码图片，返回 (图片字节, 随机盐randCode)"""
        # 有些强智版本把 randCode 放在首页 HTML 里
        try:
            home = self._get("/")
            rand_match = re.search(r'randCode["\s:=]+(["\']?)(\w+)\1', home.text)
            rand_code  = rand_match.group(2) if rand_match else ""
        except Exception:
            rand_code = ""

        # 获取验证码图片（时间戳防缓存）
        ts  = int(time.time() * 1000)
        img = self._get(f"/verifyCode.servlet?t={ts}").content
        return img, rand_code

    def _recognize_captcha(self, img_bytes: bytes) -> str:
        """用 OCR 或手动输入识别验证码"""
        if self._ocr:
            try:
                result = self._ocr.classification(img_bytes)
                # 强智验证码通常4位字母数字，过滤杂项
                result = re.sub(r'[^a-zA-Z0-9]', '', result)
                print(f"[OCR] 识别验证码: {result}")
                return result
            except Exception as e:
                print(f"[OCR] 识别失败: {e}，切换手动输入")

        # 手动输入：把图片保存到本地再让用户看
        tmp_path = "/tmp/captcha.png"
        with open(tmp_path, "wb") as f:
            f.write(img_bytes)
        print(f"[验证码] 图片已保存到 {tmp_path}，请查看后输入")
        return input("请输入验证码: ").strip()

    # ── 登录 ─────────────────────────────────────────────────────────────────

    def login(self, student_id: str, password: str, max_retry: int = 3) -> bool:
        """
        登录教务系统
        Args:
            student_id: 学号
            password:   明文密码
            max_retry:  验证码识别失败最大重试次数
        Returns:
            True = 登录成功
        """
        for attempt in range(1, max_retry + 1):
            print(f"[登录] 第 {attempt} 次尝试...")

            img_bytes, rand_code = self._get_captcha()
            captcha = self._recognize_captcha(img_bytes)

            # 强智密码加密规则: MD5( MD5(明文密码) + randCode )
            if rand_code:
                enc_pwd = self._md5(self._md5(password) + rand_code)
            else:
                enc_pwd = self._md5(password)

            payload = {
                "username": student_id,
                "password": enc_pwd,
                "captcha":  captcha,
                # 部分版本字段名不同，全发一遍
                "verifyCode": captcha,
                "randCode":   rand_code,
                "userType":   "student",
            }

            try:
                resp = self._post("/login", data=payload)
                data = resp.json()
            except Exception:
                # 有些版本登录成功后直接 302 跳转，不返回 JSON
                if "个人信息" in resp.text or "studentInfo" in resp.text:
                    print("[登录] 成功（页面跳转模式）")
                    self.is_logged_in = True
                    return True
                print(f"[登录] 响应解析失败，原始内容: {resp.text[:200]}")
                continue

            # 判断登录结果
            if data.get("code") in ("200", 200) or data.get("result") == "success":
                print(f"[登录] 成功！学号: {student_id}")
                self.is_logged_in = True
                return True

            msg = data.get("msg") or data.get("message") or str(data)
            print(f"[登录] 失败: {msg}")

            if "验证码" in msg or "captcha" in msg.lower():
                print("[登录] 验证码错误，重试...")
                continue
            else:
                # 账号密码错误，不用重试
                break

        print("[登录] 登录失败，请检查学号/密码")
        return False

    # ── 获取学期列表 ─────────────────────────────────────────────────────────

    def get_semesters(self) -> list[dict]:
        """获取所有学期，返回列表，第一个通常是当前学期"""
        assert self.is_logged_in, "请先登录"
        try:
            resp = self._get("/student/courseTable/semester/getSemesters")
            data = resp.json()
            sems = data.get("data") or data.get("semesters") or data
            if isinstance(sems, list):
                print(f"[学期] 共 {len(sems)} 个学期")
                return sems
        except Exception as e:
            print(f"[学期] 获取失败: {e}")
        return []

    # ── 获取课表 ─────────────────────────────────────────────────────────────

    def get_course_table(self, semester_id: Optional[str] = None) -> list[dict]:
        """
        获取课表
        Args:
            semester_id: 学期ID，None = 自动取当前学期
        Returns:
            课程列表
        """
        assert self.is_logged_in, "请先登录"

        # 自动获取当前学期
        if not semester_id:
            sems = self.get_semesters()
            if sems:
                semester_id = sems[0].get("id") or sems[0].get("xnxqId")
                print(f"[课表] 使用学期: {sems[0].get('name') or semester_id}")

        params = {"xnxqId": semester_id} if semester_id else {}

        # 强智课表接口（不同版本路径略有差异，逐个尝试）
        endpoints = [
            "/student/courseTable/getCourseTableForStudent",
            "/student/courseTable/info",
            "/jwglxt/kbcx/xskbcx_cxXsKb.html",
        ]

        for ep in endpoints:
            try:
                resp = self._get(ep, params=params)
                data = resp.json()
                courses_raw = (
                    data.get("kbList")        # 旧版
                    or data.get("data")
                    or data.get("courseList")
                    or data.get("list")
                    or (data if isinstance(data, list) else [])
                )
                if courses_raw:
                    courses = [self._parse_course(c) for c in courses_raw]
                    print(f"[课表] 共 {len(courses)} 门次课程")
                    return courses
            except Exception as e:
                print(f"[课表] 接口 {ep} 失败: {e}")

        print("[课表] 所有接口均失败")
        return []

    def _parse_course(self, raw: dict) -> dict:
        """统一解析不同版本的课程字段"""
        return {
            "name":    raw.get("kcmc") or raw.get("courseName") or raw.get("name") or "未知课程",
            "teacher": raw.get("jsxm") or raw.get("teacherName") or raw.get("teacher") or "",
            "room":    raw.get("cdmc") or raw.get("roomName") or raw.get("room") or "",
            "day":     int(raw.get("xqj") or raw.get("dayOfWeek") or raw.get("weekDay") or 0),
            "node":    raw.get("jcor") or raw.get("node") or raw.get("sections") or "",
            "weeks":   raw.get("zcd")  or raw.get("weeks") or raw.get("weekRange") or "",
            "credit":  raw.get("xf")   or raw.get("credit") or "",
            "_raw":    raw,  # 保留原始数据
        }

    # ── 获取成绩 ─────────────────────────────────────────────────────────────

    def get_grades(self, semester_id: Optional[str] = None) -> list[dict]:
        """获取成绩单"""
        assert self.is_logged_in, "请先登录"

        params = {"xnxqId": semester_id} if semester_id else {}
        endpoints = [
            "/student/integratedQuery/score/scoreList/callback",
            "/student/courseTable/score/getScoreList",
            "/jwglxt/cjcx/cjcx_cxXsAllCjList.html",
        ]

        for ep in endpoints:
            try:
                resp = self._get(ep, params=params)
                data = resp.json()
                grades_raw = data.get("list") or data.get("data") or data.get("scoreList") or []
                if grades_raw:
                    grades = [self._parse_grade(g) for g in grades_raw]
                    print(f"[成绩] 共 {len(grades)} 条记录")
                    return grades
            except Exception as e:
                print(f"[成绩] 接口 {ep} 失败: {e}")
        return []

    def _parse_grade(self, raw: dict) -> dict:
        return {
            "name":   raw.get("kcmc") or raw.get("courseName") or "",
            "score":  raw.get("cj")   or raw.get("score") or raw.get("finalScore") or "",
            "credit": raw.get("xf")   or raw.get("credit") or "",
            "gpa":    raw.get("jd")   or raw.get("gpa") or "",
            "term":   raw.get("xnxqmc") or raw.get("termName") or "",
            "_raw":   raw,
        }

    # ── 获取空教室 ────────────────────────────────────────────────────────────

    def get_empty_rooms(
        self,
        building: str = "",
        day: int = 1,
        node: str = "1-2",
        semester_id: Optional[str] = None,
    ) -> list[dict]:
        """
        查询空教室
        Args:
            building:    楼栋编号，如 "J1"
            day:         星期几 1-7
            node:        节次，如 "1-2"
            semester_id: 学期ID
        """
        assert self.is_logged_in, "请先登录"

        params = {
            "xqjmc": building,
            "xqj":   day,
            "jc":    node,
            "xnxqId": semester_id or "",
        }
        endpoints = [
            "/student/courseTable/classroom/getEmptyClassroomList",
            "/jwglxt/cdjy/cdjy_cxKxcdlb.html",
        ]

        for ep in endpoints:
            try:
                resp = self._get(ep, params=params)
                data = resp.json()
                rooms_raw = data.get("list") or data.get("data") or []
                if rooms_raw:
                    rooms = [self._parse_room(r) for r in rooms_raw]
                    print(f"[空教室] 共 {len(rooms)} 间")
                    return rooms
            except Exception as e:
                print(f"[空教室] 接口 {ep} 失败: {e}")
        return []

    def _parse_room(self, raw: dict) -> dict:
        return {
            "room":     raw.get("cdmc") or raw.get("roomName") or "",
            "building": raw.get("jxlmc") or raw.get("building") or "",
            "seats":    raw.get("zws")   or raw.get("capacity") or "",
            "_raw":     raw,
        }


# ── 数据保存 ──────────────────────────────────────────────────────────────────

def save_json(data: any, filename: str):
    os.makedirs("output", exist_ok=True)
    path = os.path.join("output", filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[保存] 已写入 {path}")


# ── 主程序 ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("  强智教务系统爬虫")
    print("=" * 50)

    # ── 配置（从环境变量读取）────────────────────────────
    BASE_URL    = os.environ.get("JWXT_BASE_URL", "https://jw.educationgroup.cn")
    STUDENT_ID  = os.environ.get("JWXT_USERNAME", "")
    PASSWORD    = os.environ.get("JWXT_PASSWORD", "")
    # ─────────────────────────────────────────────────────

    if not STUDENT_ID or not PASSWORD:
        print("[错误] 请设置环境变量 JWXT_USERNAME 和 JWXT_PASSWORD")
        return

    crawler = JWXTCrawler(BASE_URL)

    # 1. 登录
    if not crawler.login(STUDENT_ID, PASSWORD):
        print("[错误] 登录失败，程序退出")
        return

    # 2. 获取学期列表
    semesters = crawler.get_semesters()
    if semesters:
        save_json(semesters, "semesters.json")
        current_sem_id = semesters[0].get("id") or semesters[0].get("xnxqId")
    else:
        current_sem_id = None

    # 3. 获取课表
    courses = crawler.get_course_table(current_sem_id)
    if courses:
        save_json(courses, "courses.json")
        print("\n── 今日课程预览 ──")
        from datetime import datetime
        today_weekday = datetime.now().isoweekday()  # 1=周一 … 7=周日
        today_courses = [c for c in courses if c["day"] == today_weekday]
        for c in today_courses:
            print(f"  {c['name']} | {c['room']} | {c['node']}节 | {c['teacher']}")
        if not today_courses:
            print("  今天没有课 🎉")

    # 4. 获取成绩
    grades = crawler.get_grades(current_sem_id)
    if grades:
        save_json(grades, "grades.json")

    # 5. 查询空教室示例（J1楼，周一，第1-2节）
    empty = crawler.get_empty_rooms(building="J1", day=1, node="1-2",
                                    semester_id=current_sem_id)
    if empty:
        save_json(empty, "empty_rooms.json")

    print("\n[完成] 数据已保存到 output/ 目录")


if __name__ == "__main__":
    main()

"""
定时同步脚本
可以：
  1. 直接用 cron 在本机每天运行
  2. 部署到 Vercel Serverless Function + Cron Jobs（免费）
  3. 部署到 GitHub Actions（免费）
"""

import json
import os
import time
from datetime import datetime
from crawler import JWXTCrawler, save_json

# ── 从环境变量读取敏感信息（部署时用，不要把密码写在代码里）────────────────
BASE_URL   = os.environ.get("JWXT_URL",      "https://jw.educationgroup.cn")
STUDENT_ID = os.environ.get("JWXT_USER",     "你的学号")
PASSWORD   = os.environ.get("JWXT_PASSWORD", "你的密码")


def sync_all():
    """同步所有数据并返回结果字典"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 开始同步...")

    crawler = JWXTCrawler(BASE_URL)

    if not crawler.login(STUDENT_ID, PASSWORD):
        return {"ok": False, "error": "登录失败"}

    sems    = crawler.get_semesters()
    sem_id  = (sems[0].get("id") or sems[0].get("xnxqId")) if sems else None

    courses = crawler.get_course_table(sem_id)
    grades  = crawler.get_grades(sem_id)

    result = {
        "synced_at": datetime.now().isoformat(),
        "semester":  sems[0] if sems else {},
        "courses":   courses,
        "grades":    grades,
    }

    save_json(result, "sync_result.json")
    print(f"[同步完成] 课程 {len(courses)} 条 / 成绩 {len(grades)} 条")
    return {"ok": True, **result}


# ── Vercel Serverless Handler（部署到 Vercel 时使用）─────────────────────────
def handler(request, response):
    """Vercel Python Serverless Function 入口"""
    data = sync_all()
    response.status_code = 200 if data["ok"] else 500
    return response.json(data)


# ── 本地 cron 模式 ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 每天凌晨 2 点同步一次
    SYNC_HOUR = 2

    print("定时同步启动，每天凌晨 02:00 自动同步课表")
    while True:
        now = datetime.now()
        if now.hour == SYNC_HOUR and now.minute == 0:
            sync_all()
            time.sleep(61)  # 避免同一分钟重复触发
        else:
            # 每分钟检查一次
            time.sleep(60)

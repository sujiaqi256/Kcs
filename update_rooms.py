"""
空教室自动更新调度器
基于 jwxt.py 的 JWXT 类，定时调用 crawl_update 更新空教室数据
调度时间：每天 00:00 / 08:00 / 14:00 / 18:30
"""

import sys
import time
import signal
from datetime import datetime

from jwxt import JWXT

SCHEDULE = [(0, 0), (8, 0), (14, 0), (18, 30)]


def run_update():
    now = datetime.now()
    print(f"\n{'='*50}")
    print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] 开始更新空教室...")
    print(f"{'='*50}")

    jw = JWXT()

    # 尝试复用已保存的 Cookie
    if not jw.load_cookies():
        if not jw.login():
            print("[错误] 登录失败")
            return False

    # 增量更新：当前周 + 接下来2周
    jw.crawl_update(ahead_weeks=2)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 更新完成!")
    return True


if __name__ == "__main__":
    # Ctrl+C 优雅退出
    signal.signal(signal.SIGINT, lambda *_: (print("\n已停止"), sys.exit(0)))

    if "--now" in sys.argv:
        run_update()
    else:
        print("空教室定时更新已启动")
        print(f"调度: {', '.join(f'{h:02d}:{m:02d}' for h, m in SCHEDULE)}")
        print("Ctrl+C 停止\n")
        while True:
            now = datetime.now()
            for h, m in SCHEDULE:
                if now.hour == h and now.minute == m:
                    run_update()
                    time.sleep(61)
                    break
            time.sleep(30)

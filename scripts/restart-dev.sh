#!/bin/bash
# راه‌اندازی مقاوم سرور توسعه رصدبان — مستقل از شل والد
cd /home/z/my-project
export HOME=/home/z
setsid nohup bun run dev >> dev-run.log 2>&1 < /dev/null &
echo "launched pid $!"

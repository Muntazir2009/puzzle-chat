#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..." >> /home/z/my-project/dev.log
  bun --bun run dev >> /home/z/my-project/dev.log 2>&1
  echo "[$(date)] Dev server exited. Restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done

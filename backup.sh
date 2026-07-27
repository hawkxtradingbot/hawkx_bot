#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /root/hawkx_bot/hawkx_mainnet.db /root/hawkx_backups/hawkx_${TIMESTAMP}.db
# Keep only the last 48 hourly backups (2 days)
ls -t /root/hawkx_backups/hawkx_*.db | tail -n +49 | xargs -r rm --
echo "[Backup] $(date) — snapshot saved: hawkx_${TIMESTAMP}.db"

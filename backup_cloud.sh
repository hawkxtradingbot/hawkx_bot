#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB=/root/hawkx_bot/hawkx_mainnet.db
TMP=/tmp/hawkx_${TIMESTAMP}.db
cp "$DB" "$TMP"
# Encrypt with AES-256 using a passphrase (stored in a protected file)
PASS=$(cat /root/.backup_pass)
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TMP" -out "${TMP}.enc" -pass pass:"$PASS"
# Upload encrypted file to B2
b2 file upload hawkx-backups "${TMP}.enc" "daily/hawkx_${TIMESTAMP}.db.enc"
# Cleanup
rm -f "$TMP" "${TMP}.enc"
echo "[CloudBackup] $(date) — uploaded hawkx_${TIMESTAMP}.db.enc"

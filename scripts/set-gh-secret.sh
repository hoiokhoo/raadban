#!/usr/bin/env bash
# تنظیم Secret گیت‌هاب با رمزنگاری libsodium sealed-box
# استفاده: GH_TOKEN=<token> bash scripts/set-gh-secret.sh <secret-name> <secret-value> [repo]
# توکن هرگز داخل این فایل نوشته نمی‌شود (محافظت پوش گیت‌هاب توکن‌های خام را رد می‌کند)
set -euo pipefail
NAME="$1"; VALUE="$2"; REPO="${3:-hoiokhoo/raadban}"
TOK="${GH_TOKEN:-$(git remote get-url origin | sed -n 's#https://[^:]*:\([^@]*\)@github.com.*#\1#p')}"
[ -n "$TOK" ] || { echo "توکن یافت نشد — GH_TOKEN را ست کنید"; exit 1; }

# ۱) کلید عمومی مخزن
curl -sS -H "Authorization: token $TOK" -H "User-Agent: raadban" \
  "https://api.github.com/repos/$REPO/actions/secrets/public-key" > /tmp/gh-pk.json

# ۲) رمزنگاری با پایتون (فقط محاسبات محلی)
python3 - "$NAME" "$VALUE" <<'EOF'
import json, base64, sys
from nacl import encoding, public
name, value = sys.argv[1], sys.argv[2]
pk = json.load(open('/tmp/gh-pk.json'))
box = public.SealedBox(public.PublicKey(pk['key'].encode(), encoding.Base64Encoder()))
enc = base64.b64encode(box.encrypt(value.encode())).decode()
json.dump({'encrypted_value': enc, 'key_id': pk['key_id']}, open('/tmp/gh-secret.json', 'w'))
print('encrypted ok for', name)
EOF

# ۳) PUT سِکرِت
CODE=$(curl -sS -o /tmp/gh-put.out -w "%{http_code}" -X PUT \
  -H "Authorization: token $TOK" -H "User-Agent: raadban" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/actions/secrets/$NAME" \
  -d @/tmp/gh-secret.json)
echo "PUT $NAME -> HTTP $CODE"
[ "$CODE" = "201" ] || [ "$CODE" = "204" ] || { cat /tmp/gh-put.out; exit 1; }
rm -f /tmp/gh-pk.json /tmp/gh-secret.json /tmp/gh-put.out

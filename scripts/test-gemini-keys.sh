#!/usr/bin/env bash
# آزمودن کلیدهای جمینی — کلیدها از /tmp/gemini-keys.json خوانده می‌شوند (هرگز داخل مخزن نیستند)
# ساخت فایل: آرایهٔ JSON کلیدها را در /tmp/gemini-keys.json بگذارید (chmod 600)
# برای هر کلید: ۱) فهرست مدل‌ها ۲) generateContent بومی ۳) نقطهٔ پایانی سازگار با OpenAI (مسیر زنجیرهٔ برنامه)
# کلید هرگز چاپ نمی‌شود — فقط اندیس و نتیجه
set -u
F="${GEMINI_KEYS_FILE:-/tmp/gemini-keys.json}"
[ -f "$F" ] || { echo "فایل کلیدها یافت نشد: $F"; exit 1; }
mapfile -t KEYS < <(python3 -c "import json;[print(k) for k in json.load(open('$F'))]")
MODEL="${GEMINI_TEST_MODEL:-gemini-3.5-flash}"
i=0
for KEY in "${KEYS[@]}"; do
  i=$((i+1))
  echo "=== کلید $i ==="
  # ۱) فهرست مدل‌ها — اعتبارسنجی کلید
  LIST=$(curl -sS -m 20 -o /tmp/gm-list.json -w "%{http_code}" \
    -H "x-goog-api-key: $KEY" \
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=5" 2>/tmp/gm-err.txt || echo "CURL_FAIL")
  echo "  models list: HTTP $LIST"
  if [ "$LIST" = "200" ]; then
    python3 -c "import json;d=json.load(open('/tmp/gm-list.json'));print('  models:', ','.join(m['name'].replace('models/','') for m in d.get('models',[]))[:160])" 2>/dev/null
  fi
  # ۲) generateContent بومی
  NAT=$(curl -sS -m 40 -o /tmp/gm-native.json -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" -H "x-goog-api-key: $KEY" \
    "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent" \
    -d '{"contents":[{"parts":[{"text":"فقط بنویس: سالم"}]}],"generationConfig":{"maxOutputTokens":512}}' 2>/dev/null || echo "CURL_FAIL")
  echo "  native $MODEL: HTTP $NAT"
  if [ "$NAT" != "200" ]; then
    head -c 300 /tmp/gm-native.json 2>/dev/null; echo
  else
    python3 -c "import json;d=json.load(open('/tmp/gm-native.json'));print('  reply:', (d.get('candidates',[{}])[0].get('content',{}).get('parts',[{}])[0].get('text','') or '')[:60].replace(chr(10),' '))" 2>/dev/null
  fi
  # ۳) سازگار با OpenAI — مسیری که زنجیرهٔ برنامه استفاده می‌کند
  OAI=$(curl -sS -m 40 -o /tmp/gm-oai.json -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
    -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"فقط بنویس: سالم\"}],\"max_tokens\":512}" 2>/dev/null || echo "CURL_FAIL")
  echo "  openai-compat: HTTP $OAI"
  if [ "$OAI" != "200" ]; then
    head -c 300 /tmp/gm-oai.json 2>/dev/null; echo
  else
    python3 -c "import json;d=json.load(open('/tmp/gm-oai.json'));print('  reply:', (d.get('choices',[{}])[0].get('message',{}).get('content','') or '')[:60].replace(chr(10),' '))" 2>/dev/null
  fi
done

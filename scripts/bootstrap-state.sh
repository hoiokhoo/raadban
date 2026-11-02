#!/bin/bash
# بازسازی سریع وضعیت پس از ریست سندباکس (منابع، رویدادها، دیتابیس)
# اجرا: bash scripts/bootstrap-state.sh
set -e
cd "$(dirname "$0")/.."
echo "— ۱) بازسازی ۷۷ منبع از bot/sources.json —"
bun scripts/restore-sources-from-bot.ts
echo "— ۲) seed رویدادهای مستند پیش رو —"
bun scripts/seed-events.ts | tail -2
echo "— ۳) خلاصه —"
bun -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.source.count().then(c=>console.log('منابع:',c)).then(()=>p.majorEvent.count()).then(c=>{console.log('رویدادها:',c);process.exit(0)})"
if [ ! -s ".env" ] || ! grep -q "BALE_BOT_TOKEN" .env; then
  echo "⚠️ .env کلیدها ندارد — پس از هر بازیابی سندباکس، کلیدها (BALE_BOT_TOKEN/BALE_CHAT_ID/OPENROUTER_API_KEY) را دوباره وارد کنید."
fi
echo "— ۴) بازپُری زبان پست‌ها با تشخیص اصلاح‌شده —"
bun scripts/backfill-post-language.ts

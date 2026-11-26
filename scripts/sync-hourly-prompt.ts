// همگام‌سازی کلید «hourly» در bot/prompts.json با پیش‌فرض تازهٔ bot/hourly.ts —
// گارد تستِ «سایه‌اندازی کهنه نماند» برابری کامل را می‌سنجد (نوامبر ۲۶).
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SYSTEM_HOURLY } from '../bot/hourly';

const file = 'bot/prompts.json';
const raw = JSON.parse(readFileSync(file, 'utf8'));
raw.hourly = DEFAULT_SYSTEM_HOURLY;
writeFileSync(file, JSON.stringify(raw, null, 2) + '\n', 'utf8');
console.log('hourly prompts.json هم‌متن پیش‌فرض شد —', DEFAULT_SYSTEM_HOURLY.length, 'نویسه');

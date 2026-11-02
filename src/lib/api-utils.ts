/**
 * اعتبارسنجی و پاسخ‌های استاندارد API
 * - همه ورودی‌ها اعتبارسنجی می‌شوند
 * - سقف طول فیلدها
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function err500(e: unknown, context: string) {
  const msg = e instanceof Error ? e.message : 'خطای ناشناخته';
  console.error(`[api] ${context}:`, msg);
  return fail(`خطای سرور در ${context}: ${msg.slice(0, 300)}`, 500);
}

// ---------- اسکیماهای zod ----------

const PLATFORMS = ['telegram', 'eitaa', 'bale', 'rss', 'web'];

export const sourceCreateSchema = z.object({
  name: z.string().min(2, 'نام منبع حداقل ۲ نویسه').max(120),
  platform: z.enum(PLATFORMS),
  identifier: z.string().min(2, 'شناسه منبع حداقل ۲ نویسه').max(400),
  url: z.string().max(600).optional().or(z.literal('')),
  categoryIds: z.array(z.string().max(60)).max(12).optional(),
  priority: z.enum(['بالا', 'عادی', 'پایین']).optional(),
  language: z.enum(['fa', 'ar', 'en', 'he', 'zh', 'ru', 'tr', 'ur', 'hi']).optional(),
  region: z.string().max(60).optional(),
  topic: z.string().max(120).optional(),
  entityType: z.enum(['رسانه', 'شخصیت', 'نهاد رسمی']).optional(),
  politicalOrientation: z.string().max(120).optional().or(z.literal('')),
  trustNote: z.string().max(600).optional().or(z.literal('')),
  notes: z.string().max(600).optional().or(z.literal('')),
  fetchIntervalMin: z.number().int().min(5).max(1440).optional(),
  maxItemsPerFetch: z.number().int().min(1).max(60).optional(),
});

export const sourceUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(120).optional(),
  url: z.string().max(600).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string().max(60)).max(12).optional(),
  priority: z.enum(['بالا', 'عادی', 'پایین']).optional(),
  language: z.enum(['fa', 'ar', 'en', 'he', 'zh', 'ru', 'tr', 'ur', 'hi']).optional(),
  region: z.string().max(60).optional(),
  topic: z.string().max(120).optional(),
  entityType: z.enum(['رسانه', 'شخصیت', 'نهاد رسمی']).optional(),
  politicalOrientation: z.string().max(120).optional().or(z.literal('')),
  trustNote: z.string().max(600).optional().or(z.literal('')),
  notes: z.string().max(600).optional().or(z.literal('')),
  fetchIntervalMin: z.number().int().min(5).max(1440).optional(),
  maxItemsPerFetch: z.number().int().min(1).max(60).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2, 'نام دسته حداقل ۲ نویسه').max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'شناسه فقط حروف لاتین کوچک، رقم و خط تیره'),
  description: z.string().max(600).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'رنگ باید hex باشد').optional(),
  // پرامپت تخصصی دسته می‌تواند مفصل باشد (نمونه: پرامپت خودرو ~۷هزار نویسه)
  promptTemplate: z.string().max(12000).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

// ورود دستی مطلب — مسیر مجاز جایگزین وقتی دسترسی خودکار به منبع ممکن نیست
export const manualPostSchema = z.object({
  content: z.string().min(40, 'متن مطلب حداقل ۴۰ نویسه').max(20000, 'سقف متن ۲۰هزار نویسه'),
  title: z.string().max(300).optional(),
  url: z.string().max(600).optional().or(z.literal('')),
  sourceId: z.string().max(60).optional().or(z.literal('')),
});

// زنجیره مدل‌های جایگزین (failover) — تعریف سفارشی کاربر؛ کلیدها رمزنگاری‌شده سمت سرور می‌مانند
export const providerEntrySchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().max(80).optional(),
  baseUrl: z.string().max(300).optional(),
  apiKey: z.string().max(300).optional(),
  model: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
});

export const settingsSchema = z.object({
  ai_model: z.string().max(80).optional(),
  ai_budget: z.object({ dailyTokenLimit: z.number().int().min(1000).max(50_000_000) }).optional(),
  ai_providers: z.array(providerEntrySchema).max(12).optional(),
  schedule: z.object({
    enabled: z.boolean().optional(),
    reportTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت باید HH:mm باشد'),
    activeDays: z.array(z.number().int().min(0).max(6)).max(7),
    catchUp: z.boolean().optional(),
    autoFactcheck: z.boolean().optional(),
    timezone: z.string().max(50).optional(),
  }).optional(),
});

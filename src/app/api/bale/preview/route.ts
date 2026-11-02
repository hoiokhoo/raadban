/**
 * پیش‌نمایش لیست نهایی ارسال به بله — فقط‌خواندنی، بدون عوارض جانبی
 * (بدون ارسال، بدون علامت‌زدن ضدتکرار، بدون فراخوانی مدل و جست‌وجو)
 */
import { ok, err500 } from '@/lib/api-utils';
import { previewBaleDigest } from '@/lib/bale-digest';

export async function GET() {
  try {
    const preview = await previewBaleDigest();
    return ok(preview);
  } catch (e) { return err500(e, 'پیش‌نمایش ارسال بله'); }
}

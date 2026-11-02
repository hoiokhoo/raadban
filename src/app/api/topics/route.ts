/**
 * آمار موضوعی اخبار — T9
 * GET → شمارش پست در هر موضوع + تعداد بی‌موضوع
 */
import { ok, err500 } from '@/lib/api-utils';
import { topicStats, uncategorizedCount } from '@/lib/pipeline/topics';

export async function GET() {
  try {
    const [topics, uncategorized] = await Promise.all([topicStats(), uncategorizedCount()]);
    return ok({ topics, uncategorized });
  } catch (e) { return err500(e, 'آمار موضوعی'); }
}

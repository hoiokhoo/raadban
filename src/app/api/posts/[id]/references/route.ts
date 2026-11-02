/**
 * تحلیل رفرنس‌های یک پست — T9
 * POST /api/posts/[id]/references → استخراج + تطبیق درون‌پایگاه + داوری AI
 */
import { ok, err500 } from '@/lib/api-utils';
import { analyzePostReferences } from '@/lib/pipeline/references';
import { NextRequest } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await analyzePostReferences(id);
    return ok(r);
  } catch (e) { return err500(e, 'تحلیل رفرنس‌ها'); }
}

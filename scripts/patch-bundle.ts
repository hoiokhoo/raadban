/**
 * وصلهٔ یک‌بارمصرف bot/bundle.ts — حذف سربرگ «🕒 اخبار …» از buildBundleChunks
 * (خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶). پس از اجرا و بررسی، حذف می‌شود.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const P = 'bot/bundle.ts';
let s = readFileSync(P, 'utf8');
const orig = s;

// ۱) حذف بلوک سربرگ — با انکرهای ASCII ایمن
const anchor1 = "  const maxLen = Math.max(1200, opts.maxLen ?? 3300);\n  if (items.length === 0) return [];\n";
const i1 = s.indexOf(anchor1);
if (i1 < 0) throw new Error('anchor1 not found');
const startHeader = s.indexOf('  //', i1); // نخستین کامنت بعد از anchor1 (سربرگ خنثی)
const piecesAnchor = '  const pieces: string[] = [];';
const iPieces = s.indexOf(piecesAnchor, startHeader);
if (startHeader < 0 || iPieces < 0) throw new Error('header block bounds not found');
s = s.slice(0, startHeader) + piecesAnchor + s.slice(iPieces + piecesAnchor.length);

// ۲) بازگشت قطعه‌ها بدون سربرگ — انکر: «return pieces.map((c, i) => {» در buildBundleChunks
const iMap = s.indexOf('return pieces.map((c, i) => {', i1);
if (iMap < 0) throw new Error('map block not found');
const iEnd = s.indexOf('});', iMap);
if (iEnd < 0) throw new Error('map block end not found');
const replacement = [
  'return pieces.map((c, i) => {',
  '    if (n <= 1) return c;',
  '    if (i === 0) return `${c}\\n\\n${DIVIDER}\\n\\n— ادامه`;',
  '    return `— ادامه\\n\\n${c}`;',
  '  }',
].join('\n');
// محدودهٔ دقیق: از iMap تا پایان «  });» (شامل دو فاصلهٔ تودرتو)
const iEndFull = s.indexOf('  });', iMap);
if (iEndFull < 0) throw new Error('map full end not found');
s = s.slice(0, iMap) + replacement + s.slice(iEndFull);

// ۳) توضیح تابع — انکر ASCII «با سربرگ و شمارهٔ بخش»
const iDoc = s.indexOf('با سربرگ و شمارهٔ بخش.');
if (iDoc >= 0) {
  const docStart = s.lastIndexOf('/**', iDoc);
  const docEnd = s.indexOf('*/', iDoc) + 2;
  s =
    s.slice(0, docStart) +
    '/** ساخت پیام‌های بست — گروه‌بندی موارد در قطعه‌های ≤ maxLen.\n' +
    ' *  خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶: سربرگ «🕒 اخبار …» حذف شد — پیام با خودِ خبرها آغاز می‌شود و\n' +
    ' *  بخش‌های ادامه فقط نشانگر «— ادامه» دارند. هر مورد هرگز نصف نمی‌شود مگر آنکه تنها و\n' +
    ' *  بزرگ‌تر از سقف باشد (آنگاه درون همان بخش شکسته می‌شود). */' +
    s.slice(docEnd);
}

writeFileSync(P, s);
console.log('patched:', s !== orig, '| len', orig.length, '→', s.length);

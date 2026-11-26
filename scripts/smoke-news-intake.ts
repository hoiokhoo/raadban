// آزمون دودی ماژول ورودی خبر با نمونه‌های واقعی کاربر (۲۶ نوامبر)
import {
  isAdOrPromo, isTweetRelayNews, importanceScore, filterByImportance,
  attributionOf, historyConsistencyOf, intakeVerdict, filterNewsIntake,
} from '../bot/news-intake';

// نمونهٔ ۱ — خبر واقعی ایسنا (باید سالم بماند)
const isna = 'خبرگزاری ایسنا: گلایه کارکنان بیمارستان رحیمیان از کمبود تجهیزات و فضای اداری کارکنان بیمارستان رحیمیان ضمن ابراز نگرانی از وضعیت موجود در این مرکز درمانی، نسبت به کمبود فضا در بخش‌های اداری و درمانگاه هشدار دادند.';
// نمونهٔ ۲ — توییت‌نمای لیبرمن از ایلنا (خبر واقعی ولی روایت توییت نیست — باید بماند؟ متن درباره رسانه‌ها است نه توییت شخص)
const lieberman = 'خبرگزاری ایلنا: لیبرمن در آستانه بازگشت به وزارت جنگ؛ جزئیات تازه از دولت احتمالی آیزنکوت رسانه‌های رژیم صهیونیستی از توافق اولیه گادی آیزنکوت و آویگدور لیبرمن برای تشکیل ائتلاف سیاسی خبر دادند؛ توافقی که بر اساس آن، لیبرمن ممکن است بار دیگر وزارت جنگ را برعهده بگیرد و سهم دیگر احزاب از کابینه نیز مشخص شود.';
// نمونهٔ ۳ — تبلیغ درخواست کمک واقعی کاربر (باید رد شود)
const donation = `🚨 #فوری کار میدان #مردمی زمین مونده
✋عزیزان و هموطنان انقلابی #خیابان و #میدان به کمک شما نیاز دارد 🎥تصویر بالا ماشین لیدری انقلاب #مردمی تو تجمعات و پیاده روی این شبهاست،که بعد ۸ ماه حضور #سیستم_صوتش بخاطر فشار و استفاده  این شبها🥲 و نیاز به  تعمیر و بخصوص تجهیز داره
 این خودرو و تجمع تماما #مردمی و سیستم هم برای هیئت ،و پشتوانش فقط مردم هستن
در حد توان یاعلی بگید از یک تا چند سهم، الان از دستگاه ضعیف امانتی استفاده میکنیم که جوابگو نیست
 منتظر کمک های شما هستیم
کلیک کنید رو کارت کپی میشه🔻
کارت🔺شبا🔻 حقوقی  🔻رسمی
✅ به نام #گروه‌جهادی_شهدای_مقاومت|سپه
 ▪️ 5892107050175168
▪️ IR400150000003101104472113
✅ آخرین فرصت که میتونید شما هم شریک بشید
فقط #۵۰۰ نفر زن و مرد یاعلی بگید نفری به نیت امام زمان عج #۳۱۳هزار تومان نیت کنید که ان شالله مشکل رفع بشه
✅ارتباط با خادم  و اعلام سهم و سوالات شما🔻
@mokeb_2
📞 09010252299`;
// نمونهٔ ۴ — خبر کم‌اهمیت ثبت‌نام اعتکاف
const etekaf = 'خبرآنلاین: آغاز ثبت‌نام اعتکاف ۱۴۰۵ در فارس از ۷ آذرماه دبیر ستاد مردمی اعتکاف استان فارس، از آغاز ثبت‌نام مراسم اعتکاف سال ۱۴۰۵ در استان فارس از هفتم آذرماه خبر داد و گفت: اعتکاف امسال با شعار «اعتکاف؛ راهبرد امام شهید، رسالت امت مبعوث» و با برنامه‌های فرهنگی، تبلیغی و معرفتی در مساجد استان برگزار می‌شود.';
// نمونهٔ ۵ — خبر مهم نفتکش دبی
const tanker = 'خبرگزاری مهر: سازمان دریانوردی انگلیس: انفجار پرتابه ناشناس در یک نفتکش در غرب دبی سازمان دریانوردی انگلیس از وقوع انفجاری ناشی از یک پرتابه ناشناس در یک نفتکش، در فاصله ۵۰ مایل دریایی غرب دبی خبر داد.';
// نمونهٔ ۶ — توییت‌نمای کوتاه (باید رد شود — بخش توییت خودمان هست)
const tweetRelay = 'ترامپ در توییتر نوشت: ایران هرگز به بمب هسته‌ای دست نخواهد یافت.';
// نمونهٔ ۷ — ارجاع بلومبرگ
const bessent = 'DW Persian: وزیر خزانه‌داری آمریکا: کشتی جمهوری اسلامی در حال غرق شدن است اسکات بسنت، وزیر خزانه‌داری آمریکا در پیامی اعلام کرد که ایران از زمان آغاز عملیات "طرد اقتصادی" دولت آمریکا در ماه اوت، حتی یک نفتکش را هم بارگیری نکرده و دیگر حتی یک قطره نفت هم روی آب برای فروش ندارد. به نقل از بلومبرگ، این اظهارات در جلسه گفت‌وگو با سرمایه‌گذاران مطرح شد.';
// نمونهٔ ۸ — تاریخ ناساز
const badHist = 'بازتاب دهه‌ها پس از جنگ جهانی دوم: این واقعه در سال ۲۰۰۳ آغاز شد و جهان را تغییر داد.';
const okHist = 'انقلاب اسلامی در سال ۱۳۵۷ به پیروزی رسید.';
const badHist2 = 'برجام در سال ۱۳۹۲ به امضا رسید.';

console.log('== ضدتبلیغ ==');
console.log('ایسنا (خبر واقعی):', isAdOrPromo(isna));
console.log('تبلیغ کمک (باید ad):', isAdOrPromo(donation));
console.log('لیبرمن:', isAdOrPromo(lieberman));
console.log('اعتکاف:', isAdOrPromo(etekaf));
console.log('نفتکش:', isAdOrPromo(tanker));
console.log('بسنت:', isAdOrPromo(bessent));
console.log('== توییت‌نما ==');
console.log('ترامپ توییت (باید رد):', isTweetRelayNews(tweetRelay));
console.log('لیبرمن (باید بماند):', isTweetRelayNews(lieberman));
console.log('== اهمیت ==');
console.log('ایسنا:', importanceScore(isna));
console.log('لیبرمن:', importanceScore(lieberman));
console.log('اعتکاف (باید پایین):', importanceScore(etekaf));
console.log('نفتکش (باید بالا):', importanceScore(tanker));
console.log('بسنت:', importanceScore(bessent));
console.log('توییت‌نما:', importanceScore(tweetRelay));
console.log('== ارجاع ==');
console.log('بسنت/بلومبرگ:', attributionOf(bessent));
console.log('ایسنا (null):', attributionOf(isna));
console.log('== تاریخ ==');
console.log('جنگ جهانی دوم ۲۰۰۳ (باید ناساز):', historyConsistencyOf(badHist));
console.log('انقلاب ۱۳۵۷ (باید ساز):', historyConsistencyOf(okHist));
console.log('برجام ۱۳۹۲ (باید ناساز):', historyConsistencyOf(badHist2));
console.log('== حکم یکپارچه ==');
console.log('ایسنا:', intakeVerdict(isna));
console.log('تبلیغ:', intakeVerdict(donation).reason);
console.log('توییت‌نما:', intakeVerdict(tweetRelay).reason);
console.log('== پالایهٔ دسته‌ای ==');
const batch = [{ text: isna }, { text: donation }, { text: tweetRelay }, { text: etekaf }, { text: tanker }, { text: bessent }, { text: lieberman }, { text: badHist }];
const res = filterNewsIntake(batch, { threshold: 55, minKeep: 3 });
console.log('ماند:', res.kept.map((x) => x.text.slice(0, 40)));
console.log('رد تبلیغ:', res.droppedAds.length, '| توییت‌نما:', res.droppedTweetRelay.length, '| تاریخ:', res.droppedHistory.length, '| کم‌اهمیت:', res.droppedLowImportance.map((x) => x.text.slice(0, 30)));
console.log('== سهمیهٔ حداقل (روز بی‌خبر) ==');
const quiet = [{ text: etekaf }, { text: isna }];
const q = filterByImportance(quiet, { threshold: 55, minKeep: 1 });
console.log('ماند در سکوت:', q.kept.length, 'از', quiet.length);

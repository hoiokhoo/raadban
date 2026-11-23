#!/usr/bin/env python3
"""واکشی مستقیم صفحات باما (همان کاری که ربات در زمان اجرا می‌کند) — راستی‌آزمایی بازار+کارخانه برای هر اسلاگ منتخب."""
import re, sys, urllib.request, concurrent.futures as cf, json

# یک اسلاگ نماینده برای هر خانوادهٔ مدل — تیپ پایه/استاندارد
MODELS = {
    # سایپا
    'پراید ۱۵۱': 'pride_151_gx',
    'کوییک': 'quick_manuals',
    'ساینا': 'saina_manuals_mtgas',
    'شاهین': 'shahin_g',
    'اطلس': 'atlas_g_mt',
    'سهند': 'sahand_smt_gasoline',
    'آریسان': 'arisun_2',
    'پارس نوآ': 'parsnoa_1.6liter_mt',
    # ایران خودرو
    'پژو ۲۰۷': 'peugeot_207_manualtu5p',
    'تارا': 'tara_v1p_6mt',
    'دنا پلاس': 'dena_plusef7p_6mt',
    'رانا': 'runna_plus_tu5plus',
    'ری‌را': 'reera_1.7literturbo_6at',
    'سورن پلاس': 'samand_soren_plustu5p',
    'هایما S5': 'haima_s5_6at',
    'هایما S7': 'haima_s7_1.5literturbopro',
    'هایما 7X': 'haima_7x_1.6literturbo',
    'هایما 8S': 'haima_8s',
    # کرمان موتور
    'جک J4': 'jac_j4',
    'کی ام سی SR3': 'kmc_sr3_1.6liter',
    'کی ام سی J7': 'kmc_j7',
    'کی ام سی T9': 'kmc_t9_2literturbo',
    'کی ام سی T8': 'kmc_t8',
    'کی ام سی X5': 'kmc_x5_1.5literturbo',
    'کی ام سی eJ7': 'kmc_ej7_plus',
    'کی ام سی A5': 'kmc_eagle_1.5liter',
    # لاماری
    'لاماری اکو': 'lamari_echo_1.5literturbo',
    'لاماری ایما': 'lamari_eama',
    'لاماری نئو': 'lamari_neo_1.5literturbo',
    # مدیران خودرو (فونیکس)
    'آریزو ۶ پرو': 'fownix_arrizo6pro',
    'آریزو ۸': 'fownix_arrizo8_excellent',
    'تیگو ۷ پرو': 'fownix_tiggo7pro_premium',
    'تیگو ۸ پرو مکس': 'fownix_tiggo8promax_ie',
    # فیدلیتی
    'فیدلیتی الیت ۷نفره': 'fidelity_elite_7seater',
    # سایر داخلی
    'اینوی هیبرید': 'envoy_hybrid_1.5liter',
}

def fetch(item):
    label, slug = item
    url = f'https://bama.ir/price/{slug}'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept-Language': 'fa,en;q=0.8',
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8', 'replace')
    except Exception as e:
        return label, slug, None, None, f'ERR {str(e)[:40]}'
    t = re.sub(r'<script[\s\S]*?</script>', ' ', html)
    t = re.sub(r'<[^>]+>', ' ', t)
    mkt = re.search(r'قیمت بازار\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان', t)
    fct = re.search(r'قیمت نمایندگی\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان', t)
    return label, slug, mkt and mkt.group(1), fct and fct.group(1), 'OK'

results = []
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for r in ex.map(fetch, MODELS.items()):
        results.append(r)

out = []
print(f'{"مدل":24s} {"بازار":>16s} {"کارخانه(نمایندگی)":>18s} وضعیت')
for label, slug, mkt, fct, st in results:
    print(f'{label:24s} {str(mkt or "—"):>16s} {str(fct or "—"):>18s} {st}')
    out.append({'label': label, 'slug': slug, 'market': mkt, 'factory': fct, 'status': st})
json.dump(out, open('/tmp/bama-verified.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ok_mkt = sum(1 for r in results if r[2])
ok_fct = sum(1 for r in results if r[3])
print(f'\nبازار: {ok_mkt}/{len(results)} | کارخانه: {ok_fct}/{len(results)}')

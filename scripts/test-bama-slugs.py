#!/usr/bin/env python3
"""تست اسلاگ‌های کاندید باما — کدام‌ها صفحهٔ قیمت معتبر با قیمت بازار/نمایندگی دارند."""
import re, json, urllib.request, concurrent.futures as cf

CANDIDATES = [
    # ایران خودرو
    'peugeot_206', 'peugeot_206_tu5', 'peugeot_207', 'peugeot_207i', 'peugeot_pars',
    'peugeot_405', 'peugeot_405_glx', 'samand_lx', 'samand_ef7', 'soren_plus',
    'suren_plat', 'dena_plus', 'dena_plus_auto', 'dena_turbo', 'tara_auto',
    'tara_manual', 'tara_automat', 'ikco_rira', 'rira',
    # سایپا
    'pride_131', 'pride_132', 'pride_141', 'tiba_2', 'tiba', 'quick_r', 'quick_s',
    'quick_auto', 'saina_s', 'saina_auto', 'saina_automat', 'shahin', 'shahin_g',
    'shahin_auto', 'atlas_s', 'atlas', 'saipa_151', 'pride_111',
    # کرمان موتور / جک
    'jac_j4', 'jac_j7', 'jac_j5', 'jac_s5', 'jac_t9', 'kmc_t9', 'kmc_j7',
    'kmc_sr3_1.6liter', 'kmc_athlee?',
    # چری / ام‌وی‌ام
    'chery_tiggo_7', 'chery_tiggo_7_pro', 'chery_tiggo_8', 'chery_tiggo_8_pro',
    'chery_arrizo_5', 'chery_arrizo_6', 'chery_arrizo_6_pro', 'mvm_315', 'mvm_x22',
    'mvm_332', 'tiggo_7', 'tiggo_8', 'arrizo_5', 'arrizo_6',
    # هایما
    'haima_s5', 'haima_s7', 'haima_8s', 'haima_m8', 'haima_7x',
    # فیدلیتی
    'fidelity_elite_7seater', 'fidelity_ekind', 'fidelity_t7',
    # لاماری / دیگر
    'lamari_h', 'lamari_s', 'lamari_x', 'baic_x25', 'baic_d20',
    'bestune_t77', 'dongfeng_h30', 'jac_j4_plus', 'cadillac_xt4',
    # برندها (شاید صفحهٔ برند با فهرست مدل‌ها باشد)
    'saipa', 'iran_khodro', 'iran_khodro_diesel', 'kerman_motor', 'chery', 'haima',
]

def check(slug):
    url = f'https://bama.ir/price/{slug}'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept-Language': 'fa,en;q=0.8',
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            code = r.status
            html = r.read().decode('utf-8', 'replace')
    except Exception as e:
        return slug, None, str(e)[:60], None, None
    if code != 200:
        return slug, code, 'non-200', None, None
    t = re.sub(r'<script[\s\S]*?</script>', ' ', html)
    t = re.sub(r'<[^>]+>', ' ', t)
    mkt = re.search(r'قیمت بازار\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان', t)
    fct = re.search(r'قیمت نمایندگی\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان', t)
    # عنوان صفحه = نام مدل
    title = re.search(r'<title>([^<]{3,80})</title>', html)
    return slug, 200, (title.group(1)[:70] if title else '?'), mkt and mkt.group(1), fct and fct.group(1)

ok, bad = [], []
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for slug, code, info, mkt, fct in ex.map(check, CANDIDATES):
        if code == 200 and mkt:
            ok.append((slug, info, mkt, fct))
        else:
            bad.append((slug, code, info[:40]))

print('===== VALID (200 + قیمت بازار) =====')
for s, t, m, f in sorted(ok, key=lambda x: x[0]):
    print(f'{s:32s} | بازار {m:>15s} | نمایندگی {str(f or "—"):>15s} | {t[:50]}')
print(f'\n===== INVALID ({len(bad)}) =====')
for s, c, i in bad:
    print(f'{s:32s} | {c} | {i}')

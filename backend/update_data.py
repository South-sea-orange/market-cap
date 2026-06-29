#!/usr/bin/env python3
"""
companiesmarketcap.com 에서 전체/미국/한국 시총 top 50 + 환율을 받아 marketcaps.json 을 갱신.
- 매일 한국시간(KST) 오전 7시에 launchd 가 실행합니다.
- 서버는 marketcaps.json 변경(mtime)을 감지해 자동 반영하므로 서버 재시작이 필요 없습니다.
- 과거 연도별 history(2020~2025)는 보존하고, 현재값(2026)과 종목 구성만 매일 갱신합니다.
  (새 종목은 그 종목의 연도별 history 페이지를 1회 받아 보강.)
사용:  python3 update_data.py
"""
import os, re, html, json, sys, time, datetime, concurrent.futures as cf
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "marketcaps.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")
PAGES = {
    "ALL": "https://companiesmarketcap.com/",
    "US":  "https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/",
    "KR":  "https://companiesmarketcap.com/south-korea/largest-companies-in-south-korea-by-market-cap/",
}
# 한국 종목 한글명 (cmc 코드 기준). 없는 신규 종목은 cmc 영문명 사용.
KRN = {
 "005930.KS":"삼성전자","000660.KS":"SK하이닉스","402340.KS":"SK스퀘어","005380.KS":"현대차",
 "373220.KS":"LG에너지솔루션","028260.KS":"삼성물산","032830.KS":"삼성생명","329180.KS":"HD현대중공업",
 "000270.KS":"기아","034020.KS":"두산에너빌리티","207940.KS":"삼성바이오로직스","KB":"KB금융",
 "012450.KS":"한화에어로스페이스","012330.KS":"현대모비스","SHG":"신한지주","009155.KS":"삼성전기",
 "066570.KS":"LG전자","267260.KS":"HD현대일렉트릭","068270.KS":"셀트리온","042660.KS":"한화오션",
 "010120.KS":"LS일렉트릭","034730.KS":"SK","298040.KS":"효성중공업","035420.KS":"NAVER",
 "086790.KS":"하나금융지주","042700.KS":"한미반도체","009540.KS":"HD한국조선해양","000150.KS":"두산",
 "PKX":"POSCO홀딩스","011070.KS":"LG이노텍","051910.KS":"LG화학","000810.KS":"삼성화재",
 "KEP":"한국전력","010130.KS":"고려아연","064350.KS":"현대로템","010140.KS":"삼성중공업",
 "WF":"우리금융지주","SKM":"SK텔레콤","079550.KS":"LIG넥스원","011200.KS":"HMM",
 "272210.KS":"한화시스템","307950.KS":"현대오토에버","006405.KS":"삼성SDI","267250.KS":"HD현대",
 "033780.KS":"KT&G","196170.KQ":"알테오젠","138040.KS":"메리츠금융지주","003670.KS":"포스코퓨처엠",
 "024110.KS":"기업은행","018260.KS":"삼성SDS",
}
GLOBAL_KO = {"005930.KS":"삼성전자","000660.KS":"SK하이닉스"}
ADR_CC = {"TSM":"TW","ASML":"NL","ARM":"UK","TCEHY":"CN","BABA":"CN","PDD":"CN","NTES":"CN","HSBC":"UK"}


def cc_for(code):
    suf = code.split(".")[-1] if "." in code else ""
    return {"KS":"KR","KQ":"KR","SS":"CN","SZ":"CN","HK":"CN","T":"JP","SR":"SR","SW":"CH","L":"UK"}.get(
        suf, ADR_CC.get(code, "US"))


def name_for(code, en, group):
    if group == "KR": return KRN.get(code, en or code)
    if group == "ALL": return GLOBAL_KO.get(code) or en or code
    return en or code


def _to_bn(v, u):
    x = float(v.replace(",", ""))
    return x*1000 if u == "T" else (x if u == "B" else x/1000)


def parse_list(text):
    out = []
    for ch in text.split('class="logo-container"')[1:]:
        mcode = re.search(r'/company-logos/64/(.+?)\.png', ch)
        mname = re.search(r'alt="(.*?) logo"', ch)
        mcap  = re.search(r'td-right" data-sort="(\d+)"><span class="currency-symbol-left"', ch)
        mslug = re.search(r'href="/([^/"]+)/marketcap/"', ch)
        if not (mcode and mcap and mslug): continue
        out.append({"code": html.unescape(mcode.group(1)).strip(),
                    "name": html.unescape(mname.group(1)).strip() if mname else "",
                    "cap": round(int(mcap.group(1))/1e9, 2),
                    "slug": mslug.group(1)})
        if len(out) >= 50: break
    return out


def fetch_history(sess, slug):
    try:
        r = sess.get(f"https://companiesmarketcap.com/{slug}/marketcap/", timeout=25)
        rows = re.findall(r'<tr><td>(\d{4})</td><td>\$([\d.,]+)\s*([TBM])</td>', r.text)
        return {str(y): round(_to_bn(v, u), 2) for y, v, u in rows if 2020 <= int(y) <= 2026}
    except Exception:
        return {}


def fx_rate(default):
    for url, key in [("https://open.er-api.com/v6/latest/USD", "rates"),
                     ("https://api.exchangerate-api.com/v4/latest/USD", "rates")]:
        try:
            d = requests.get(url, timeout=12).json()
            v = d.get(key, {}).get("KRW")
            if v and 800 < float(v) < 3000:
                return round(float(v))
        except Exception:
            pass
    return default


# ── 한국: 네이버 금융 시가총액(보통주, 원화) ───────────────────────────────
# cmc 한국 시총은 우선주 포함이라 실제와 다름 → 한국 현재값은 네이버에서 받아 덮어씀.
NAVER_TO_CMC = {
    "009150.KS": "009155.KS", "006400.KS": "006405.KS", "006800.KS": "006805.KS",
    "096770.KS": "096775.KS", "105560.KS": "KB", "055550.KS": "SHG", "005490.KS": "PKX",
    "015760.KS": "KEP", "316140.KS": "WF", "017670.KS": "SKM",
}
CMC_TO_NAVER = {v: k for k, v in NAVER_TO_CMC.items()}
ETF_PREFIX = ("KODEX", "TIGER", "KBSTAR", "ARIRANG", "KOSEF", "HANARO", "ACE", "SOL",
              "PLUS", "RISE", "TIMEFOLIO", "KIWOOM", "KINDEX", "TREX", "FOCUS", "KoAct")


def _naver_rows(text, suffix):
    out = []
    parts = re.split(r'href="/item/main\.naver\?code=(\d{6})"[^>]*class="tltle">', text)
    for i in range(1, len(parts), 2):
        code, chunk = parts[i], parts[i + 1]
        nums = [re.sub(r"<[^>]+>", "", x).strip()
                for x in re.findall(r'<td class="number">(.*?)</td>', chunk, flags=re.DOTALL)]
        if len(nums) < 5 or not nums[4].replace(",", "").isdigit():
            continue
        name = re.sub(r"<[^>]+>", "", chunk.split("</a>")[0]).strip()
        out.append((code + suffix, name, int(nums[4].replace(",", ""))))   # 시가총액(억원)
    return out


def naver_caps(sess):
    """네이버 KOSPI+KOSDAQ → {종목코드: 시가총액(억원)} (ETF·우선주 제외)."""
    seen = {}
    for sosok, suf in [(0, ".KS"), (1, ".KQ")]:
        for pg in (1, 2):
            try:
                r = sess.get(f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={pg}", timeout=25)
                r.encoding = "euc-kr"
                for code, name, eok in _naver_rows(r.text, suf):
                    if name.startswith(ETF_PREFIX) or re.search(r"우[0-9]*[A-C]?$", name):
                        continue
                    seen[code] = eok
            except Exception as e:
                print(f"[warn] naver {sosok}/{pg}: {e}")
    return seen


def main():
    old = {}
    if os.path.exists(OUT):
        try: old = json.load(open(OUT, encoding="utf-8"))
        except Exception: old = {}
    old_groups = old.get("groups", {})
    history = dict(old.get("history", {}))

    sess = requests.Session(); sess.headers["User-Agent"] = UA
    fx = fx_rate(old.get("fx_krw_per_usd", 1513))
    groups, slugs = {}, {}
    for g, url in PAGES.items():
        try:
            rows = parse_list(sess.get(url, timeout=30).text)
            if len(rows) < 30: raise ValueError(f"{g}: {len(rows)} rows only")
            groups[g] = [{"sym": r["code"], "name": name_for(r["code"], r["name"], g),
                          "cc": cc_for(r["code"]), "now": r["cap"]} for r in rows]
            for r in rows: slugs[r["code"]] = r["slug"]
        except Exception as e:
            print(f"[warn] {g} 갱신 실패 → 기존값 유지: {e}")
            groups[g] = old_groups.get(g, [])

    # 한국: 현재 시총을 네이버(보통주, 원화) 값으로 덮어쓰고 재정렬 (코드/로고/history 는 cmc 유지)
    try:
        ncaps = naver_caps(sess)
        if ncaps and groups.get("KR"):
            hit = 0
            for r in groups["KR"]:
                ncode = CMC_TO_NAVER.get(r["sym"], r["sym"])
                if ncode in ncaps:
                    r["now"] = round(ncaps[ncode] / (fx * 10), 2)   # 억원 → 10억USD(표시 시 ×fx 로 정확히 원복)
                    hit += 1
            groups["KR"].sort(key=lambda r: -r["now"])
            print(f"[ok] 한국 {hit}/50 종목 네이버 시총 적용")
        else:
            print("[warn] 네이버 시총 비어있음 → cmc 값 유지")
    except Exception as e:
        print(f"[warn] 네이버 적용 실패 → cmc 값 유지: {e}")

    # 과거 history 가 부실한(2020~2025 4년 미만) 종목만 보강
    need = [c for c in slugs if sum(1 for y in history.get(c, {}) if int(y) < 2026) < 4]
    if need:
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            for code, h in zip(need, ex.map(lambda c: fetch_history(sess, slugs[c]), need)):
                if sum(1 for y in h if int(y) < 2026) >= 4:   # 충분할 때만 교체(부실 데이터로 덮지 않음)
                    history[code] = h

    # 현재값(2026) 반영
    now_map = {r["sym"]: r["now"] for g in groups.values() for r in g}
    for sym, now in now_map.items():
        h = history.get(sym, {}); h["2026"] = now; history[sym] = h

    kst = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    out = {"as_of": kst.strftime("%Y-%m-%d"), "updated_at": kst.strftime("%Y-%m-%d %H:%M"), "fx_krw_per_usd": fx,
           "source": "companiesmarketcap.com (KR: naver finance)", "groups": groups, "history": history}
    tmp = OUT + ".tmp"
    json.dump(out, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    os.replace(tmp, OUT)   # 원자적 교체(서버가 반쪽 파일 읽지 않도록)
    print(f"[ok] {kst:%Y-%m-%d %H:%M KST} 갱신 | "
          f"ALL/US/KR={[len(groups[g]) for g in ('ALL','US','KR')]} | fx={fx} | history={len(history)}종목")


if __name__ == "__main__":
    main()

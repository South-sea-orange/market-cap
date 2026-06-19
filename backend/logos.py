"""
로고 수집/캐시 모듈.
다단계 출처에서 로고를 받아 logo_cache/ 에 실제 이미지 파일로 저장합니다.
순서: companiesmarketcap → Clearbit(도메인) → Google 파비콘(도메인) → 컬러 이니셜 SVG
서버가 한 번 받아 같은 도메인(/api/logo)으로 내보내므로 hotlink/CSP 문제가 없고, 사용자가 직접 넣을 필요가 없습니다.
"""
import os
import hashlib
import requests
import data

CACHE = os.path.join(os.path.dirname(__file__), "logo_cache")
os.makedirs(CACHE, exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
PALETTE = ["#4F6BED", "#E0573E", "#2FA37C", "#9B5DE5", "#F2A03D", "#D6517A", "#3AA0C9", "#5B7C99"]


def _safe(sym): return sym.replace("/", "_").replace("..", "_")
def _paths(sym):
    base = os.path.join(CACHE, _safe(sym))
    return base + ".bin", base + ".type"


def placeholder_svg(symbol: str) -> bytes:
    h = int(hashlib.md5(symbol.encode()).hexdigest(), 16)
    bg = PALETTE[h % len(PALETTE)]
    ch = (symbol.lstrip("0")[:1] or symbol[:1] or "?").upper()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">'
            f'<rect width="64" height="64" rx="14" fill="{bg}"/>'
            f'<text x="32" y="42" font-family="Arial,sans-serif" font-size="30" font-weight="700" '
            f'fill="#fff" text-anchor="middle">{ch}</text></svg>').encode()


def _try(url: str):
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": UA, "Accept": "image/avif,image/webp,image/png,image/*,*/*"})
        ct = r.headers.get("content-type", "").split(";")[0].strip()
        if r.status_code == 200 and r.content and len(r.content) > 100 and ct.startswith("image"):
            return r.content, ct
    except Exception:
        pass
    return None


def sources(sym: str):
    yield f"https://companiesmarketcap.com/img/company-logos/64/{sym}.png"
    dom = data.DOMAINS.get(sym)
    if dom:
        yield f"https://logo.clearbit.com/{dom}"
        yield f"https://www.google.com/s2/favicons?domain={dom}&sz=128"


def fetch(sym: str, force=False):
    """로고 bytes,ctype 반환. 캐시에 저장. 실패하면 컬러 이니셜 SVG."""
    binp, typ = _paths(sym)
    if not force and os.path.exists(binp):
        ct = open(typ).read().strip() if os.path.exists(typ) else "image/png"
        return open(binp, "rb").read(), ct, True
    for url in sources(sym):
        got = _try(url)
        if got:
            content, ct = got
            with open(binp, "wb") as f: f.write(content)
            with open(typ, "w") as f: f.write(ct)
            return content, ct, False
    svg = placeholder_svg(sym)
    with open(binp, "wb") as f: f.write(svg)
    with open(typ, "w") as f: f.write("image/svg+xml")
    return svg, "image/svg+xml", False


def all_symbols():
    seen, out = set(), []
    for rows in data.groups().values():
        for r in rows:
            if r["sym"] not in seen:
                seen.add(r["sym"]); out.append(r["sym"])
    return out


def prefetch_all(force=False, verbose=False):
    ok = ph = 0
    for sym in all_symbols():
        content, ct, cached = fetch(sym, force=force)
        if ct == "image/svg+xml" and b"<text" in content:
            ph += 1
            if verbose: print(f"  · {sym}: 폴백(이니셜)")
        else:
            ok += 1
            if verbose: print(f"  ✓ {sym}: {ct}{' (캐시)' if cached else ''}")
    return ok, ph

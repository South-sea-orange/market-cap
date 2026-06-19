"""
시가총액 순위 변화 추적 — 백엔드 (FastAPI)
- GET /api/rankings?group=ALL|US|KR  : 그룹별 종목 + 현재시총 + 연도별 과거 history
- GET /api/logo/{symbol}                : 로고(서버가 받아 캐시 → 항상 같은 도메인에서 제공)
- GET /                                  : 프론트엔드
서버 시작 시 백그라운드로 전체 로고를 미리 캐시합니다(사용자가 직접 넣을 필요 없음).
실행: uvicorn main:app --reload --port 8000  →  http://localhost:8000
"""
import os
import time
import datetime
import threading
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
import data
import kis
import logos
import update_data

KRW_PER_USD = float(os.getenv("KRW_PER_USD", "1513"))
HERE = os.path.dirname(__file__)
FRONTEND = os.path.abspath(os.path.join(HERE, "..", "frontend"))

app = FastAPI(title="Market Cap Rank Tracker")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _schedule_daily_update():
    """매일 한국시간 07:00 에 companiesmarketcap 에서 데이터 갱신. 서버 시작 시 데이터가 오래됐으면 즉시 1회 갱신.
    (서버가 터미널 권한을 물려받아 Desktop 접근이 되므로 별도 권한설정 불필요. 서버가 꺼져 있으면 다음 실행 때 갱신.)"""
    KST = datetime.timezone(datetime.timedelta(hours=9))

    def _stale():
        try:
            return data.load().get("as_of") != datetime.datetime.now(KST).strftime("%Y-%m-%d")
        except Exception:
            return True

    def _secs_to_7am():
        now = datetime.datetime.now(KST)
        nxt = now.replace(hour=7, minute=0, second=0, microsecond=0)
        if now >= nxt:
            nxt += datetime.timedelta(days=1)
        return (nxt - now).total_seconds()

    def _run():
        try:
            update_data.main()          # marketcaps.json 갱신
            data.load()                 # 캐시 새로고침
            logos.prefetch_all()        # 신규 종목 로고 보강
            print("[update] 데이터 갱신 완료")
        except Exception as e:
            print(f"[update] 갱신 실패(기존 데이터 유지): {e}")

    def loop():
        if _stale():
            print("[update] 데이터가 오래됨 → 시작 시 1회 갱신")
            _run()
        while True:
            time.sleep(_secs_to_7am())
            _run()

    threading.Thread(target=loop, daemon=True).start()


@app.on_event("startup")
def _prefetch_logos():
    def run():
        try:
            ok, ph = logos.prefetch_all()
            print(f"[logos] 캐시 완료: 실제 로고 {ok}개 / 폴백 {ph}개  (logo_cache/)")
        except Exception as e:
            print(f"[logos] 프리페치 오류: {e}")
    threading.Thread(target=run, daemon=True).start()


# ── 한국 종목 시총 실시간 캐시 (KIS) : 60초 ───────────────────────────────
_kr = {"ts": 0, "data": {}}
_kr_lock = threading.Lock()


def kr_live_caps() -> dict:
    if not kis.enabled():
        return {}
    with _kr_lock:
        if time.time() - _kr["ts"] < 60 and _kr["data"]:
            return _kr["data"]
        live = {}
        for r in data.groups().get("KR", []):
            sym = r["sym"]
            if "." not in sym:   # ADR 표기(KB·SHG 등)는 국내코드 아님 → 시드 사용
                continue
            v = kis.market_cap_usd_bn(sym.split(".")[0], KRW_PER_USD)
            if v:
                live[sym] = round(v, 2)
        if live:
            _kr.update(ts=time.time(), data=live)
        return live


@app.get("/api/rankings")
def rankings(group: str = "ALL"):
    d = data.load()
    g = group.upper()
    rows = d["groups"].get(g) or d["groups"]["ALL"]
    hist = d["history"]
    live = kr_live_caps() if g in ("ALL", "KR") else {}
    out = []
    for r in rows:
        sym = r["sym"]
        cur = live.get(sym, r["now"])
        h = {y: c for y, c in hist.get(sym, {}).items() if 2020 <= int(y) <= 2026}
        h["2026"] = round(cur, 2)   # 현재값(KIS 실시간 반영)으로 2026 보정
        real = sum(1 for y in h if 2020 <= int(y) <= 2025) >= 4
        out.append({"sym": sym, "name": r["name"], "cc": r["cc"], "now": round(cur, 2),
                    "hist": h, "real_history": real})
    return {"group": g, "as_of": d["as_of"],
            "source": d["source"] + (" + KIS(live KR)" if live else ""),
            "fx_krw_per_usd": d["fx_krw_per_usd"], "companies": out}


@app.get("/api/logo/{symbol}")
def logo(symbol: str):
    content, ctype, _ = logos.fetch(symbol)
    return Response(content, media_type=ctype, headers={"Cache-Control": "public, max-age=604800"})


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND, "index.html"))


if os.path.isdir(FRONTEND):
    app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")

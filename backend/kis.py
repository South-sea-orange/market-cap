"""
한국투자증권(KIS) OpenAPI 클라이언트 — 국내주식 시가총액 조회.
키는 .env 의 KIS_APP_KEY / KIS_APP_SECRET 로 주입합니다 (코드에 하드코딩 금지).
토큰은 메모리+파일에 캐시하며 약 24시간 유효합니다.
docs: https://apiportal.koreainvestment.com  (국내주식 현재가 시세 / FHKST01010100)
"""
import os
import json
import time
import threading
from typing import Optional
import requests

KIS_BASE = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
APP_KEY = os.getenv("KIS_APP_KEY", "")
APP_SECRET = os.getenv("KIS_APP_SECRET", "")
TOKEN_CACHE = os.path.join(os.path.dirname(__file__), ".kis_token.json")

_lock = threading.Lock()
_token = {"value": None, "expires": 0}


def enabled() -> bool:
    return bool(APP_KEY and APP_SECRET)


def _load_cached_token():
    try:
        with open(TOKEN_CACHE) as f:
            d = json.load(f)
        if d.get("expires", 0) > time.time() + 60:
            return d
    except Exception:
        pass
    return None


def get_token() -> str:
    with _lock:
        if _token["value"] and _token["expires"] > time.time() + 60:
            return _token["value"]
        cached = _load_cached_token()
        if cached:
            _token.update(cached)
            return _token["value"]
        # 신규 발급
        r = requests.post(
            f"{KIS_BASE}/oauth2/tokenP",
            json={"grant_type": "client_credentials", "appkey": APP_KEY, "appsecret": APP_SECRET},
            timeout=10,
        )
        r.raise_for_status()
        d = r.json()
        _token["value"] = d["access_token"]
        # expires_in(초) 또는 access_token_token_expired 제공. 보수적으로 23시간.
        _token["expires"] = time.time() + int(d.get("expires_in", 82800))
        try:
            with open(TOKEN_CACHE, "w") as f:
                json.dump(_token, f)
        except Exception:
            pass
        return _token["value"]


def market_cap_usd_bn(code6: str, krw_per_usd: float) -> Optional[float]:
    """국내 종목코드(6자리)의 시가총액(10억 USD)을 반환. 실패 시 None."""
    if not enabled():
        return None
    try:
        headers = {
            "authorization": f"Bearer {get_token()}",
            "appkey": APP_KEY,
            "appsecret": APP_SECRET,
            "tr_id": "FHKST01010100",
            "custtype": "P",
        }
        params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": code6}
        r = requests.get(
            f"{KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price",
            headers=headers, params=params, timeout=10,
        )
        r.raise_for_status()
        out = r.json().get("output", {})
        hts_avls = out.get("hts_avls")  # 시가총액, 단위: 억원
        if not hts_avls:
            return None
        eok_won = float(hts_avls)               # 억원
        # 억원 -> 10억 USD :  eok_won * 1e8 / krw_per_usd / 1e9  ==  eok_won / (krw_per_usd * 10)
        return eok_won / (krw_per_usd * 10.0)
    except Exception as e:
        print(f"[KIS] {code6} 조회 실패: {e}")
        return None

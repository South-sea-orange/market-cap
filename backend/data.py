"""
시가총액 데이터 로더 — marketcaps.json(companiesmarketcap.com 기반)을 읽어 그룹/연도별 history 제공.
- groups(): {"ALL":[{sym,name,cc,now}...], "US":[...], "KR":[...]}  (각국 시총 top 50)
- history(): {sym: {"2020":cap, ..., "2026":now}}  (10억 USD, 연말 기준 / 2026=현재)
update_data.py 가 매일 marketcaps.json 을 갱신하면 서버가 파일 변경(mtime)을 감지해 자동 반영합니다.
"""
import os
import json
import threading

HERE = os.path.dirname(__file__)
DATA_FILE = os.path.join(HERE, "marketcaps.json")
_cache = {"mtime": 0.0, "data": None}
_lock = threading.Lock()
_EMPTY = {"groups": {"ALL": [], "US": [], "KR": []}, "history": {},
          "fx_krw_per_usd": 1513, "as_of": "", "source": "companiesmarketcap.com"}


def load() -> dict:
    """marketcaps.json 을 읽어 캐시. 파일이 바뀌면 자동 재로딩."""
    with _lock:
        try:
            m = os.path.getmtime(DATA_FILE)
        except OSError:
            return _cache["data"] or _EMPTY
        if _cache["data"] is None or m != _cache["mtime"]:
            with open(DATA_FILE, encoding="utf-8") as f:
                _cache["data"] = json.load(f)
            _cache["mtime"] = m
        return _cache["data"]


def groups() -> dict:
    return load()["groups"]


def history() -> dict:
    return load()["history"]


# 로고 폴백(Clearbit/파비콘)용 공식 도메인 맵 — companiesmarketcap 실패 시 사용
DOMAINS = {
    "NVDA":"nvidia.com","AAPL":"apple.com","GOOG":"google.com","MSFT":"microsoft.com","AMZN":"amazon.com",
    "TSM":"tsmc.com","AVGO":"broadcom.com","SPCX":"spacex.com","2222.SR":"aramco.com","TSLA":"tesla.com",
    "META":"meta.com","005930.KS":"samsung.com","000660.KS":"skhynix.com","MU":"micron.com",
    "BRK-B":"berkshirehathaway.com","LLY":"lilly.com","WMT":"walmart.com","AMD":"amd.com","JPM":"jpmorganchase.com",
    "ORCL":"oracle.com","ASML":"asml.com","V":"visa.com","XOM":"exxonmobil.com","INTC":"intel.com","JNJ":"jnj.com",
    "TCEHY":"tencent.com","CSCO":"cisco.com","MA":"mastercard.com","COST":"costco.com","CAT":"caterpillar.com",
    "601939.SS":"ccb.com","ABBV":"abbvie.com","ARM":"arm.com","PLTR":"palantir.com","BAC":"bankofamerica.com",
    "CVX":"chevron.com","NFLX":"netflix.com","AMAT":"appliedmaterials.com","UNH":"unitedhealthgroup.com",
    "RO.SW":"roche.com","KO":"coca-colacompany.com","GE":"ge.com","601288.SS":"abchina.com","PG":"pg.com",
    "MS":"morganstanley.com","HSBC":"hsbc.com","HD":"homedepot.com","9984.T":"softbank.jp","GS":"goldmansachs.com",
    "1398.HK":"icbc.com.cn","BABA":"alibaba.com","PDD":"pddholdings.com","600519.SS":"moutaichina.com",
    "300750.SZ":"catl.com","0857.HK":"petrochina.com.cn","0941.HK":"chinamobileltd.com","NTES":"neteasegames.com",
    "XIACF":"mi.com","002594.SZ":"byd.com","KB":"kbfg.com","SHG":"shinhangroup.com","PKX":"posco.com",
    "KEP":"kepco.co.kr","SKM":"sktelecom.com","WF":"woorifg.com","035420.KS":"navercorp.com","035720.KS":"kakaocorp.com",
    "066570.KS":"lge.com","005380.KS":"hyundai.com","000270.KS":"kia.com","051910.KS":"lgchem.com",
    "207940.KS":"samsungbiologics.com","CRM":"salesforce.com","IBM":"ibm.com","MRK":"merck.com","PEP":"pepsico.com",
    "DELL":"dell.com","TXN":"ti.com","QCOM":"qualcomm.com","C":"citigroup.com","WFC":"wellsfargo.com",
    "RTX":"rtx.com","MRVL":"marvell.com","KLAC":"kla.com","LRCX":"lamresearch.com","GEV":"gevernova.com",
    "PM":"pmi.com","SNDK":"sandisk.com","BIDU":"baidu.com",
}

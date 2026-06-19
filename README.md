# 시가총액 순위 추적기 (Market Cap Rank Tracker)

전 세계 / 미국 / 한국 시가총액 **상위 50개** 기업의 순위가 **과거 어느 시점 대비 몇 계단 움직였고 시총이 몇 % 변했는지**를 **원화**로 보여주는 웹앱.
비교 시점을 드래그하면 순위 이동이 실시간으로 바뀌고, 종목을 누르면 연도별 순위 흐름 그래프가 나옵니다.

## 데이터 출처
- 모든 시가총액·로고·연도별 과거치: **[companiesmarketcap.com](https://companiesmarketcap.com)** (USD)
- 환율(USD→KRW): open.er-api.com 등에서 자동 수신해 원화 환산
- 로고는 각 기업의 상표이며 식별 목적으로 표시합니다.

## 구조
- **backend/** — FastAPI. 데이터 API + 로고 캐시/프록시 + 프론트 정적 서빙(한 서버).
  - `GET /api/rankings?group=ALL|US|KR` — 그룹별 종목 + 현재시총 + 연도별 history
  - `GET /api/logo/{symbol}` — 로고(서버가 받아 캐시)
  - `marketcaps.json` — 데이터(그룹 + 연도별 history). `update_data.py` 가 갱신.
- **frontend/** — 순수 JS(빌드 불필요). `index.html` + `app.js`.

## 자동 업데이트
- 서버 내장 스케줄러가 **매일 오전 7시(KST)** companiesmarketcap 에서 데이터를 다시 받아 `marketcaps.json` 을 갱신(서버가 켜져 있을 때).
- 서버 시작 시 데이터가 오늘 것이 아니면 즉시 1회 갱신.
- 수동 실행: `python3 backend/update_data.py`

## 로컬 실행
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```
→ http://localhost:8000

## 배포 (예: Render — git push 시 자동 반영)
1. `git remote add origin <본인 GitHub 저장소>` 후 `git push -u origin main`
2. Render 에서 New → Web Service → 이 저장소 연결 (`render.yaml`/`Dockerfile` 자동 인식)
3. 이후 **코드 수정 → push → 자동 재배포**
- Railway/Fly.io 도 동일한 `Dockerfile` 로 배포 가능.

## 파일
```
backend/  main.py  data.py  logos.py  kis.py  update_data.py  marketcaps.json  requirements.txt
frontend/ index.html  app.js
Dockerfile  render.yaml
```

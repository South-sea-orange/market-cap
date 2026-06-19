FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000
EXPOSE 8000
# 프론트 정적 서빙 + API + 로고 프록시 + 매일 7시 자동 갱신(서버 내장 스케줄러)
CMD ["sh","-c","uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]

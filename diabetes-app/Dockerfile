# Build หน้าเว็บ React แล้วรวมกับ Flask ในคอนเทนเนอร์เดียว (ใช้กับ Render ได้โดยตรง)
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist
ENV PORT=10000 DATA_DIR=/var/data
# seed.py ทำซ้ำได้ปลอดภัย: สร้างข้อมูลเริ่มต้น + เทรนโมเดลเฉพาะเมื่อฐานข้อมูลยังว่าง
CMD ["sh", "-c", "cd backend && python seed.py && gunicorn -w 2 -b 0.0.0.0:${PORT} --timeout 180 app:app"]

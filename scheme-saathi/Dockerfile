# Scheme Saathi - Unified Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH="/app/backend:$PYTHONPATH"

# Copy and install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Create Admin_Data directory
RUN mkdir -p /app/Admin_Data

# Copy backend source code
COPY backend/ ./backend/

# Copy pre-built frontend production assets (from Vite build)
COPY frontend/dist/ ./frontend/dist/

# Switch working directory to /app/backend so all imports (database, routes, services) resolve cleanly
WORKDIR /app/backend

# Expose web application port
EXPOSE 8000

# Run FastAPI backend with Uvicorn (serving both API and React frontend on port 8000)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.schemes import router as schemes_router


app = FastAPI(
    title="Scheme Saathi API",
    description="AI-driven government scheme matching platform",
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Scheme Saathi backend is running",
        "status": "ok",
    }


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "scheme-saathi-backend",
    }


# ---------------------------------------------------------
# SCHEME ROUTES
# ---------------------------------------------------------

app.include_router(
    schemes_router
)
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

# Project structure:
#
# scheme-saathi/
# ├── .env
# └── backend/
#     └── main.py
#
ROOT_DIR = Path(__file__).resolve().parent.parent

load_dotenv(ROOT_DIR / ".env")


# ============================================================
# DATABASE
# ============================================================

from database.database import init_db


# ============================================================
# ROUTES
# ============================================================

from routes.schemes import router as schemes_router
from routes.auth import router as auth_router
from routes.ai_assistant import router as ai_router

# IMPORTANT:
# Your project screenshot shows backend/routes/calculator.py
from routes.calculator import router as emi_router

from routes.channel_partner import router as partner_router
from routes.locations import router as locations_router
from routes.applications import router as applications_router
from routes.documents import router as documents_router
from routes.admin import router as admin_router


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Initialize database when backend starts
    init_db()

    print("============================================")
    print(" Scheme Saathi Backend Started Successfully")
    print(" Database Initialized")
    print(" AI Services Ready")
    print("============================================")

    yield

    print("Scheme Saathi Backend Shutting Down...")


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Scheme Saathi API",
    description="AI-driven government scheme matching platform",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# CORS CONFIGURATION
# Allow all origins that may call this API:
#   - Local development (Vite dev server)
#   - Vercel production and preview deployments
#   - Any custom domain
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        # Vercel production
        "https://final-scheme-saathi-project.vercel.app",
    ],
    # Covers ALL *.vercel.app preview deployments + localhost variants
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
        r"|^https://[a-zA-Z0-9\-]+\.vercel\.app$"
        r"|^https://[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-]+\.vercel\.app$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# GLOBAL EXCEPTION HANDLER (Ensures CORS headers on 500)
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.getLogger("uvicorn.error").error(
        f"Unhandled error processing {request.method} {request.url.path}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "An internal server error occurred. Please try again.",
            "error_type": exc.__class__.__name__,
        },
    )


# ============================================================
# ROOT API & HEALTH CHECK
# ============================================================

candidates = [
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent / "frontend" / "dist",
    Path("/app/frontend/dist"),
]
FRONTEND_DIST = next((p for p in candidates if p.exists() and (p / "index.html").exists()), None)


@app.get("/api")
def api_root():
    return {
        "message": "Scheme Saathi backend is running",
        "status": "ok",
        "version": "1.0.0",
    }


@app.get("/")
def root():
    if FRONTEND_DIST and (FRONTEND_DIST / "index.html").is_file():
        from fastapi.responses import FileResponse
        return FileResponse(FRONTEND_DIST / "index.html")
    return {
        "message": "Scheme Saathi backend is running",
        "status": "ok",
        "version": "1.0.0",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():

    return {
        "status": "healthy",
        "service": "scheme-saathi-backend",
        "ai_service": "available"
    }


# ============================================================
# REGISTER ALL ROUTERS
# ============================================================

app.include_router(schemes_router)

app.include_router(auth_router)

app.include_router(ai_router)

app.include_router(emi_router)

app.include_router(partner_router)

app.include_router(locations_router)
 
app.include_router(applications_router)
 
app.include_router(documents_router)

app.include_router(admin_router)


# ============================================================
# STATIC FRONTEND ASSETS & SPA ROUTING
# ============================================================

if FRONTEND_DIST and (FRONTEND_DIST / "index.html").is_file():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    from fastapi import HTTPException

    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


# ============================================================
# END
# ============================================================
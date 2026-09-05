#!/usr/bin/env bash
# ============================================================
# Scheme Saathi — Full Development Startup Script
#
# Starts: Backend (FastAPI) → Frontend (Vite)
# AI powered by Google Gemini 2.5 Flash (cloud API)
#
# Usage:
#   ./scripts/dev.sh           # start everything
#   ./scripts/dev.sh --backend # backend only
#   ./scripts/dev.sh --frontend # frontend only
#   ./scripts/dev.sh --ai      # backend only (AI-focused)
#
# Environment variables:
#   GEMINI_API_KEY   (required for AI Assistant)
#   GEMINI_MODEL     (default: gemini-2.5-flash)
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_VENV="$BACKEND_DIR/venv"

# Gemini configuration
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

# Track PIDs we start so we can clean up on exit
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down Scheme Saathi..."
  if [ ${#PIDS[@]} -gt 0 ]; then
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi
  wait 2>/dev/null || true
  echo "All services stopped."
}

trap cleanup EXIT INT TERM

# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------

info()  { printf "\033[1;34m[INFO]\033[0m  %s\n" "$1"; }
ok()    { printf "\033[1;32m[OK]\033[0m    %s\n" "$1"; }
warn()  { printf "\033[1;33m[WARN]\033[0m  %s\n" "$1"; }
err()   { printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"; }

wait_for_port() {
  local port=$1
  local max_wait=${2:-30}
  local count=0
  while ! lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ "$count" -ge "$max_wait" ]; then
      return 1
    fi
  done
  return 0
}

# ----------------------------------------------------------
# 1. Gemini API Key check
# ----------------------------------------------------------

check_gemini() {
  info "Checking Gemini API configuration..."

  if [ -z "$GEMINI_API_KEY" ]; then
    warn "GEMINI_API_KEY is not set."
    echo ""
    echo "  The AI Assistant will not work without a Gemini API key."
    echo "  All other Scheme Saathi features (eligibility, EMI, partners) will work normally."
    echo ""
    echo "  To set it:"
    echo "    export GEMINI_API_KEY='your-api-key-here'"
    echo ""
    echo "  Get a free API key at: https://aistudio.google.com/apikey"
    echo ""
  else
    ok "GEMINI_API_KEY is configured."
    ok "Gemini model: $GEMINI_MODEL"
  fi
}

# ----------------------------------------------------------
# 2. Backend (FastAPI + uvicorn)
# ----------------------------------------------------------

start_backend() {
  info "Starting FastAPI backend..."

  if [ ! -d "$BACKEND_VENV" ]; then
    err "Python virtual environment not found at $BACKEND_VENV"
    echo "  Run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
  fi

  # Check if port 8000 is already in use
  if lsof -i ":8000" -sTCP:LISTEN -t >/dev/null 2>&1; then
    warn "Port 8000 is already in use. Backend may already be running."
    echo "  Skipping backend start. If needed, kill the existing process first."
    return 0
  fi

  export GEMINI_API_KEY
  export GEMINI_MODEL

  cd "$BACKEND_DIR"
  "$BACKEND_VENV/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
  BACKEND_PID=$!
  PIDS+=("$BACKEND_PID")

  if wait_for_port 8000 15; then
    ok "Backend started at http://localhost:8000"
  else
    warn "Backend may still be starting. Check http://localhost:8000"
  fi
}

# ----------------------------------------------------------
# 3. Frontend (Vite/React)
# ----------------------------------------------------------

start_frontend() {
  info "Starting React frontend..."

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    warn "node_modules not found. Installing dependencies..."
    cd "$FRONTEND_DIR"
    npm install --silent
  fi

  # Check if port 5173 is already in use
  if lsof -i ":5173" -sTCP:LISTEN -t >/dev/null 2>&1; then
    warn "Port 5173 is already in use. Frontend may already be running."
    echo "  Skipping frontend start. If needed, kill the existing process first."
    return 0
  fi

  cd "$FRONTEND_DIR"
  npm run dev &
  FRONTEND_PID=$!
  PIDS+=("$FRONTEND_PID")

  if wait_for_port 5173 20; then
    ok "Frontend started at http://localhost:5173"
  else
    warn "Frontend may still be starting. Check http://localhost:5173"
  fi
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       SCHEME SAATHI — DEV MODE        ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

MODE="${1:-all}"

case "$MODE" in
  --backend|-b)
    check_gemini
    start_backend
    echo ""
    info "Backend is running. Press Ctrl+C to stop."
    wait
    ;;
  --frontend|-f)
    start_frontend
    echo ""
    info "Frontend is running. Press Ctrl+C to stop."
    wait
    ;;
  --ai|-a)
    check_gemini
    start_backend
    echo ""
    info "Backend is running (AI-focused mode). Press Ctrl+C to stop."
    wait
    ;;
  --help|-h)
    echo "Usage: ./scripts/dev.sh [option]"
    echo ""
    echo "Options:"
    echo "  (none)      Start everything: Backend + Frontend"
    echo "  --backend   Start backend only"
    echo "  --frontend  Start frontend only"
    echo "  --ai        Start backend only (for AI-focused work)"
    echo "  --help      Show this help"
    echo ""
    echo "Environment variables:"
    echo "  GEMINI_API_KEY   (required for AI Assistant)"
    echo "  GEMINI_MODEL     (default: gemini-2.5-flash)"
    ;;
  all)
    check_gemini
    start_backend
    start_frontend

    echo ""
    echo "  ╔═══════════════════════════════════════════════╗"
    echo "  ║  All services are running!                    ║"
    echo "  ╠═══════════════════════════════════════════════╣"
    echo "  ║  Frontend:  http://localhost:5173              ║"
    echo "  ║  Backend:   http://localhost:8000              ║"
    echo "  ║  AI:        Google Gemini $GEMINI_MODEL     ║"
    echo "  ║  API Docs:  http://localhost:8000/docs         ║"
    echo "  ╚═══════════════════════════════════════════════╝"
    echo ""
    echo "  Press Ctrl+C to stop all services."
    echo ""
    wait
    ;;
  *)
    err "Unknown option: $MODE"
    echo "  Run with --help for usage information."
    exit 1
    ;;
esac

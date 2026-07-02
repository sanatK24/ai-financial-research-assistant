from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import engine, Base
from .api import auth, company, financials, news, earnings, comparison, rag, analyze

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Financial Research Assistant API",
    description="Backend API for real-time market data, SEC RAG search, news sentiment, and financial ratio extraction.",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(company.router, prefix="/api")
app.include_router(financials.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(earnings.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(rag.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")

# Serve frontend static files
# Setup paths
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
frontend_dir = os.path.join(base_dir, "frontend")
os.makedirs(frontend_dir, exist_ok=True)

# Main route to serve the SPA
@app.get("/")
def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "message": "AI Financial Research Assistant Backend is running.",
        "instructions": "Place your index.html and app.js inside the frontend/ folder to serve the dashboard here."
    }

# Mount frontend directory for static assets (like app.js)
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

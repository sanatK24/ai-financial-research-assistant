from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..models import EarningsCall, DocumentChunk
from ..services.llm_service import LLMService
from ..services.rag_engine import RAGEngine
from .auth import get_cached_keys

router = APIRouter(prefix="/earnings", tags=["Earnings Call Analysis"])

@router.post("/upload")
async def upload_transcript(
    ticker: str = Form(...),
    quarter: str = Form(...),
    year: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ticker = ticker.strip().upper()
    quarter = quarter.strip().upper()
    
    # Read file content
    try:
        content_bytes = await file.read()
        transcript_text = content_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read transcript file: {str(e)}")
        
    if not transcript_text.strip():
        raise HTTPException(status_code=400, detail="Transcript file is empty")

    # Run analysis using LLMService (with active API keys or heuristics)
    keys = get_cached_keys()
    analysis = LLMService.analyze_earnings_call(transcript_text, keys)
    
    # Save call to database
    call = EarningsCall(
        ticker=ticker,
        quarter=quarter,
        year=year,
        filename=file.filename,
        transcript=transcript_text,
        analysis_json=json.dumps(analysis)
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    
    # Also index chunks of the transcript in DocumentChunk for RAG queries!
    chunks = RAGEngine.chunk_text(transcript_text)
    for idx, chunk in enumerate(chunks):
        doc_chunk = DocumentChunk(
            ticker=ticker,
            filing_type="earnings_call",
            source_name=f"{ticker} {year} {quarter} Earnings Call",
            text=chunk,
            chunk_index=idx
        )
        db.add(doc_chunk)
    db.commit()
    
    return {
        "status": "success",
        "id": call.id,
        "ticker": ticker,
        "quarter": quarter,
        "year": year,
        "analysis": analysis
    }

@router.get("/list")
def list_transcripts(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    calls = db.query(EarningsCall).filter(EarningsCall.ticker == ticker).order_by(EarningsCall.uploaded_at.desc()).all()
    
    results = []
    for call in calls:
        results.append({
            "id": call.id,
            "ticker": call.ticker,
            "quarter": call.quarter,
            "year": call.year,
            "filename": call.filename,
            "uploaded_at": call.uploaded_at
        })
    return results

@router.get("/analysis/{call_id}")
def get_analysis(call_id: int, db: Session = Depends(get_db)):
    call = db.query(EarningsCall).filter(EarningsCall.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Earnings call transcript not found")
        
    try:
        analysis = json.loads(call.analysis_json)
        return {
            "id": call.id,
            "ticker": call.ticker,
            "quarter": call.quarter,
            "year": call.year,
            "filename": call.filename,
            "uploaded_at": call.uploaded_at,
            "transcript_preview": call.transcript[:1000] + "...",
            "analysis": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load analysis: {str(e)}")

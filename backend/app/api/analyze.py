from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..models import Company, DocumentChunk
from ..services.llm_service import LLMService
from .auth import get_cached_keys
from .company import search_company

router = APIRouter(prefix="/analyze", tags=["AI Research & Analysis"])

@router.get("/summary")
def get_report_summary(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    search_company(ticker, db)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
        
    company_info = json.loads(company.profile_json)
    financials = json.loads(company.financial_statements_json)
    
    keys = get_cached_keys()
    summary = LLMService.generate_report_summary(company_info, financials, keys)
    return summary

@router.get("/risks")
def get_risk_analysis(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    search_company(ticker, db)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
        
    company_info = json.loads(company.profile_json)
    
    # Retrieve a few document chunks from SEC filings if available, to ground the analysis
    db_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.ticker == ticker, 
        DocumentChunk.filing_type == "10-K"
    ).limit(5).all()
    
    formatted_chunks = [{"text": c.text, "chunk_index": c.chunk_index} for c in db_chunks]
    
    keys = get_cached_keys()
    risks = LLMService.analyze_risks(company_info, formatted_chunks, keys)
    return risks

@router.get("/recommendation")
def get_investment_recommendation(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    search_company(ticker, db)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
        
    company_info = json.loads(company.profile_json)
    
    keys = get_cached_keys()
    recommendation = LLMService.generate_recommendation(company_info, keys)
    return recommendation

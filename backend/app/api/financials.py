from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..models import Company

router = APIRouter(prefix="/financials", tags=["Financial Statements"])

@router.get("/statements")
def get_statements(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found. Please search it first.")
        
    try:
        statements = json.loads(company.financial_statements_json)
        return statements
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load statements: {str(e)}")

@router.get("/ratios")
def get_ratios(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found. Please search it first.")
        
    try:
        ratios = json.loads(company.ratios_json)
        return ratios
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load ratios: {str(e)}")

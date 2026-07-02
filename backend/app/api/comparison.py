from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..models import Company
from .company import search_company

router = APIRouter(prefix="/comparison", tags=["Company Comparison"])

@router.get("")
def compare_companies(
    ticker1: str = Query(..., description="First stock ticker"),
    ticker2: str = Query(..., description="Second stock ticker"),
    db: Session = Depends(get_db)
):
    ticker1 = ticker1.strip().upper()
    ticker2 = ticker2.strip().upper()
    
    if ticker1 == ticker2:
        raise HTTPException(status_code=400, detail="Please choose two different tickers to compare")

    # Helper to load/search company
    def load_company_data(ticker):
        # Trigger search to load and cache if needed
        try:
            search_company(ticker, db)
            comp = db.query(Company).filter(Company.ticker == ticker).first()
            if comp:
                return {
                    "ticker": comp.ticker,
                    "name": comp.name,
                    "price": comp.price,
                    "market_cap": comp.market_cap,
                    "pe_ratio": comp.pe_ratio,
                    "eps": comp.eps,
                    "sector": comp.sector,
                    "ceo": comp.ceo,
                    "ratios": json.loads(comp.ratios_json) if comp.ratios_json else [],
                    "profile": json.loads(comp.profile_json) if comp.profile_json else {},
                    "financials": json.loads(comp.financial_statements_json) if comp.financial_statements_json else {}
                }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load comparison data for {ticker}: {str(e)}")
        return None

    data1 = load_company_data(ticker1)
    data2 = load_company_data(ticker2)
    
    if not data1 or not data2:
        raise HTTPException(status_code=404, detail="Could not load data for one or both companies")
        
    return {
        "company1": data1,
        "company2": data2
    }

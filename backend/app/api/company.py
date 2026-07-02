from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
import pandas as pd
import numpy as np
from datetime import datetime
from ..database import get_db
from ..models import Company
from ..services.yfinance_service import YFinanceService

router = APIRouter(prefix="/company", tags=["Company Profile"])

def calculate_technical_indicators(price_history: list) -> list:
    """Calculates SMA 20, SMA 50, RSI (14), and MACD for price history records."""
    if len(price_history) < 2:
        return price_history
        
    df = pd.DataFrame(price_history)
    
    # 1. Simple Moving Averages
    df["sma_20"] = df["close"].rolling(window=20).mean()
    df["sma_50"] = df["close"].rolling(window=50).mean()
    
    # 2. RSI (14)
    delta = df["close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    
    rs = gain / loss
    df["rsi"] = 100 - (100 / (1 + rs))
    
    # 3. MACD
    # MACD Line = 12 EMA - 26 EMA
    # Signal Line = 9 EMA of MACD
    ema_12 = df["close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd_line"] = ema_12 - ema_26
    df["macd_signal"] = df["macd_line"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd_line"] - df["macd_signal"]
    
    # Replace NaNs/Infs with None for JSON compliance
    df = df.replace([np.inf, -np.inf], None)
    df = df.astype(object).where(pd.notnull(df), None)
    
    return df.to_dict(orient="records")

@router.get("/search")
def search_company(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
        
    # Check DB cache
    company = db.query(Company).filter(Company.ticker == ticker).first()
    
    # Refresh cache if missing or older than 1 day
    should_refresh = True
    if company:
        time_diff = datetime.now() - company.last_updated
        if time_diff.days < 1:
            should_refresh = False
            
    if should_refresh:
        # Fetch from yfinance
        info = YFinanceService.get_ticker_info(ticker)
        financials = YFinanceService.get_financial_statements(ticker)
        
        # Calculate ratios cache
        from ..utils.ratios import FinancialRatiosCalculator
        ratios = FinancialRatiosCalculator.calculate_ratios(financials, info)
        
        if not company:
            company = Company(
                ticker=ticker,
                name=info["name"],
                sector=info["sector"],
                ceo=info["ceo"],
                market_cap=info["market_cap"],
                price=info["price"],
                pe_ratio=info["pe_ratio"],
                eps=info["eps"],
                summary=info["summary"],
                ratios_json=json.dumps(ratios),
                profile_json=json.dumps(info),
                financial_statements_json=json.dumps(financials)
            )
            db.add(company)
        else:
            company.name = info["name"]
            company.sector = info["sector"]
            company.ceo = info["ceo"]
            company.market_cap = info["market_cap"]
            company.price = info["price"]
            company.pe_ratio = info["pe_ratio"]
            company.eps = info["eps"]
            company.summary = info["summary"]
            company.ratios_json = json.dumps(ratios)
            company.profile_json = json.dumps(info)
            company.financial_statements_json = json.dumps(financials)
            
        db.commit()
        db.refresh(company)
        
    # Return formatted profile
    profile = json.loads(company.profile_json)
    profile["ratios"] = json.loads(company.ratios_json)
    return profile

@router.get("/history")
def get_history(ticker: str, period: str = "1y", interval: str = "1d"):
    ticker = ticker.strip().upper()
    hist = YFinanceService.get_historical_prices(ticker, period, interval)
    if not hist:
        raise HTTPException(status_code=404, detail=f"No price history found for ticker {ticker}")
        
    # Calculate SMA, RSI, MACD
    processed_hist = calculate_technical_indicators(hist)
    return processed_hist

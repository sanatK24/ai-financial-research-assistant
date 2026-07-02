from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import NewsArticle
from ..services.news_service import NewsService

router = APIRouter(prefix="/news", tags=["Financial News"])

@router.get("")
def get_news(ticker: str = Query(..., description="Stock Ticker Symbol"), db: Session = Depends(get_db)):
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
        
    # Fetch from news service
    articles_data = NewsService.get_ticker_news(ticker)
    
    # Save/update articles in the DB for persistence
    saved_articles = []
    for art in articles_data:
        # Check if already exists in DB by title and ticker
        existing = db.query(NewsArticle).filter(
            NewsArticle.ticker == ticker, 
            NewsArticle.title == art["title"]
        ).first()
        
        if not existing:
            news_item = NewsArticle(
                ticker=ticker,
                title=art["title"],
                url=art["url"],
                source=art["source"],
                summary=art["summary"],
                sentiment_score=art["sentiment_score"],
                sentiment_label=art["sentiment_label"],
                published_date=art["published_date"]
            )
            db.add(news_item)
            db.commit()
            db.refresh(news_item)
            saved_articles.append(news_item)
        else:
            # Update summary and sentiment if changed
            existing.summary = art["summary"]
            existing.sentiment_score = art["sentiment_score"]
            existing.sentiment_label = art["sentiment_label"]
            db.commit()
            db.refresh(existing)
            saved_articles.append(existing)
            
    # Fallback to local DB records if scraping returned nothing
    if not saved_articles:
        saved_articles = db.query(NewsArticle).filter(NewsArticle.ticker == ticker).order_by(NewsArticle.created_at.desc()).limit(15).all()
        
    return saved_articles

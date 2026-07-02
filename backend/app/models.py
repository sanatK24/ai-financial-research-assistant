from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base

class Company(Base):
    __tablename__ = "companies"

    ticker = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    sector = Column(String, nullable=True)
    ceo = Column(String, nullable=True)
    market_cap = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    summary = Column(Text, nullable=True)
    
    # Store JSON strings for flexible fields
    ratios_json = Column(Text, nullable=True)  # Calulated ratios dict
    profile_json = Column(Text, nullable=True) # Full profile metadata
    financial_statements_json = Column(Text, nullable=True) # Income/Balance/Cashflow data
    
    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), default=func.now())


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticker = Column(String, index=True)
    title = Column(String)
    url = Column(String, nullable=True)
    source = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    sentiment_score = Column(Float, nullable=True)  # -1.0 to 1.0
    sentiment_label = Column(String, nullable=True)  # Bullish, Bearish, Neutral
    published_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EarningsCall(Base):
    __tablename__ = "earnings_calls"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticker = Column(String, index=True)
    quarter = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    filename = Column(String)
    transcript = Column(Text)
    analysis_json = Column(Text, nullable=True)  # Extracted CEO/CFO comments, guidance, sentiment
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticker = Column(String, index=True)
    filing_type = Column(String, index=True) # 10-K, 10-Q, earnings_call, news, etc.
    source_name = Column(String, nullable=True) # e.g. "FY2024 10-K"
    text = Column(Text)
    chunk_index = Column(Integer)
    embedding_json = Column(Text, nullable=True) # JSON array of floats for custom embedding storage
    created_at = Column(DateTime(timezone=True), server_default=func.now())

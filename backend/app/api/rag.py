from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
from ..database import get_db
from ..models import DocumentChunk, Company
from ..services.sec_service import SecService
from ..services.rag_engine import RAGEngine
from ..services.llm_service import LLMService
from .auth import get_cached_keys
from .company import search_company

router = APIRouter(prefix="/rag", tags=["RAG Engine & SEC Q&A"])

class QueryRequest(BaseModel):
    ticker: str
    query: str

@router.post("/query")
def query_sec_filings(request: QueryRequest, db: Session = Depends(get_db)):
    ticker = request.ticker.strip().upper()
    query = request.query.strip()
    
    if not ticker or not query:
        raise HTTPException(status_code=400, detail="Ticker and query are required")
        
    # Ensure company profile is loaded in DB first
    search_company(ticker, db)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    company_info = json.loads(company.profile_json) if company else {"ticker": ticker}
    
    # 1. Check if we have chunks for this ticker in the DB
    chunks_count = db.query(DocumentChunk).filter(DocumentChunk.ticker == ticker).count()
    
    if chunks_count == 0:
        # Trigger download and chunking of filings
        try:
            # Download 10-K report (limit to 1 for speed)
            filings = SecService.download_filings(ticker, "10-K", limit=1)
            
            # Chunk and store in DB
            for filing in filings:
                text_content = filing["text"]
                source_name = filing["source_name"]
                
                # Split text into chunks
                chunks = RAGEngine.chunk_text(text_content)
                for idx, chunk in enumerate(chunks):
                    doc_chunk = DocumentChunk(
                        ticker=ticker,
                        filing_type="10-K",
                        source_name=source_name,
                        text=chunk,
                        chunk_index=idx
                    )
                    db.add(doc_chunk)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to fetch or index SEC filings: {str(e)}")
            
    # Retrieve all chunks for this ticker
    db_chunks = db.query(DocumentChunk).filter(DocumentChunk.ticker == ticker).all()
    chunk_texts = [c.text for c in db_chunks]
    
    if not chunk_texts:
        raise HTTPException(status_code=404, detail=f"No SEC filing context available for ticker {ticker}")
        
    # 2. Retrieve Top-K matching chunks
    keys = get_cached_keys()
    # If the user provides a key, we can use embedding-based RAG if configured, but default to TF-IDF.
    retrieved_chunks = RAGEngine.retrieve_top_k(query, chunk_texts, top_k=5)
    
    # Map retrieved index back to DB chunks to get metadata (like source_name)
    formatted_retrieved = []
    for ret in retrieved_chunks:
        db_chunk = db_chunks[ret["chunk_index"]]
        formatted_retrieved.append({
            "text": ret["text"],
            "score": ret["score"],
            "chunk_index": ret["chunk_index"],
            "source_name": db_chunk.source_name,
            "filing_type": db_chunk.filing_type
        })
        
    # 3. Ask LLM to answer the question using the context
    answer = LLMService.generate_answer(query, formatted_retrieved, company_info, keys)
    
    return {
        "ticker": ticker,
        "query": query,
        "answer": answer,
        "retrieved_context": formatted_retrieved
    }

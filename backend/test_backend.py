import os
import sys
import json

# Add project root to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import engine, Base, SessionLocal
from backend.app.services.yfinance_service import YFinanceService
from backend.app.services.sec_service import SecService
from backend.app.services.rag_engine import RAGEngine
from backend.app.services.news_service import NewsService
from backend.app.services.llm_service import LLMService
from backend.app.utils.ratios import FinancialRatiosCalculator
from backend.app.utils.nlp import NLPUtils

def run_tests():
    print("==================================================")
    print("   AI Financial Research Assistant Backend Tests   ")
    print("==================================================")
    
    # 1. DB Init
    print("\n1. Testing Database Initialization...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ Database initialized successfully.")
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
        return
        
    # 2. yfinance profile fetch
    print("\n2. Testing YFinanceService Fetching...")
    ticker = "AAPL"
    try:
        info = YFinanceService.get_ticker_info(ticker)
        print(f"✓ Ticker info fetched for {ticker}: {info.get('name')}")
        print(f"  Price: ${info.get('price')}, Cap: ${info.get('market_cap'):,}")
        
        financials = YFinanceService.get_financial_statements(ticker)
        print(f"✓ Financial statements fetched. Annual Income Statement rows: {len(financials.get('income_statement_annual', []))}")
        
        history = YFinanceService.get_historical_prices(ticker, period="1mo")
        print(f"✓ Historical prices fetched (1 month). Days fetched: {len(history)}")
    except Exception as e:
        print(f"✗ YFinanceService failed: {e}")
        
    # 3. SEC synthetic report
    print("\n3. Testing SecService...")
    try:
        filings = SecService.download_filings(ticker, "10-K", limit=1)
        print(f"✓ Filing processed. Source name: {filings[0]['source_name']}")
        print(f"  Filing length: {len(filings[0]['text'])} characters.")
    except Exception as e:
        print(f"✗ SecService failed: {e}")
        
    # 4. RAG chunking & retrieval
    print("\n4. Testing RAGEngine...")
    try:
        text = (
            "We design, manufacture, and market smartphones, personal computers, tablets, wearables, and accessories. "
            "Our net sales were 385 billion dollars in FY2023. Our primary risk is competition in consumer markets. "
            "We face litigation risks globally, including regulatory investigations regarding App Store fee structures. "
            "Our chief manufacturing fabrication partner is TSMC in Taiwan, exposing us to supply chain bottlenecks. "
            "Management guidance forecasts steady growth in cloud service and AI features in the next year."
        )
        chunks = RAGEngine.chunk_text(text, chunk_size=200, overlap=50)
        print(f"✓ Text split into {len(chunks)} chunks.")
        
        query = "What is the primary risk?"
        results = RAGEngine.retrieve_top_k(query, chunks, top_k=2)
        print(f"✓ Retrieval successful for query '{query}':")
        for r in results:
            print(f"  - Chunk {r['chunk_index']} (score {r['score']:.3f}): {r['text'][:100]}")
    except Exception as e:
        print(f"✗ RAGEngine failed: {e}")
        
    # 5. News sentiment
    print("\n5. Testing NewsService...")
    try:
        articles = NewsService.get_ticker_news(ticker)
        print(f"✓ Fetched and analyzed {len(articles)} news items for {ticker}.")
        if articles:
            print(f"  Sample article: {articles[0]['title']}")
            print(f"  Sentiment Score: {articles[0]['sentiment_score']}, Label: {articles[0]['sentiment_label']}")
    except Exception as e:
        print(f"✗ NewsService failed: {e}")
        
    # 6. Heuristic AI summaries
    print("\n6. Testing LLMService Fallback/Heuristics...")
    try:
        comp_info = YFinanceService.get_ticker_info(ticker)
        financials = YFinanceService.get_financial_statements(ticker)
        report = LLMService.generate_report_summary(comp_info, financials)
        print("✓ AI report generated successfully using heuristics:")
        print(f"  Executive Summary: {report.get('executive_summary')[:100]}...")
        print(f"  Bullish Signals: {report.get('bullish_signals')}")
    except Exception as e:
        print(f"✗ LLMService heuristics failed: {e}")
        
    # 7. Financial ratios calculator
    print("\n7. Testing FinancialRatiosCalculator...")
    try:
        comp_info = YFinanceService.get_ticker_info(ticker)
        financials = YFinanceService.get_financial_statements(ticker)
        ratios = FinancialRatiosCalculator.calculate_ratios(financials, comp_info)
        print(f"✓ Ratios calculated successfully for {len(ratios)} periods.")
        if ratios:
            print(f"  Latest Period: {ratios[0]['date']}")
            print(f"  Current Ratio: {ratios[0]['current_ratio']}, Debt/Equity: {ratios[0]['debt_equity']}")
            print(f"  ROE: {ratios[0]['roe']}%, ROA: {ratios[0]['roa']}%")
    except Exception as e:
        print(f"✗ FinancialRatiosCalculator failed: {e}")

    # 8. NLP Utilities
    print("\n8. Testing NLP Heuristic Extractor...")
    try:
        sample_text = "Apple CEO Tim Cook announced capital expenditure of $4.2 billion for FY2024 during the press meeting."
        entities = NLPUtils.extract_entities(sample_text)
        print(f"✓ Entities extracted:")
        print(f"  Organizations: {entities['organizations']}")
        print(f"  Money: {entities['money']}")
        print(f"  Roles: {entities['roles']}")
        print(f"  Dates: {entities['dates']}")
    except Exception as e:
        print(f"✗ NLPUtils failed: {e}")
        
    print("\n==================================================")
    print("                 Tests Completed                  ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

import yfinance as yf
import pandas as pd
import json
import logging

logger = logging.getLogger("uvicorn.error")

class YFinanceService:
    @staticmethod
    def get_ticker_info(ticker: str) -> dict:
        """Fetches metadata, profile, and current price details for a ticker."""
        try:
            ticker_clean = ticker.strip().upper()
            t = yf.Ticker(ticker_clean)
            info = t.info
            
            # Use history to get the latest close price if currentPrice is missing
            current_price = info.get("currentPrice") or info.get("regularMarketPrice")
            if not current_price:
                hist = t.history(period="1d")
                if not hist.empty:
                    current_price = float(hist["Close"].iloc[-1])
                else:
                    current_price = 0.0

            # Safeguard data parsing
            result = {
                "ticker": ticker_clean,
                "name": info.get("longName") or info.get("shortName") or ticker_clean,
                "sector": info.get("sector") or "N/A",
                "industry": info.get("industry") or "N/A",
                "ceo": info.get("ceo") or "N/A",
                "market_cap": info.get("marketCap") or 0.0,
                "price": current_price,
                "pe_ratio": info.get("trailingPE") or info.get("forwardPE") or None,
                "eps": info.get("trailingEps") or info.get("forwardEps") or 0.0,
                "dividend_yield": info.get("dividendYield") or 0.0,
                "summary": info.get("longBusinessSummary") or "No business summary available.",
                "fifty_two_week_high": info.get("fiftyTwoWeekHigh") or 0.0,
                "fifty_two_week_low": info.get("fiftyTwoWeekLow") or 0.0,
                "volume": info.get("volume") or info.get("regularMarketVolume") or 0,
                "average_volume": info.get("averageVolume") or 0,
                "website": info.get("website") or "N/A",
                "employees": info.get("fullTimeEmployees") or "N/A",
                "country": info.get("country") or "N/A"
            }
            return result
        except Exception as e:
            logger.error(f"Error fetching ticker info for {ticker}: {str(e)}")
            # Return basic fallback dictionary
            return {
                "ticker": ticker.upper(),
                "name": ticker.upper(),
                "sector": "N/A",
                "ceo": "N/A",
                "market_cap": 0.0,
                "price": 0.0,
                "pe_ratio": None,
                "eps": 0.0,
                "summary": f"Failed to retrieve data for {ticker}. Error: {str(e)}",
                "dividend_yield": 0.0,
                "fifty_two_week_high": 0.0,
                "fifty_two_week_low": 0.0,
                "volume": 0
            }

    @staticmethod
    def get_financial_statements(ticker: str) -> dict:
        """Fetches annual and quarterly financial statements."""
        try:
            ticker_clean = ticker.strip().upper()
            t = yf.Ticker(ticker_clean)
            
            # Helper to convert DataFrame into clean dictionary list
            def df_to_dict(df):
                if df is None or df.empty:
                    return []
                # Clean up column names (dates) to string format YYYY-MM-DD
                cols = [str(c).split()[0] for c in df.columns]
                cleaned_df = df.copy()
                cleaned_df.columns = cols
                
                # Replace NaN with None for JSON compliance
                cleaned_df = cleaned_df.astype(object).where(pd.notnull(cleaned_df), None)
                
                # Format: List of rows, each having metric and values for dates
                rows = []
                for index, row in cleaned_df.iterrows():
                    metric_dict = {"metric": str(index)}
                    for col in cols:
                        metric_dict[col] = row[col]
                    rows.append(metric_dict)
                return rows

            statements = {
                "income_statement_annual": df_to_dict(t.financials),
                "income_statement_quarterly": df_to_dict(t.quarterly_financials),
                "balance_sheet_annual": df_to_dict(t.balance_sheet),
                "balance_sheet_quarterly": df_to_dict(t.quarterly_balance_sheet),
                "cash_flow_annual": df_to_dict(t.cashflow),
                "cash_flow_quarterly": df_to_dict(t.quarterly_cashflow)
            }
            return statements
        except Exception as e:
            logger.error(f"Error fetching financials for {ticker}: {str(e)}")
            return {
                "income_statement_annual": [],
                "income_statement_quarterly": [],
                "balance_sheet_annual": [],
                "balance_sheet_quarterly": [],
                "cash_flow_annual": [],
                "cash_flow_quarterly": []
            }

    @staticmethod
    def get_historical_prices(ticker: str, period: str = "1y", interval: str = "1d") -> list:
        """Fetches historical price data for charting (default 1 year)."""
        try:
            ticker_clean = ticker.strip().upper()
            t = yf.Ticker(ticker_clean)
            hist = t.history(period=period, interval=interval)
            
            if hist.empty:
                return []
            
            # Format history DataFrame to a JSON-compatible list
            hist = hist.reset_index()
            # Ensure Date column is string
            if "Date" in hist.columns:
                hist["Date"] = hist["Date"].dt.strftime("%Y-%m-%d")
            elif "Datetime" in hist.columns:
                hist["Date"] = hist["Datetime"].dt.strftime("%Y-%m-%d %H:%M")
                hist.rename(columns={"Datetime": "Date"}, inplace=True)
            
            # Replace NaNs
            hist = hist.astype(object).where(pd.notnull(hist), None)
            
            records = []
            for _, row in hist.iterrows():
                records.append({
                    "date": row["Date"],
                    "open": float(row["Open"]) if row["Open"] is not None else None,
                    "high": float(row["High"]) if row["High"] is not None else None,
                    "low": float(row["Low"]) if row["Low"] is not None else None,
                    "close": float(row["Close"]) if row["Close"] is not None else None,
                    "volume": int(row["Volume"]) if row["Volume"] is not None else None
                })
            return records
        except Exception as e:
            logger.error(f"Error fetching price history for {ticker}: {str(e)}")
            return []

    @staticmethod
    def get_ticker_news(ticker: str) -> list:
        """Fetches news from Yahoo Finance for a specific ticker."""
        try:
            ticker_clean = ticker.strip().upper()
            t = yf.Ticker(ticker_clean)
            news = t.news or []
            
            articles = []
            for item in news[:10]: # Limit to top 10
                articles.append({
                    "title": item.get("title"),
                    "url": item.get("link"),
                    "source": item.get("publisher"),
                    "published_date": str(pd.to_datetime(item.get("providerPublishTime"), unit="s")) if item.get("providerPublishTime") else None,
                    "summary": item.get("summary") or ""
                })
            return articles
        except Exception as e:
            logger.error(f"Error fetching news for {ticker}: {str(e)}")
            return []

import urllib.request
import xml.etree.ElementTree as ET
import re
import logging
from typing import List, Dict, Any
from .yfinance_service import YFinanceService

logger = logging.getLogger("uvicorn.error")

class NewsService:
    @staticmethod
    def get_ticker_news(ticker: str) -> List[Dict[str, Any]]:
        """Retrieves and analyzes news from Yahoo Finance and feeds for a ticker."""
        # 1. Fetch yfinance news
        articles = YFinanceService.get_ticker_news(ticker)
        
        # 2. Try scraping general financial RSS feeds for headlines
        # CNBC RSS is publicly accessible and doesn't block simple requests
        rss_articles = NewsService.fetch_rss_news(ticker)
        articles.extend(rss_articles)
        
        # Remove duplicate titles
        seen_titles = set()
        unique_articles = []
        for art in articles:
            title = (art.get("title") or "").strip()
            if not title:
                continue
            title_lower = title.lower()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                # Compute sentiment & summary on the fly
                analyzed = NewsService.analyze_sentiment_and_summarize(art)
                unique_articles.append(analyzed)
                
        # Limit to top 15 articles
        return unique_articles[:15]

    @staticmethod
    def fetch_rss_news(ticker: str) -> List[Dict[str, Any]]:
        """Fetches ticker-related headlines from CNBC or MarketWatch RSS feeds."""
        articles = []
        # General RSS feed
        url = "https://search.cnbc.com/rs/search/all/view.rss?partnerId=2000&keywords=" + ticker.upper()
        
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                xml_data = response.read()
                
            root = ET.fromstring(xml_data)
            channel = root.find("channel")
            if channel is not None:
                for item in channel.findall("item")[:10]:
                    title = item.find("title").text if item.find("title") is not None else ""
                    link = item.find("link").text if item.find("link") is not None else ""
                    pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                    desc = item.find("description").text if item.find("description") is not None else ""
                    
                    # Clean desc (HTML tags removal)
                    desc_clean = re.sub('<[^<]+?>', '', desc).strip() if desc else ""
                    
                    articles.append({
                        "title": title,
                        "url": link,
                        "source": "CNBC",
                        "published_date": pub_date,
                        "summary": desc_clean
                    })
        except Exception as e:
            logger.info(f"Failed to fetch RSS news for {ticker}: {str(e)}")
            
        return articles

    @staticmethod
    def analyze_sentiment_and_summarize(article: Dict[str, Any]) -> Dict[str, Any]:
        """Runs rule-based lexicon sentiment scoring and builds clean summary."""
        title = article.get("title") or ""
        summary = article.get("summary") or ""
        text = (title + " " + summary).lower()
        
        # Financial sentiment keywords list
        bullish_words = [
            "growth", "increase", "profit", "record", "bullish", "beat", "gain", "upgrade", 
            "positive", "win", "surge", "higher", "outperform", "buy", "successful", "expansion", 
            "accelerate", "exceed", "bull", "rally", "advantage", "strong"
        ]
        bearish_words = [
            "decline", "drop", "loss", "risk", "litigation", "bearish", "miss", "warning", 
            "downgrade", "negative", "fail", "plunge", "lower", "underperform", "sell", "debt", 
            "concern", "decrease", "bear", "slide", "threat", "weak", "disrupt", "lawsuit", "fine"
        ]
        
        # Word counts
        bull_count = sum(1 for word in bullish_words if word in text)
        bear_count = sum(1 for word in bearish_words if word in text)
        
        # Compute ratio-based score (-1.0 to 1.0)
        total = bull_count + bear_count
        if total == 0:
            score = 0.0
            label = "Neutral"
        else:
            score = (bull_count - bear_count) / total
            # Categorize
            if score > 0.15:
                label = "Bullish"
            elif score < -0.15:
                label = "Bearish"
            else:
                label = "Neutral"
                
        # Generate summary if missing
        summary_clean = summary
        if not summary_clean:
            summary_clean = f"Financial article discussing {title} in relation to company operations."
            
        result = article.copy()
        result.update({
            "sentiment_score": round(score, 2),
            "sentiment_label": label,
            "summary": summary_clean
        })
        return result

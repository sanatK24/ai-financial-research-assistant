import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger("uvicorn.error")

class NLPUtils:
    @staticmethod
    def extract_entities(text: str) -> Dict[str, List[str]]:
        """Extracts financial and corporate entities (Organizations, Money, Roles, Dates) from text.
        Falls back to regex-based heuristics for 100% local robustness.
        """
        entities = {
            "organizations": [],
            "money": [],
            "roles": [],
            "dates": []
        }
        
        if not text:
            return entities
            
        try:
            # 1. Organizations Heuristics (capitalized words followed by Inc., Corp., Co., Ltd., etc.)
            org_pattern = r'\b[A-Z][a-zA-Z0-9\s]{1,30}?\b\s?(?:Inc\.|Corp\.|Corporation|Co\.|Ltd\.|LLC|Group|PLC)\b'
            orgs = re.findall(org_pattern, text)
            entities["organizations"] = list(set([o.strip() for o in orgs]))
            
            # 2. Money Heuristics (currencies, dollar values with millions/billions)
            money_pattern = r'(?:\$|£|€)\s?\d+(?:\.\d+)?\s?(?:million|billion|trillion|B|M|K)?\b'
            money_vals = re.findall(money_pattern, text)
            entities["money"] = list(set([m.strip() for m in money_vals]))
            
            # 3. Roles Heuristics (CEO, CFO, COO, Founder, Chairman, etc.)
            roles_pattern = r'\b(?:CEO|CFO|COO|President|Chairman|Founder|Chief Executive Officer|Chief Financial Officer|Director)\b'
            roles = re.findall(roles_pattern, text)
            entities["roles"] = list(set(roles))
            
            # 4. Dates Heuristics (Q1/Q2/Q3/Q4/FY + Year, or Month Day, Year)
            dates_pattern = r'\b(?:Q[1-4]\s?\d{4}|FY\s?\d{4}|fiscal\s?\d{4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},\s\d{4})\b'
            dates = re.findall(dates_pattern, text)
            entities["dates"] = list(set(dates))
            
        except Exception as e:
            logger.error(f"Error in entity extraction: {str(e)}")
            
        return entities

    @staticmethod
    def extract_topics(text: str) -> List[str]:
        """Identifies key financial topics/themes discussed in the text.
        Returns a list of identified topics based on word density matching.
        """
        topics_dict = {
            "AI & Cloud Strategy": ["ai", "artificial intelligence", "cloud", "azure", "aws", "gpu", "data center", "copilot", "llm"],
            "Supply Chain & Logistics": ["supply chain", "logistics", "manufacturing", "inventory", "freight", "fab", "tsmc", "shipping"],
            "Capital Allocation": ["share buyback", "dividend", "capex", "capital expenditure", "reinvest", "acquisition", "merge"],
            "Legal & Regulatory": ["antitrust", "litigation", "lawsuit", "ftc", "sec", "regulation", "compliance", "fine", "investigation"],
            "Financial Growth": ["revenue", "profit", "ebitda", "operating income", "earnings", "gross margin", "growth", "accelerate"],
            "Labor & Operations": ["employees", "workforce", "hiring", "headcount", "layoff", "restructuring", "severance"]
        }
        
        text_lower = text.lower()
        matched_topics = []
        
        for topic, keywords in topics_dict.items():
            score = 0
            for kw in keywords:
                # Count matches
                score += len(re.findall(r'\b' + re.escape(kw) + r'\b', text_lower))
            if score > 0:
                matched_topics.append((score, topic))
                
        # Sort by match score descending
        matched_topics.sort(reverse=True)
        return [t[1] for t in matched_topics[:4]]

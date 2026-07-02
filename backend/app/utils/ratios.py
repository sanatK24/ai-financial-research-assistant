import pandas as pd
import logging
from typing import Dict, Any, List

logger = logging.getLogger("uvicorn.error")

class FinancialRatiosCalculator:
    @staticmethod
    def calculate_ratios(financials: Dict[str, Any], ticker_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Calculates financial ratios for each historical year.
        Uses partial row name matching for robustness across yfinance updates.
        """
        income_stmt = financials.get("income_statement_annual", [])
        balance_sheet = financials.get("balance_sheet_annual", [])
        
        # Extract dates available (column names other than 'metric')
        dates = set()
        for row in income_stmt:
            for key in row.keys():
                if key != "metric":
                    dates.add(key)
        for row in balance_sheet:
            for key in row.keys():
                if key != "metric":
                    dates.add(key)
                    
        sorted_dates = sorted(list(dates), reverse=True)
        if not sorted_dates:
            return []

        # Convert list of rows to a dictionary for easier row lookup
        is_dict = {row["metric"].strip().lower(): row for row in income_stmt}
        bs_dict = {row["metric"].strip().lower(): row for row in balance_sheet}
        
        def find_value(data_dict, keywords, date):
            """Finds a value in the statement using keyword matching."""
            for key, row in data_dict.items():
                if any(kw in key for kw in keywords):
                    val = row.get(date)
                    if val is not None:
                        try:
                            return float(val)
                        except (ValueError, TypeError):
                            pass
            return None

        calculated_ratios_by_year = []
        
        for date in sorted_dates:
            # 1. Fetch values with partial keyword matches
            revenue = find_value(is_dict, ["total revenue", "revenue", "total sales", "sales"], date)
            net_income = find_value(is_dict, ["net income", "net income common stockholders", "net profit"], date)
            operating_income = find_value(is_dict, ["operating income", "operating income/expense", "ebit"], date)
            ebitda = find_value(is_dict, ["ebitda", "ebitda"], date)
            
            total_assets = find_value(bs_dict, ["total assets", "assets"], date)
            current_assets = find_value(bs_dict, ["total current assets", "current assets"], date)
            current_liabilities = find_value(bs_dict, ["total current liabilities", "current liabilities"], date)
            inventory = find_value(bs_dict, ["inventory", "inventories"], date) or 0.0
            
            equity = find_value(bs_dict, ["stockholders equity", "total stockholders' equity", "total equity", "common stock equity"], date)
            total_debt = find_value(bs_dict, ["total debt", "long term debt", "net debt"], date)
            # If total debt is not found, try adding long term and short term debt
            if total_debt is None:
                lt_debt = find_value(bs_dict, ["long term debt", "long-term debt"], date) or 0.0
                st_debt = find_value(bs_dict, ["short term debt", "current debt", "current portion of long term debt"], date) or 0.0
                total_debt = lt_debt + st_debt if lt_debt or st_debt else None

            # 2. Compute Ratios
            ratios = {"date": date}
            
            # Current Ratio
            if current_assets and current_liabilities:
                ratios["current_ratio"] = round(current_assets / current_liabilities, 2)
            else:
                ratios["current_ratio"] = None
                
            # Quick Ratio
            if current_assets and current_liabilities:
                ratios["quick_ratio"] = round((current_assets - inventory) / current_liabilities, 2)
            else:
                ratios["quick_ratio"] = None
                
            # Debt Equity
            if total_debt is not None and equity:
                ratios["debt_equity"] = round(total_debt / equity, 2)
            else:
                ratios["debt_equity"] = None
                
            # ROE (Return on Equity)
            if net_income and equity:
                ratios["roe"] = round((net_income / equity) * 100, 2)
            else:
                ratios["roe"] = None
                
            # ROA (Return on Assets)
            if net_income and total_assets:
                ratios["roa"] = round((net_income / total_assets) * 100, 2)
            else:
                ratios["roa"] = None
                
            # Net Margin
            if net_income and revenue:
                ratios["net_margin"] = round((net_income / revenue) * 100, 2)
            else:
                ratios["net_margin"] = None
                
            # Operating Margin
            if operating_income and revenue:
                ratios["operating_margin"] = round((operating_income / revenue) * 100, 2)
            else:
                ratios["operating_margin"] = None
                
            # EBITDA Margin
            # Calculate if EBITDA is missing: EBITDA = EBIT (Operating Income) + D&A (Depreciation and Amortization)
            if ebitda is None and operating_income is not None:
                # Try finding D&A in cash flow statement
                cf_dict = {row["metric"].strip().lower(): row for row in financials.get("cash_flow_annual", [])}
                da = find_value(cf_dict, ["depreciation", "depreciation and amortization", "amortization"], date) or 0.0
                ebitda = operating_income + da
                
            if ebitda and revenue:
                ratios["ebitda_margin"] = round((ebitda / revenue) * 100, 2)
            else:
                ratios["ebitda_margin"] = None
                
            # Dividend Yield
            ratios["dividend_yield"] = round(ticker_info.get("dividend_yield", 0.0) * 100, 2)
            
            calculated_ratios_by_year.append(ratios)
            
        return calculated_ratios_by_year

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os

router = APIRouter(prefix="/auth", tags=["Auth & Settings"])

# Persist settings in a JSON file inside the backend directory
SETTINGS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "settings.json"))

class SettingsSchema(BaseModel):
    openai_key: str = ""
    gemini_key: str = ""
    default_ticker: str = "AAPL"

@router.get("/settings", response_model=SettingsSchema)
def get_settings():
    if not os.path.exists(SETTINGS_FILE):
        return SettingsSchema()
    
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return SettingsSchema(**data)
    except Exception:
        return SettingsSchema()

@router.post("/settings")
def save_settings(settings: SettingsSchema):
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings.dict(), f, indent=4)
        return {"status": "success", "message": "Settings saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

# Memory cache helper for services to read keys
def get_cached_keys() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        return {"openai": "", "gemini": ""}
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return {
                "openai": data.get("openai_key", "").strip(),
                "gemini": data.get("gemini_key", "").strip()
            }
    except Exception:
        return {"openai": "", "gemini": ""}

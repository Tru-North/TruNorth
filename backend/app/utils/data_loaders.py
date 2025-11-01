# backend/app/utils/data_loaders.py
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any

# Adjust if your backend folder differs
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
QUESTIONS_PATH = DATA_DIR / "questions.json"
CHAT_SCRIPT_PATH = DATA_DIR / "chat_script.json"


@lru_cache(maxsize=1)
def load_questions() -> Dict[str, Dict[str, Any]]:
    """
    Builds a lookup dict for questionnaire questions.
    Keys by question_id → includes text, type, category, and optional scale.
    Compatible with both 'sections' and category-based structures.
    """
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    lookup: Dict[str, Dict[str, Any]] = {}

    # Handle shape: { "sections": [ {category, display_name, questions:[...]}, ...] }
    if isinstance(data, dict) and "sections" in data:
        for sec in data["sections"]:
            category = sec.get("display_name") or sec.get("category")
            for q in sec.get("questions", []):
                qid = q.get("id")
                if qid:
                    lookup[qid] = {
                        "category": category,
                        "question_text": q.get("question") or q.get("question_text"),
                        "type": q.get("type"),
                        "scale": q.get("scale"),
                    }
        return lookup

    # Handle shape: { "about_me": {...}, "values": {...} }
    for category, info in data.items():
        if not isinstance(info, dict) or "questions" not in info:
            continue
        display = info.get("display_name") or category
        for q in info.get("questions", []):
            qid = q.get("id")
            if qid:
                lookup[qid] = {
                    "category": display,
                    "question_text": q.get("question") or q.get("question_text"),
                    "type": q.get("type"),
                    "scale": q.get("scale"),
                }
    return lookup

@lru_cache(maxsize=1)
def load_chat_script() -> Dict[str, Dict[str, Any]]:
    """
    Builds a lookup dict for intro chat questions keyed by chat_id.
    Matches your file format:
    {
      "version": "...",
      "checksum": "...",
      "intro_chat": [ {...}, {...} ]
    }
    """
    with open(CHAT_SCRIPT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    lookup: Dict[str, Dict[str, Any]] = {}

    intro_chat = data.get("intro_chat")
    if intro_chat and isinstance(intro_chat, list):
        for item in intro_chat:
            cid = item.get("id") or item.get("chat_id")
            if cid:
                lookup[cid] = {
                    "question_text": item.get("text") or item.get("question") or item.get("question_text")
                }

    return lookup

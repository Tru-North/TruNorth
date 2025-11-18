from __future__ import annotations
from datetime import datetime
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Set
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import FEATURE_ONET, FEATURE_ADZUNA
from app.models.user import User
from app.models.final_data import UserFinalData
from app.models.career_profile import CareerProfile
from app.models.user_recommendation import (
    UserCareerRecommendation,
    UserRecommendationAction,
)
from app.services.embedding_service import embed_texts
from app.services.final_data_service import build_user_final_json
from openai import AzureOpenAI
from app.core.config import settings
from app.services.external_data_service import (
    onet_search_occupations, onet_get_details,
    adzuna_salary_stats, adzuna_history_trend,
)

_azure_explanation_client: Optional[AzureOpenAI] = None


def _get_azure_explanation_client() -> AzureOpenAI:
    """Return a shared Azure OpenAI client for explanation generation."""
    global _azure_explanation_client

    if _azure_explanation_client is not None:
        return _azure_explanation_client

    if not settings.AZURE_FOUNDRY_API_KEY or not settings.AZURE_FOUNDRY_ENDPOINT:
        raise RuntimeError("Azure Foundry credentials missing for explanation generation.")

    _azure_explanation_client = AzureOpenAI(
        api_version="2024-12-01-preview",
        azure_endpoint=settings.AZURE_FOUNDRY_ENDPOINT,
        api_key=settings.AZURE_FOUNDRY_API_KEY,
    )
    return _azure_explanation_client


SOC_SECTOR_MAP: Dict[str, str] = {
    "11": "Corporate Leadership",
    "13": "Finance & Business",
    "15": "Technology & Computing",
    "17": "Engineering & Architecture",
    "19": "Science & Analytics",
    "21": "Community & Social Services",
    "23": "Legal Services",
    "25": "Education & Training",
    "27": "Arts, Design & Media",
    "29": "Healthcare Practitioners",
    "31": "Healthcare Support",
    "33": "Protective Services",
    "35": "Food & Hospitality",
    "37": "Facilities & Maintenance",
    "39": "Personal Care & Services",
    "41": "Sales & Client Relations",
    "43": "Administrative & Operations",
    "45": "Agriculture & Natural Resources",
    "47": "Construction & Extraction",
    "49": "Installation & Repair",
    "51": "Manufacturing & Production",
    "53": "Transportation & Logistics",
    "55": "Military & Protective Service",
}


def _load_growth_baselines() -> Dict[str, float]:
    data_path = Path(__file__).resolve().parents[2] / "data" / "soc_growth_baselines.json"
    try:
        with data_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

    baselines: Dict[str, float] = {}
    for key, value in payload.items():
        code = str(key).zfill(2)
        try:
            baselines[code] = float(value)
        except (TypeError, ValueError):
            continue
    return baselines


GROWTH_BASELINES = _load_growth_baselines()


def _infer_industry_tag(soc: Optional[str], title: Optional[str]) -> str:
    if soc:
        digits = "".join(ch for ch in soc if ch.isdigit())
        if len(digits) >= 2:
            sector = SOC_SECTOR_MAP.get(digits[:2])
            if sector:
                return sector

    if title:
        lowered = title.lower()
        keyword_map = {
            "software": "Technology & Computing",
            "data": "Science & Analytics",
            "nurse": "Healthcare Practitioners",
            "teacher": "Education & Training",
            "marketing": "Sales & Client Relations",
            "construction": "Construction & Extraction",
            "manufacturing": "Manufacturing & Production",
            "logistics": "Transportation & Logistics",
        }
        for key, label in keyword_map.items():
            if key in lowered:
                return label

    return "General Professional Services"


def _estimate_growth_percent_from_soc(soc: Optional[str]) -> Optional[float]:
    if not soc:
        return None
    digits = "".join(ch for ch in soc if ch.isdigit())
    if len(digits) < 2:
        return None
    return GROWTH_BASELINES.get(digits[:2])


def _percent_from_string(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    arrow: Optional[str] = None
    if text[0] in {"↑", "↓", "→"}:
        arrow = text[0]
        text = text[1:].strip()

    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None

    try:
        percent = float(match.group())
    except ValueError:
        return None

    if percent == 0:
        return 0.0

    if text.startswith("-"):
        percent = -abs(percent)
    elif arrow == "↓":
        percent = -abs(percent)
    else:
        percent = abs(percent)

    return percent


def _normalize_salary_range(raw: Any) -> Optional[Dict[str, Any]]:
    if not raw:
        return None

    def _coerce_numeric(value: Any) -> Optional[int]:
        if isinstance(value, (int, float)):
            return int(round(value))
        if isinstance(value, str):
            try:
                return int(round(float(value)))
            except ValueError:
                return None
        return None

    if isinstance(raw, dict):
        min_val = _coerce_numeric(raw.get("min"))
        max_val = _coerce_numeric(raw.get("max"))
        median_val = _coerce_numeric(raw.get("median"))
        if any(value is not None for value in (min_val, max_val, median_val)):
            return {
                "min": min_val,
                "max": max_val,
                "median": median_val,
                "currency": raw.get("currency") or raw.get("unit") or "USD",
            }
        return None

    if isinstance(raw, list):
        try:
            numeric = [round(float(item)) for item in raw if isinstance(item, (int, float))]
        except (TypeError, ValueError):
            numeric = []
        if numeric:
            median_val = int(round(sum(numeric) / len(numeric)))
            return {"min": min(numeric), "max": max(numeric), "median": median_val, "currency": "USD"}
        return None

    if isinstance(raw, str):
        cleaned = raw.strip()
        if not cleaned or cleaned.lower() in {"none", "null", "nan"}:
            return None
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return _normalize_salary_range(parsed)
        except (json.JSONDecodeError, TypeError):
            pass
        digits = re.findall(r"\d+", cleaned)
        if digits:
            numeric = [int(d) for d in digits]
            median_val = int(round(sum(numeric) / len(numeric)))
            return {"min": min(numeric), "max": max(numeric), "median": median_val, "currency": "USD"}
        return None

    return None

def _responses_to_summary(responses: List[Dict[str, Any]]) -> Tuple[str, List[str], str]:
    """
    -> summary text for embedding
    -> skills set
    -> keyword string for role search (baked from values, goals, interests)
    """
    skills = set()
    parts = []
    keywords_parts = []
    for r in responses:
        qid = str(r.get("question_id"))
        ans = r.get("answer")
        parts.append(f"[{qid}] {ans}")
        if isinstance(ans, list):
            for a in ans:
                if isinstance(a, str):
                    s = a.strip().lower()
                    skills.add(s)
                    keywords_parts.append(s)
        elif isinstance(ans, str):
            tokens = [t.strip().lower() for t in ans.replace("/", ",").split(",")]
            for t in tokens:
                if t:
                    skills.add(t)
                    keywords_parts.append(t)
    summary = " | ".join(parts)[:4000]
    keywords = " ".join(sorted(set(keywords_parts)))[:256] or "software data machine learning backend"
    return summary, sorted(skills), keywords


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v)
    if isinstance(value, dict):
        return ", ".join(f"{k}: {v}" for k, v in value.items() if v)
    return str(value)


def _load_user_final_json(db: Session, user_id: int) -> Dict[str, Any]:
    record = (
        db.query(UserFinalData)
        .filter(UserFinalData.user_id == user_id)
        .first()
    )

    if record and record.final_json:
        return record.final_json

    # Fallback: rebuild on the fly without persisting
    return build_user_final_json(db, user_id)


def _extract_questionnaire_responses(final_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    responses = final_json.get("questionnaire_responses") or []
    return [
        {
            "question_id": entry.get("question_id"),
            "answer": entry.get("answer"),
        }
        for entry in responses
    ]


def _extract_chat_highlights(final_json: Dict[str, Any], limit: int = 3) -> List[str]:
    highlights: List[str] = []
    for entry in final_json.get("intro_chat") or []:
        question = entry.get("question_text") or entry.get("chat_id") or "Coach"
        response = _stringify(entry.get("response"))
        if response:
            highlights.append(f"{question}: {response}")
        if len(highlights) >= limit:
            break
    return highlights


def _compose_user_summary(
    user: User,
    qa_summary: str,
    chat_highlights: List[str],
    coach_context: Optional[str],
) -> Tuple[str, str]:
    profile_bits: List[str] = []
    full_name = " ".join(part for part in [user.firstname, user.lastname] if part)
    if full_name:
        profile_bits.append(f"Name: {full_name}")
    if user.email:
        profile_bits.append(f"Email: {user.email}")

    if chat_highlights:
        profile_bits.append("Coach Highlights: " + " | ".join(chat_highlights))

    summary = " | ".join(filter(None, profile_bits + [qa_summary]))

    if coach_context:
        context_snippet = coach_context.strip()
        summary = f"{summary} | Coach Context: {context_snippet}" if summary else f"Coach Context: {context_snippet}"

    search_hints = " ".join(chat_highlights)
    if coach_context:
        search_hints = f"{search_hints} {coach_context}".strip()

    return summary, search_hints


def _extract_summary_themes(summary: str, limit: int = 2) -> List[str]:
    if not summary:
        return []
    parts = [segment.strip() for segment in summary.split("|") if segment and segment.strip()]
    filtered: List[str] = []
    for part in parts:
        lowered = part.lower()
        if lowered.startswith("name:") or lowered.startswith("email:"):
            continue
        if lowered.startswith("coach highlights"):
            continue
        filtered.append(part)
        if len(filtered) >= limit:
            break
    return filtered


# -- Explanation Generation ---------------------------------------------------


async def _generate_explanation(
    role_title: str,
    user_summary: str,
    matched_skills: List[str],
    coach_context: Optional[str],
) -> str:
    """Produce a tailored explanation for why the role fits the user — exactly two bullets."""
    matched_text = ", ".join(matched_skills[:6]) if matched_skills else "No direct skill matches shared"
    context_lines: List[str] = []
    if user_summary:
        context_lines.append(f"User summary: {user_summary[:600]}")
    if coach_context:
        context_lines.append(f"Coach context: {coach_context.strip()[:400]}")
    if not context_lines:
        context_lines.append("User summary: Not provided")

    context_block = "\n".join(context_lines)
    prompt = (
        "You are an encouraging AI career coach. "
        "Return EXACTLY two bullet points (no intro/outro), each ≤ 18 words, "
        "about why this role fits the user.\n"
        f"Role title: {role_title}\n"
        f"Matched skills: {matched_text}\n"
        f"{context_block}\n"
        "Bullets must be concrete and non-repetitive."
    )

    try:
        client = _get_azure_explanation_client()
        response = client.chat.completions.create(
            model=settings.AZURE_CHAT_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "You are an encouraging AI career coach who explains recommendations clearly.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            max_tokens=220,
            temperature=0.6,
        )
        if response.choices:
            content = response.choices[0].message.content
            if isinstance(content, str):
                text = content.strip()
            else:
                text = "".join(segment.get("text", "") for segment in content).strip()
            # Enforce two bullets as a fallback guard
            lines = [ln.strip(" -•") for ln in (text.splitlines() if text else []) if ln.strip()]
            bullets = [ln for ln in lines if ln] or []
            if len(bullets) < 2:
                parts = (text or "").replace("•", "-").split(". ")
                bullets = [p.strip(" -•.") for p in parts if p.strip()][:2]
            if len(bullets) < 2:
                bullets.extend(
                    tail.strip(" -•.")
                    for tail in (text or "").split(". ")
                    if tail.strip()
                )
            cleaned: List[str] = []
            for line in bullets:
                if not line:
                    continue
                cleaned.append(line[:120])
                if len(cleaned) == 2:
                    break
            if len(cleaned) == 2:
                return "\n".join(f"• {item}" for item in cleaned)
    except Exception as exc:
        print(f"[recommendation_service] explanation LLM failed: {exc}")

    themes = _extract_summary_themes(user_summary, limit=2)
    fallback_lines: List[str] = []
    if matched_skills:
        fallback_lines.append(
            f"Leverage {', '.join(matched_skills[:2])} to stand out in {role_title}."
        )
    elif themes:
        fallback_lines.append(
            f"Build on your focus around {themes[0].lower()} in this role."
        )
    else:
        fallback_lines.append("Apply your highlighted strengths to real projects in this role.")

    if coach_context:
        fallback_lines.append(
            f"Keeps you moving toward {coach_context.strip().rstrip('.')} goals."
        )
    elif matched_skills:
        fallback_lines.append(
            "Plan two concrete wins showcasing those core skills this quarter."
        )
    else:
        fallback_lines.append("Map one short-term milestone to validate fit within 30 days.")

    return "\n".join(f"• {line}" for line in fallback_lines[:2])


def _build_tips(matched_skills: List[str], profile: Dict[str, Any]) -> List[str]:
    tips: List[str] = []
    if matched_skills:
        skills_slice = ", ".join(matched_skills[:3])
        tips.append(f"Leverage {skills_slice} in your portfolio or resume.")
    else:
        tips.append("Highlight transferable strengths and capture concrete examples.")

    # trend may now be '↑ 12%' etc. — use startswith
    trend = (profile.get("demand_indicator") or "").strip()
    if trend.startswith("↑"):
        tips.append("This role is trending up—consider networking with professionals in the field.")
    else:
        tips.append("Pair these insights with informational interviews to validate fit.")

    return tips[:2]

async def _generate_detail_bullets(
    role_title: str,
    description: str,
    skills: List[str],
) -> List[str]:
    """
    Generate 4 short, job-specific bullet points describing what the user will do/learn.
    Style matches the screenshot (simple, actionable, no labels).
    """
    skill_text = ", ".join(skills[:8]) if skills else "role fundamentals"

    prompt = (
        "Return EXACTLY four bullet points. No intro or outro. "
        "Short, clear, action-based, like onboarding steps. "
        "Each bullet must be <= 16 words.\n\n"
        f"Role Title: {role_title}\n"
        f"Role Description: {description[:500]}\n"
        f"Key Skills: {skill_text}\n\n"
        "Bullets should describe what a learner would DO to understand or prepare for this role."
    )

    try:
        client = _get_azure_explanation_client()
        response = client.chat.completions.create(
            model=settings.AZURE_CHAT_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.6,
        )
        text = response.choices[0].message.content.strip()
        lines = [ln.strip("•- ") for ln in text.split("\n") if ln.strip()]
        return lines[:4]
    except Exception:
        # fallback if LLM fails
        return [
            "Study the core responsibilities and workflow of this role.",
            "Build essential skills through short practice tasks.",
            "Apply concepts with guided mini-projects.",
            "Start preparing portfolio or samples relevant to this career."
        ]



def _format_percent(value: float) -> str:
    formatted = f"{value:.1f}"
    if formatted.endswith(".0"):
        formatted = formatted[:-2]
    return formatted


def _growth_string_from_percent(percent: float, period_label: str) -> str:
    arrow = "→"
    if percent > 0:
        arrow = "↑"
    elif percent < 0:
        arrow = "↓"
    return f"{arrow} {_format_percent(abs(percent))}% change ({period_label})"


def _normalize_growth_trend(value: Any, *, default_period: str = "12 mo") -> str:
    if value is None:
        return f"→ 0% change ({default_period})"

    text = str(value).strip()
    if not text:
        return f"→ 0% change ({default_period})"

    if "%" in text and "change" in text:
        return text

    arrow = "→"
    remainder = text
    if text[0] in {"↑", "↓", "→"}:
        arrow = text[0]
        remainder = text[1:].strip()

    percent_match = re.search(r"-?\d+(?:\.\d+)?", remainder)
    numeric: Optional[float] = None
    if percent_match:
        try:
            numeric = float(percent_match.group())
        except ValueError:
            numeric = None

    if numeric is None:
        try:
            cleaned = remainder.replace("%", "")
            numeric = float(cleaned) if cleaned else 0.0
        except ValueError:
            numeric = 0.0

    if numeric > 0:
        arrow = "↑"
    elif numeric < 0:
        arrow = "↓"

    percent_text = _format_percent(abs(numeric))
    return f"{arrow} {percent_text}% change ({default_period})"


def _shorten_growth_trend(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    text = value.strip()
    if not text:
        return None

    arrow = text[0] if text and text[0] in {"↑", "↓", "→"} else ""
    percent_match = re.search(r"-?\d+(?:\.\d+)?", text)
    percent = percent_match.group() if percent_match else "0"
    percent = percent.rstrip("0").rstrip(".") or "0"

    short = f"{arrow} {percent}%".strip()
    if len(short) <= 8:
        return short

    if percent.isdigit():
        short = f"{arrow}{percent}%".strip()
        if len(short) <= 8:
            return short

    return short[:8]


def _generate_adzuna_search_terms(title: Optional[str], title_hint: Optional[str]) -> List[str]:
    """Yield progressively simplified titles to improve Adzuna matches."""

    stop_words = {"and", "of", "for", "with", "the", "to", "a", "an"}
    token_rewrites = {
        "analysts": "analyst",
        "analysis": "analyst",
        "analytics": "analyst",
        "specialists": "specialist",
        "managers": "manager",
        "assistants": "assistant",
        "coordinators": "coordinator",
        "engineers": "engineer",
        "technicians": "technician",
        "scientists": "scientist",
        "developers": "developer",
        "consultants": "consultant",
        "advisors": "advisor",
        "practitioners": "practitioner",
        "directors": "director",
        "supervisors": "supervisor",
        "strategists": "strategist",
        "executives": "executive",
        "leaders": "leader",
        "analyses": "analyst",
    }

    def _clean(value: str) -> str:
        return re.sub(r"\s+", " ", value).strip()

    def _normalize_token(token: str) -> str:
        core = re.sub(r"[^A-Za-z0-9+/]", "", token)
        if not core:
            return ""
        lower = core.lower()
        replacement = token_rewrites.get(lower)
        if replacement:
            return replacement.title() if core[0].isupper() else replacement
        if lower.endswith("ies") and len(core) > 3:
            base = core[:-3] + ("Y" if core[0].isupper() else "y")
            return base
        if lower.endswith("s") and len(core) > 4:
            base = core[:-1]
            return base
        return core

    def _token_variations(raw: str) -> Set[str]:
        words = raw.split()
        if not words:
            return set()

        normalized_tokens: List[str] = []
        for word in words:
            lowered = word.lower()
            if lowered in stop_words and len(words) > 1:
                continue
            normalized = _normalize_token(word)
            if normalized:
                normalized_tokens.append(normalized)

        variants: Set[str] = set()
        if not normalized_tokens:
            return variants

        base = _clean(" ".join(normalized_tokens))
        if base:
            variants.add(base)

        trimmed = [tok for tok in normalized_tokens if tok.lower() not in {"job", "jobs", "worker", "workers"}]
        if trimmed and trimmed != normalized_tokens:
            compact = _clean(" ".join(trimmed))
            if compact:
                variants.add(compact)
        tokens = trimmed or normalized_tokens

        if len(tokens) >= 2:
            variants.add(_clean(" ".join(tokens[:2])))
            variants.add(_clean(" ".join(tokens[-2:])))
            variants.add(_clean(f"{tokens[0]} {tokens[-1]}"))
            for token in tokens[1:]:
                variants.add(_clean(f"{tokens[0]} {token}"))
        if len(tokens) >= 3:
            variants.add(_clean(" ".join(tokens[:3])))
            variants.add(_clean(" ".join(tokens[-3:])))

        return {item for item in variants if item}

    def _variants(raw: str) -> List[str]:
        cleaned = _clean(raw)
        if not cleaned:
            return []
        pieces: Set[str] = {cleaned}
        no_paren = re.sub(r"\([^)]*\)", "", cleaned).strip()
        if no_paren:
            pieces.add(no_paren)
        for sep in [",", "-", "–", "—", ":", "/", "|"]:
            if sep in cleaned:
                head = cleaned.split(sep)[0].strip()
                tail = cleaned.split(sep)[-1].strip()
                if head:
                    pieces.add(head)
                if tail:
                    pieces.add(tail)
        words = cleaned.split()
        if len(words) > 4:
            pieces.add(" ".join(words[:4]))
        if len(words) > 3:
            pieces.add(" ".join(words[:3]))
        if len(words) > 2:
            pieces.add(" ".join(words[:2]))
        return list(pieces)

    seen: Set[str] = set()
    terms: List[str] = []

    for source in (title, title_hint):
        if not source:
            continue
        for candidate in _variants(source):
            for option in _token_variations(candidate):
                lowered = option.lower()
                if lowered in seen:
                    continue
                seen.add(lowered)
                terms.append(option)

    return terms


async def _adzuna_enrichment(title: str, title_hint: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Attempt Adzuna enrichment with several title variants."""

    salary: Optional[Dict[str, Any]] = None
    trend: Optional[str] = None
    for term in _generate_adzuna_search_terms(title, title_hint):
        if salary is None and FEATURE_ADZUNA:
            try:
                candidate = await adzuna_salary_stats(term) or None
                if candidate:
                    salary = candidate
                    print(f"Adzuna salary for '{term}': {candidate}")
            except Exception as exc:
                print(f"Adzuna salary API error for '{term}': {exc}")
        if trend is None and FEATURE_ADZUNA:
            try:
                candidate_trend = await adzuna_history_trend(term) or None
                if candidate_trend:
                    trend = candidate_trend
                    safe_trend = candidate_trend.encode("ascii", errors="ignore").decode()
                    print(f"Adzuna trend for '{term}': {safe_trend}")
            except Exception as exc:
                print(f"Adzuna trend API error for '{term}': {exc}")
        if salary and trend:
            break

    return salary, trend

def _cos_sim(a: List[float], b: List[float]) -> float:
    import math
    if not a or not b: return 0.0
    dot = sum(x*y for x,y in zip(a,b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(y*y for y in b))
    if na == 0 or nb == 0: return 0.0
    return dot/(na*nb)

async def _build_profile_from_external(soc: str, title_hint: Optional[str]) -> Optional[Dict[str, Any]]:
    """Build a single profile dict from O*NET plus Adzuna enrichment."""
    # print(f"[DEBUG] Building profile for SOC: {soc}, title_hint: {title_hint}")
    onet = await onet_get_details(soc)
    if not onet:
        # print(f"[DEBUG] O*NET returned None for SOC: {soc}")
        return None

    title = onet["title"] or title_hint or soc
    # print(f"[DEBUG] Retrieved title from O*NET: {title}")
    # print(f"[DEBUG] FEATURE_ADZUNA = {FEATURE_ADZUNA}")
    description = onet.get("description", "") or ""
    skills = onet.get("skills", []) or []

    # Enrich using Adzuna for salary range and demand trend (with adaptive titles)
    adz_salary, adz_trend = await _adzuna_enrichment(title, title_hint)

    salary = _normalize_salary_range(adz_salary)

    growth_percent: Optional[float] = None
    period_label: Optional[str] = None
    if adz_trend:
        parsed = _percent_from_string(adz_trend)
        if parsed is not None:
            growth_percent = parsed
            period_label = "12 mo"

    if growth_percent is None:
        baseline = _estimate_growth_percent_from_soc(soc)
        if baseline is not None:
            growth_percent = baseline
            period_label = period_label or "baseline"

    if growth_percent is not None:
        trend = _growth_string_from_percent(growth_percent, period_label or "12 mo")
    else:
        trend = _normalize_growth_trend(adz_trend)

    short_trend = _shorten_growth_trend(trend)

    text_for_embed = f"{title}. {description}. skills: {', '.join(skills)}"
    emb = (await embed_texts([text_for_embed]))[0]

    return {
        "soc_code": soc,
        "title": title,
        "description": description,
        "required_skills": skills[:15],  # cap for UI sanity
        "preferred_skills": [],
        "trajectory": [],
        "salary_range": salary,
        "demand_indicator": trend,
        "demand_indicator_short": short_trend,
        "industry_tag": _infer_industry_tag(soc, title),
        "embedding": emb,
    }

def _maybe_cache_profile(db: Session, prof: Dict[str, Any]) -> Optional[int]:
    """Persist or update a career profile so future runs can reuse the data."""
    title = prof.get("title")
    if not title:
        return None

    soc_code = prof.get("soc_code")
    query = db.query(CareerProfile)
    if soc_code:
        query = query.filter(CareerProfile.soc_code == soc_code)
    else:
        query = query.filter(CareerProfile.title == title)

    profile = query.first()
    payload = {
        "title": title,
        "description": prof.get("description"),
        "required_skills": prof.get("required_skills"),
        "preferred_skills": prof.get("preferred_skills"),
        "trajectory": prof.get("trajectory"),
        "salary_range": prof.get("salary_range"),
        "demand_indicator": _shorten_growth_trend(
            prof.get("demand_indicator_short") or prof.get("demand_indicator")
        ),
        "embedding": prof.get("embedding"),
    }

    if profile:
        for field, value in payload.items():
            setattr(profile, field, value)
        profile.updated_at = datetime.utcnow()
    else:
        profile = CareerProfile(
            soc_code=soc_code,
            **payload,
        )
        db.add(profile)

    db.flush()
    return profile.id


def _record_recommendation_batch(
    db: Session,
    user_id: int,
    coach_context: Optional[str],
    entries: List[Dict[str, Any]],
) -> None:
    if not entries:
        return

    timestamp = datetime.utcnow()
    for entry in entries:
        record = UserCareerRecommendation(
            user_id=user_id,
            career_profile_id=entry["career_profile_id"],
            fit_score=entry["fit_score"],
            salary_range=entry.get("salary_range"),
            growth_trend=entry.get("growth_trend"),
            why_this_fits=entry["why_this_fits"],
            top_skills=entry.get("top_skills"),
            tips=entry.get("tips"),
            coach_context=coach_context,
            rank=entry.get("rank"),
            generated_at=timestamp,
        )
        db.add(record)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


def _get_action_map(db: Session, user_id: int, profile_ids: List[int]) -> Dict[int, str]:
    if not profile_ids:
        return {}
    rows = (
        db.query(UserRecommendationAction)
        .filter(
            UserRecommendationAction.user_id == user_id,
            UserRecommendationAction.career_profile_id.in_(profile_ids),
        )
        .all()
    )
    return {row.career_profile_id: row.action for row in rows}


async def get_career_detail(db: Session, career_id: int, user_id: Optional[int] = None) -> Dict[str, Any]:
    profile = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
    if not profile:
        raise ValueError("Career profile not found")

    recommendation: Optional[UserCareerRecommendation] = None
    action = "no_action"

    if user_id is not None:
        recommendation = (
            db.query(UserCareerRecommendation)
            .filter(
                UserCareerRecommendation.user_id == user_id,
                UserCareerRecommendation.career_profile_id == career_id,
            )
            .order_by(
                UserCareerRecommendation.generated_at.desc(),
                UserCareerRecommendation.rank.asc(),
            )
            .first()
        )
        action_map = _get_action_map(db, user_id, [career_id])
        action = action_map.get(career_id, "no_action")
    

    # # ---- Build 4 bullets ----
    # bullets = []

    # # 1. Overview
    # overview_text = profile.description or f"{profile.title}: role, scope, and outlook."
    # if len(overview_text) > 300:
    #     overview_text = overview_text[:297] + "..."
    # bullets.append({"title": "Overview", "text": overview_text})

    # # 2. Why this fits you
    # if recommendation and recommendation.why_this_fits:
    #     why_text = recommendation.why_this_fits
    # else:
    #     why_text = "Based on your strengths and interests, this role aligns well with your profile."
    # bullets.append({"title": "Why this fits you", "text": why_text})

    # # 3. What to learn
    # learn_items = []
    # if recommendation and recommendation.top_skills:
    #     learn_items = recommendation.top_skills[:5] if isinstance(recommendation.top_skills, list) else []
    # if not learn_items and profile.required_skills:
    #     learn_items = profile.required_skills[:5] if isinstance(profile.required_skills, list) else []
    
    # learn_text = "Focus on: " + ", ".join(str(item) for item in learn_items) if learn_items else "Strengthen key skills and foundational tools."
    # bullets.append({"title": "What to learn", "text": learn_text})

    # # 4. Microsteps
    # micro_items = []
    # if recommendation and recommendation.tips:
    #     micro_items = recommendation.tips[:3] if isinstance(recommendation.tips, list) else []
    
    # if micro_items:
    #     micro_text = "Next steps: " + " | ".join(str(item) for item in micro_items)
    # else:
    #     micro_text = "Spend 30–45 minutes exploring learning resources and bookmarking training paths."
    # bullets.append({"title": "Microsteps", "text": micro_text})
    # ---- Build detail bullets ----
    # ---- Build 4 bullets using LLM (job-specific, no titles) ----
    skills_for_llm = []
    if profile.required_skills:
        skills_for_llm = profile.required_skills[:8]

    bullets = await _generate_detail_bullets(
        role_title=profile.title,
        description=profile.description or "",
        skills=skills_for_llm,
    )

    # Prepare salary and growth - use recommendation data first, then profile
    salary_range = None
    growth_trend = None
    
    if recommendation:
        salary_range = recommendation.salary_range
        growth_trend = recommendation.growth_trend
    
    # If no salary from recommendation, get from profile
    if not salary_range and profile.salary_range:
        salary_range = _normalize_salary_range(profile.salary_range)
    
    # If no growth_trend from recommendation, expand the short indicator from profile
    if not growth_trend and profile.demand_indicator:
        # profile.demand_indicator is short like "↑ 5%", expand it
        short = profile.demand_indicator.strip()
        if short and short[0] in {"↑", "↓", "→"}:
            # Already has arrow, just add the text
            growth_trend = f"{short} change (12 mo)"
        else:
            growth_trend = _normalize_growth_trend(short)
    
    # Get industry tag
    industry_tag = _infer_industry_tag(profile.soc_code, profile.title)
    
    # Normalize action label
    label = action or "no_action"
    if label == "favorite":
        label = "saved"

    return {
        "id": profile.id,
        "career_id": profile.id,
        "soc_code": profile.soc_code,
        "title": profile.title,
        "user_action": label,
        "fit_score": round(recommendation.fit_score, 1) if recommendation and recommendation.fit_score else None,
        "salary_range": salary_range,
        "growth_trend": growth_trend,
        "industry_tag": industry_tag,
        "bullets": bullets
    }


def _get_seen_profile_keys(
    db: Session,
    user_id: int,
) -> Tuple[Set[int], Set[str], Set[str]]:
    profile_ids: Set[int] = set(
        pid for (pid,) in (
            db.query(UserCareerRecommendation.career_profile_id)
            .filter(UserCareerRecommendation.user_id == user_id)
            .all()
        )
        if pid
    )

    action_ids = (
        db.query(UserRecommendationAction.career_profile_id)
        .filter(UserRecommendationAction.user_id == user_id)
        .all()
    )
    profile_ids.update(pid for (pid,) in action_ids if pid)

    if not profile_ids:
        return set(), set(), set()

    rows = (
        db.query(CareerProfile.id, CareerProfile.soc_code, CareerProfile.title)
        .filter(CareerProfile.id.in_(profile_ids))
        .all()
    )
    seen_ids: Set[int] = {row[0] for row in rows if row and row[0]}
    seen_socs: Set[str] = {
        row[1].strip().lower()
        for row in rows
        if row and isinstance(row[1], str) and row[1].strip()
    }
    seen_titles: Set[str] = {
        row[2].strip().lower()
        for row in rows
        if row and isinstance(row[2], str) and row[2].strip()
    }
    return seen_ids, seen_socs, seen_titles


def _normalize_skills(skills: Any) -> List[str]:
    if not skills:
        return []
    if isinstance(skills, list):
        return [str(item) for item in skills if item][:8]
    return []


def _fallback_tips(trend: Optional[str]) -> List[str]:
    base_tips = ["Highlight transferable strengths and capture concrete examples."]
    if (trend or "").strip().startswith("↑"):
        base_tips.append("This role is trending up—consider networking with professionals in the field.")
    else:
        base_tips.append("Pair these insights with informational interviews to validate fit.")
    return base_tips[:2]


def _card_from_profile(
    profile: CareerProfile,
    recommendation: Optional[UserCareerRecommendation],
    action: Optional[str],
) -> Dict[str, Any]:
    salary: Any = None
    growth: Optional[str] = None
    fit_score: Optional[float] = None
    why: Optional[str] = None
    top_skills: List[str] = []
    tips: List[str] = []

    if recommendation:
        salary = recommendation.salary_range
        # recommendation.growth_trend is SHORT format (8 chars), need to expand
        if recommendation.growth_trend:
            short = recommendation.growth_trend.strip()
            if short and short[0] in {"↑", "↓", "→"}:
                growth = f"{short} change (12 mo)"
            else:
                growth = _normalize_growth_trend(short)
        fit_score = recommendation.fit_score
        why = recommendation.why_this_fits
        top_skills = _normalize_skills(recommendation.top_skills)
        stored_tips = recommendation.tips if recommendation.tips else []
        if isinstance(stored_tips, list):
            tips = [str(item) for item in stored_tips if item]

    if not top_skills:
        top_skills = _normalize_skills(profile.required_skills)

    salary_normalized = _normalize_salary_range(salary) or _normalize_salary_range(profile.salary_range)
    
    # If still no growth from recommendation, expand profile.demand_indicator
    if not growth:
        if profile.demand_indicator:
            short = profile.demand_indicator.strip()
            if short and short[0] in {"↑", "↓", "→"}:
                growth = f"{short}"
            else:
                growth = _normalize_growth_trend(short)
    
    growth_normalized = growth or "→ 0%"

    why = why or (profile.description or "This role aligns with your strengths and goals.")
    if not tips:
        tips = _fallback_tips(growth_normalized)

    industry_tag = _infer_industry_tag(profile.soc_code, profile.title)

    card = {
        "id": profile.id,
        "soc_code": profile.soc_code,
        "title": profile.title,
        "fit_score": round(fit_score, 1) if fit_score is not None else 0.0,
        "salary_range": salary_normalized,
        "growth_trend": growth_normalized,
        "industry_tag": industry_tag,
        "why_this_fits": why,
        "top_skills": top_skills[:4],
        "tips": tips[:2],
        "user_action": action,
    }

    label = card["user_action"] or "no_action"
    if label == "favorite":
        label = "saved"
    card["user_action"] = label

    return card

async def generate(
    db: Session,
    user_id: int,
    top_k: int = 5,
    coach_context: str | None = None,
) -> List[Dict[str, Any]]:
    if not FEATURE_ONET:
        raise RuntimeError("FEATURE_ONET must be enabled to generate recommendations")
    user: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    final_json = _load_user_final_json(db, user_id)
    responses = _extract_questionnaire_responses(final_json)
    if not responses:
        return []

    qa_summary, user_skills, search_keywords = _responses_to_summary(responses)
    chat_highlights = _extract_chat_highlights(final_json)
    user_summary, search_hints = _compose_user_summary(user, qa_summary, chat_highlights, coach_context)

    if search_hints:
        search_keywords = f"{search_keywords} {search_hints}".strip()[:256]
    else:
        search_keywords = search_keywords[:256]

    if not search_keywords:
        search_keywords = "career transition development"

    # 2) O*NET search → candidates (SOC + title)
    # Request more candidates to ensure we have fresh ones even after filtering
    candidates = await onet_search_occupations(search_keywords, limit=50)
    if not candidates:
        return []

    # 3) Build profiles from external sources (and embed)
    _seen_ids, seen_socs, seen_titles = _get_seen_profile_keys(db, user_id)
    built: List[Dict[str, Any]] = []
    for c in candidates:
        try:
            prof = await _build_profile_from_external(c["soc"], c["title"])
        except Exception:
            prof = None
        if prof:
            built.append(prof)

    if not built:
        return []

    # 4) Embed user once
    user_vec = (await embed_texts([user_summary]))[0]

    # 5) Score: cosine + keyword bonus
    ranked: List[Tuple[float, Dict[str, Any]]] = []
    for p in built:
        base = _cos_sim(user_vec, p.get("embedding") or [])
        kw_bonus = 0.0
        for s in (p.get("required_skills") or []):
            if isinstance(s, str) and s.lower() in user_skills:
                kw_bonus += 0.02
        fit = max(0.0, min(1.0, base + kw_bonus))
        ranked.append((fit, p))
    ranked.sort(key=lambda x: x[0], reverse=True)

    # 6) Exclude anything the user has already seen or acted on, while keeping order
    filtered: List[Tuple[float, Dict[str, Any]]] = []
    batch_socs: Set[str] = set()
    batch_titles: Set[str] = set()
    target = max(1, top_k)
    for raw_score, profile in ranked:
        title_key = profile["title"].strip().lower()
        soc_key = (profile.get("soc_code") or "").strip().lower()
        if soc_key and (soc_key in seen_socs or soc_key in batch_socs):
            continue
        if title_key in seen_titles or title_key in batch_titles:
            continue
        filtered.append((raw_score, profile))
        if soc_key:
            batch_socs.add(soc_key)
            seen_socs.add(soc_key)
        batch_titles.add(title_key)
        seen_titles.add(title_key)
        if len(filtered) >= target:
            break

    # If we don't have enough fresh recommendations, search with broader terms
    if len(filtered) < target:
        # Try broader career search terms
        broader_searches = [
            "professional career opportunities",
            "skilled occupations employment",
            "career development positions"
        ]
        
        for broader_term in broader_searches:
            if len(filtered) >= target:
                break
                
            additional_candidates = await onet_search_occupations(broader_term, limit=30)
            additional_built = []
            
            for c in additional_candidates:
                try:
                    prof = await _build_profile_from_external(c["soc"], c["title"])
                except Exception:
                    prof = None
                if prof:
                    additional_built.append(prof)
            
            # Score and filter additional candidates
            for p in additional_built:
                title_key = p["title"].strip().lower()
                soc_key = (p.get("soc_code") or "").strip().lower()
                
                # Skip if already seen or in current batch
                if soc_key and (soc_key in seen_socs or soc_key in batch_socs):
                    continue
                if title_key in seen_titles or title_key in batch_titles:
                    continue
                
                # Calculate fit score
                base = _cos_sim(user_vec, p.get("embedding") or [])
                kw_bonus = 0.0
                for s in (p.get("required_skills") or []):
                    if isinstance(s, str) and s.lower() in user_skills:
                        kw_bonus += 0.02
                fit = max(0.0, min(1.0, base + kw_bonus))
                
                filtered.append((fit, p))
                if soc_key:
                    batch_socs.add(soc_key)
                    seen_socs.add(soc_key)
                batch_titles.add(title_key)
                seen_titles.add(title_key)
                
                if len(filtered) >= target:
                    break
        
        # Re-sort all filtered results by fit score
        filtered.sort(key=lambda x: x[0], reverse=True)
    
    # If still no results after all attempts, return empty (edge case)
    if not filtered:
        return []
    
    top_candidates = filtered[:target]

    raw_scores = [score for score, _ in top_candidates] or [0.0]
    mn, mx = min(raw_scores), max(raw_scores)

    scale_min = 0.72
    scale_span = 0.24

    def _rescale(score: float) -> float:
        if mx == mn:
            return scale_min + (scale_span / 2.0)
        return scale_min + scale_span * ((score - mn) / (mx - mn))

    # 7) Why-this-fits + normalize
    results = []
    persist_entries: List[Dict[str, Any]] = []
    for idx, (raw_fit, p) in enumerate(top_candidates, start=1):
        fit = _rescale(raw_fit)
        matched = [s for s in (p.get("required_skills") or []) if isinstance(s, str) and s.lower() in user_skills]
        why = await _generate_explanation(p["title"], user_summary, matched[:10], coach_context)

        try:
            career_id = _maybe_cache_profile(db, p)
        except Exception:
            career_id = None

        growth_value = p.get("demand_indicator")
        growth_trend = _normalize_growth_trend(growth_value)
        salary_range = _normalize_salary_range(p.get("salary_range"))
        
        # Ensure salary is never null - provide fallback
        if not salary_range:
            salary_range = {
                "min": 35000,
                "max": 75000,
                "median": 50000,
                "currency": "USD"
            }
        
        industry_tag = p.get("industry_tag") or _infer_industry_tag(p.get("soc_code"), p.get("title"))

        card = {
            "id": career_id,
            "soc_code": p.get("soc_code"),
            "title": p["title"],
            "fit_score": round(fit * 100, 1),
            "salary_range": salary_range,
            "growth_trend": growth_trend,
            "industry_tag": industry_tag,
            "why_this_fits": why,
            "top_skills": (p.get("required_skills") or [])[:4],
            "tips": _build_tips(matched, {"demand_indicator": growth_trend}),
            "user_action": "no_action",
        }
        results.append(card)

        if career_id:
            persist_entries.append({
                "career_profile_id": career_id,
                "fit_score": card["fit_score"],
                "salary_range": card["salary_range"],
                "growth_trend": _shorten_growth_trend(card["growth_trend"]),
                "why_this_fits": card["why_this_fits"],
                "top_skills": card["top_skills"],
                "tips": card["tips"],
                "rank": idx,
            })

    if persist_entries:
        _record_recommendation_batch(db, user_id, coach_context, persist_entries)

    profile_ids = [card["id"] for card in results if card["id"]]
    if profile_ids:
        action_map = _get_action_map(db, user_id, profile_ids)
        for card in results:
            if card["id"]:
                card["user_action"] = action_map.get(card["id"], "no_action")

    return results

def favorite(db: Session, user_id: int, career_id: int, action: str) -> None:
    if action not in {"favorite", "dismiss", "saved", "explore"}:
        raise ValueError("Unsupported action")

    profile = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
    if not profile:
        raise ValueError("Career profile not found")

    record = (
        db.query(UserRecommendationAction)
        .filter(
            UserRecommendationAction.user_id == user_id,
            UserRecommendationAction.career_profile_id == career_id,
        )
        .first()
    )

    now = datetime.utcnow()

    # ✅ Handle "favorite" toggle (save ↔ unsave)
    if action in {"favorite", "saved"}:
        if record and record.action in {"favorite", "saved"}:
            # Unsave → delete record
            db.delete(record)
            db.commit()
            return
        else:
            # Save new record
            new_record = UserRecommendationAction(
                user_id=user_id,
                career_profile_id=career_id,
                action="favorite",
                created_at=now,
                updated_at=now,
            )
            db.add(new_record)
            db.commit()
            return

    # ✅ Handle dismiss and explore normally
    if not record:
        record = UserRecommendationAction(
            user_id=user_id,
            career_profile_id=career_id,
            action=action,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
    else:
        record.action = action
        record.updated_at = now

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

def get_all_recommendations_with_actions(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Get ALL recommendations for a user with their current action tags."""
    from sqlalchemy.orm import aliased
    Action = aliased(UserRecommendationAction)

    query = (
        db.query(UserCareerRecommendation, CareerProfile, Action)
        .join(CareerProfile, UserCareerRecommendation.career_profile_id == CareerProfile.id)
        .outerjoin(
            Action,
            (Action.user_id == user_id)
            & (Action.career_profile_id == UserCareerRecommendation.career_profile_id)
        )
        .filter(UserCareerRecommendation.user_id == user_id)
        .order_by(
            UserCareerRecommendation.generated_at.desc(),
            UserCareerRecommendation.rank.asc()
        )
    )

    rows = query.all()

    cards = []
    for rec, profile, action in rows:
        user_action = action.action if action else "no_action"
        cards.append(_card_from_profile(profile, rec, user_action))

    return cards


def get_latest_recommendations(db: Session, user_id: int) -> List[Dict[str, Any]]:
    from sqlalchemy.orm import aliased
    Action = aliased(UserRecommendationAction)

    query = (
        db.query(UserCareerRecommendation, CareerProfile, Action)
        .join(CareerProfile, UserCareerRecommendation.career_profile_id == CareerProfile.id)
        .outerjoin(
            Action,
            (Action.user_id == user_id)
            & (Action.career_profile_id == UserCareerRecommendation.career_profile_id)
        )
        .filter(UserCareerRecommendation.user_id == user_id)
        .filter(
            (Action.action.is_(None)) |
            #(Action.action.in_(["favorite", "saved"]))
            (Action.action != "dismiss")
        )
        .order_by(
            UserCareerRecommendation.generated_at.desc(),
            UserCareerRecommendation.rank.asc()
        )
    )

    rows = query.all()

    cards = []
    for rec, profile, action in rows:
        user_action = action.action if action else "no_action"
        cards.append(_card_from_profile(profile, rec, user_action))

    return cards


def get_dismissed_recommendations(db: Session, user_id: int):
    q = (
        db.query(UserRecommendationAction, CareerProfile)
          .join(CareerProfile, UserRecommendationAction.career_profile_id == CareerProfile.id)
          .filter(UserRecommendationAction.user_id == user_id)
          .filter(UserRecommendationAction.action == "dismiss")
          .order_by(UserRecommendationAction.updated_at.desc())
    )

    rows = q.all()
    cards = []
    for action, profile in rows:
        cards.append(_card_from_profile(profile, None, "dismissed"))
    return cards


def get_favorite_recommendations(db: Session, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    action_query = (
        db.query(UserRecommendationAction)
        .filter(
            UserRecommendationAction.user_id == user_id,
            UserRecommendationAction.action == "favorite",
        )
        .order_by(UserRecommendationAction.updated_at.desc())
    )
    if limit > 0:
        action_query = action_query.limit(limit)
    actions = action_query.all()
    if not actions:
        return []

    profile_ids = [action.career_profile_id for action in actions]
    if not profile_ids:
        return []

    profiles = (
        db.query(CareerProfile)
        .filter(CareerProfile.id.in_(profile_ids))
        .all()
    )
    profile_map = {profile.id: profile for profile in profiles}

    recommendations = (
        db.query(UserCareerRecommendation)
        .filter(
            UserCareerRecommendation.user_id == user_id,
            UserCareerRecommendation.career_profile_id.in_(profile_ids),
        )
        .order_by(
            UserCareerRecommendation.career_profile_id,
            UserCareerRecommendation.generated_at.desc(),
            UserCareerRecommendation.rank.asc(),
        )
        .all()
    )
    rec_map: Dict[int, UserCareerRecommendation] = {}
    for rec in recommendations:
        if rec.career_profile_id not in rec_map:
            rec_map[rec.career_profile_id] = rec

    cards: List[Dict[str, Any]] = []
    for action in actions:
        profile = profile_map.get(action.career_profile_id)
        if not profile:
            continue
        rec = rec_map.get(action.career_profile_id)
        cards.append(_card_from_profile(profile, rec, action.action))
    return cards


def get_recommendation_history(
    db: Session,
    user_id: int,
    batch_limit: int = 3,
    per_batch_limit: int = 5,
) -> List[Dict[str, Any]]:
    timestamp_rows = (
        db.query(UserCareerRecommendation.generated_at)
        .filter(UserCareerRecommendation.user_id == user_id)
        .distinct()
        .order_by(UserCareerRecommendation.generated_at.desc())
        .limit(batch_limit)
        .all()
    )
    timestamps = [row[0] for row in timestamp_rows if row and row[0]]
    if not timestamps:
        return []

    rows = (
        db.query(UserCareerRecommendation, CareerProfile)
        .join(CareerProfile, UserCareerRecommendation.career_profile_id == CareerProfile.id)
        .filter(
            UserCareerRecommendation.user_id == user_id,
            UserCareerRecommendation.generated_at.in_(timestamps),
        )
        .order_by(
            UserCareerRecommendation.generated_at.desc(),
            UserCareerRecommendation.rank.asc(),
            UserCareerRecommendation.fit_score.desc(),
        )
        .all()
    )

    profile_ids = [rec.career_profile_id for rec, _ in rows]
    action_map = _get_action_map(db, user_id, profile_ids)

    batches: Dict[Any, List[Dict[str, Any]]] = {}
    for rec, profile in rows:
        ts = rec.generated_at
        if ts not in batches:
            batches[ts] = []
        if per_batch_limit > 0 and len(batches[ts]) >= per_batch_limit:
            continue
        batches[ts].append(_card_from_profile(profile, rec, action_map.get(profile.id, "no_action")))

    ordered_batches: List[Dict[str, Any]] = []
    for ts in timestamps:
        items = batches.get(ts, [])
        if items:
            ordered_batches.append({"generated_at": ts, "items": items})
    return ordered_batches

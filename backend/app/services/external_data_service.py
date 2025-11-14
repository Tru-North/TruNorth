from __future__ import annotations

from typing import Optional, Dict, Any, List, Tuple

import base64
import httpx
import statistics

from app.core.config import (
    FEATURE_ONET,
    FEATURE_ADZUNA,
    ONET_USER,
    ONET_API_KEY,
    ADZUNA_APP_ID,
    ADZUNA_APP_KEY,
    ADZUNA_COUNTRY,
)

ONET_BASE = "https://services.onetcenter.org"
ADZUNA_BASE = "https://api.adzuna.com/v1/api"


def _ensure_onet_ready() -> None:
    if not FEATURE_ONET:
        raise RuntimeError("FEATURE_ONET must be enabled for O*NET lookups")
    if not ONET_USER or not ONET_API_KEY:
        raise RuntimeError("O*NET credentials are required")


def _onet_headers() -> Dict[str, str]:
    _ensure_onet_ready()
    token = base64.b64encode(f"{ONET_USER}:{ONET_API_KEY}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
    }


async def onet_search_occupations(keywords: str, limit: int = 20) -> List[Dict[str, Any]]:
    _ensure_onet_ready()
    url = f"{ONET_BASE}/ws/online/search"
    params = {"keyword": keywords, "end": limit, "fmt": "json"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=_onet_headers(), params=params)
        response.raise_for_status()
        payload = response.json()
    occupations = payload.get("occupation", [])
    return [
        {"soc": entry.get("code"), "title": entry.get("title")}
        for entry in occupations
        if entry.get("code") and entry.get("title")
    ]


async def onet_get_details(soc: str) -> Optional[Dict[str, Any]]:
    _ensure_onet_ready()
    url = f"{ONET_BASE}/ws/online/occupations/{soc}"
    skills_url = f"{ONET_BASE}/ws/online/occupations/{soc}/details/skills"
    params = {"fmt": "json"}
    async with httpx.AsyncClient(timeout=30) as client:
        details_response = await client.get(url, headers=_onet_headers(), params=params)
        details_response.raise_for_status()
        data = details_response.json()

        skills_response = await client.get(skills_url, headers=_onet_headers())
        skills_response.raise_for_status()
        skills_payload = skills_response.json()

    title = data.get("title") or data.get("occupation", {}).get("title") or soc
    description = data.get("summary") or data.get("description") or ""

    skills: List[Tuple[float, str]] = []
    for element in skills_payload.get("element", []) or []:
        name = element.get("name")
        score = element.get("score", {})
        if not isinstance(name, str):
            continue
        value = 0.0
        raw = score.get("value")
        if isinstance(raw, (int, float)):
            value = float(raw)
        important = score.get("important")
        if important:
            value += 0.5
        skills.append((value, name))

    skills.sort(key=lambda pair: pair[0], reverse=True)
    unique_skills: List[str] = []
    seen = set()
    for _, label in skills:
        lowered = label.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_skills.append(label)
    return {"soc": soc, "title": title, "description": description, "skills": unique_skills[:25]}


def _ensure_adzuna_ready() -> None:
    if not FEATURE_ADZUNA:
        raise RuntimeError("FEATURE_ADZUNA must be enabled for Adzuna lookups")
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        raise RuntimeError("Adzuna credentials are required")


def _adzuna_country_path() -> str:
    country = (ADZUNA_COUNTRY or "us").strip().lower()
    return country or "us"


async def adzuna_salary_stats(role_title: str) -> Optional[Dict[str, Any]]:
    _ensure_adzuna_ready()
    country_path = _adzuna_country_path()
    stats_params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": role_title,
        "content-type": "application/json",
    }
    stats_url = f"{ADZUNA_BASE}/jobs/{country_path}/stats"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(stats_url, params=stats_params)
            response.raise_for_status()
            payload = response.json()
            mean = payload.get("mean")
            median = payload.get("median")
            if mean or median:
                base = median or mean
                low = payload.get("p25") or 0.8 * base
                high = payload.get("p75") or 1.25 * base
                return {
                    "min": round(low),
                    "max": round(high),
                    "median": round(base),
                    "currency": payload.get("currency") or "USD",
                }
        except httpx.HTTPError:
            pass

    search_params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": role_title,
        "results_per_page": 25,
        "content-type": "application/json",
    }
    search_url = f"{ADZUNA_BASE}/jobs/{country_path}/search/1"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(search_url, params=search_params)
        response.raise_for_status()
        payload = response.json()

    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        return None

    salary_rows: List[Tuple[float, float, str]] = []
    for job in results:
        if not isinstance(job, dict):
            continue
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")
        currency = job.get("salary_currency") or job.get("currency") or "USD"
        if isinstance(salary_max, (int, float)) and salary_max > 0:
            if not isinstance(salary_min, (int, float)) or salary_min <= 0:
                salary_min = salary_max * 0.7
            if salary_min > salary_max:
                salary_min, salary_max = salary_max, salary_min
            salary_rows.append((float(salary_min), float(salary_max), currency))

    if not salary_rows:
        return None

    midpoints = sorted(((lo + hi) / 2.0) for lo, hi, _ in salary_rows)
    if not midpoints:
        return None

    try:
        quartiles = statistics.quantiles(midpoints, n=4)
        q1, q3 = quartiles[0], quartiles[2]
    except Exception:
        q1 = midpoints[0]
        q3 = midpoints[-1]

    median_val = statistics.median(midpoints)
    currency = next((cur for *_vals, cur in salary_rows if cur), "USD")

    return {
        "min": round(q1),
        "max": round(q3),
        "median": round(median_val),
        "currency": currency,
    }


async def adzuna_history_trend(role_title: str, months: int = 12) -> Optional[str]:
    """
    Return a 12-month trend as arrow + percent, e.g. '↑ 12%'.
    Arrow is computed by linear regression slope; percent is first→last change.
    """
    _ensure_adzuna_ready()
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": role_title,
        "content-type": "application/json",
    }
    url = f"{ADZUNA_BASE}/jobs/{_adzuna_country_path()}/history"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    series = payload.get("history") or payload.get("month") or payload
    if not isinstance(series, dict) or len(series) < 3:
        return None
    # Adzuna returns either {'history': {...}} or {'month': {...}}; both map date->value
    data_items = series.items() if isinstance(series, dict) else []
    points = sorted(data_items)[-months:]
    values = [v for _, v in points if isinstance(v, (int, float))]
    if len(values) < 3:
        return None

    # slope → arrow
    n = len(values)
    xs = list(range(n))
    sx = sum(xs)
    sy = sum(values)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, values))
    denom = n * sxx - sx * sx
    slope = (n * sxy - sx * sy) / denom if denom else 0.0
    if slope > 0.5:
        arrow = "↑"
    elif slope < -0.5:
        arrow = "↓"
    else:
        arrow = "→"

    # first→last percentage change
    first, last = values[0], values[-1]
    pct = 0.0 if first == 0 else ((last - first) / first) * 100.0
    # Retain one decimal so small movements do not collapse to 0%
    pct_text = f"{pct:.1f}".rstrip("0").rstrip(".")
    return f"{arrow} {pct_text}%".strip()



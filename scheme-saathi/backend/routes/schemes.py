import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.eligibility import evaluate_schemes


router = APIRouter(
    prefix="/api/schemes",
    tags=["Schemes"],
)


BASE_DIR = Path(__file__).resolve().parent.parent
SCHEME_FILE = BASE_DIR / "data" / "schemes.json"
_SCHEMES_CACHE = None


def load_schemes() -> list[dict[str, Any]]:
    global _SCHEMES_CACHE
    if _SCHEMES_CACHE is not None:
        return _SCHEMES_CACHE
    with open(
        SCHEME_FILE,
        "r",
        encoding="utf-8",
    ) as file:
        data = json.load(file)
    _SCHEMES_CACHE = data["schemes"]
    return _SCHEMES_CACHE


class SchemeMatchRequest(BaseModel):
    category: str = Field(..., min_length=1)
    gender: str | None = None
    annual_income: float = Field(..., ge=0)
    purpose: str | None = None
    project_cost: float | None = Field(
        default=None,
        ge=0,
    )
    required_loan: float | None = Field(
        default=None,
        ge=0,
    )
    education_level: str | None = None
    state: str | None = None
    district: str | None = None


@router.get("/")
def get_schemes():
    schemes = load_schemes()

    return {
        "count": len(schemes),
        "schemes": schemes,
    }


@router.get("/primary")
def get_primary_schemes():
    schemes = load_schemes()

    primary = [
        scheme
        for scheme in schemes
        if scheme["type"] == "PRIMARY"
    ]

    return {
        "count": len(primary),
        "schemes": primary,
    }


@router.get("/secondary")
def get_secondary_schemes():
    schemes = load_schemes()

    secondary = [
        scheme
        for scheme in schemes
        if scheme["type"] == "SECONDARY_CONNECTED"
    ]

    return {
        "count": len(secondary),
        "schemes": secondary,
    }


@router.post("/match")
def match_schemes(
    request: SchemeMatchRequest,
):
    user_data = request.model_dump()

    schemes = load_schemes()

    # Filter OUT_OF_SCOPE schemes from eligibility evaluation
    # OUT_OF_SCOPE schemes are only available as AI Assistant fallback alternatives
    eligible_for_matching = [
        s for s in schemes
        if s.get("type") not in ("OUT_OF_SCOPE",)
    ]

    results = evaluate_schemes(
        user_data,
        eligible_for_matching,
    )

    primary_results = [
        result
        for result in results
        if result["type"] == "PRIMARY"
    ]

    secondary_results = [
        result
        for result in results
        if result["type"] == "SECONDARY_CONNECTED"
    ]

    eligible_primary = [
        result
        for result in primary_results
        if result["eligible"]
    ]

    eligible_secondary = [
        result
        for result in secondary_results
        if result["eligible"]
    ]

    # Rank eligible primary schemes by match score with context priority boosting
    def get_sort_key(s):
        score = float(s.get("match_score", 0))
        # Educational scheme boost if requirement is education
        if str(user_data.get("purpose", "")).lower() == "education" and s.get("scheme_id") == "ELS":
            score += 25
        # Lower interest rate gives an affordability advantage to beneficiaries
        rate = s.get("financial_terms", {}).get("beneficiary_interest_rate_percent")
        if rate is not None:
            score += max(0.0, 16.0 - float(rate))
        return score

    eligible_primary.sort(key=get_sort_key, reverse=True)

    best_scheme = eligible_primary[0] if eligible_primary else None
    overall_match_score = best_scheme.get("match_score", 0) if best_scheme else 0

    # Nearest partner lookup if state/district provided
    nearest_partner = None
    state = user_data.get("state")
    district = user_data.get("district")
    if state:
        try:
            from services.channel_partner_locator import find_channel_partners
            partner_res = find_channel_partners(
                state=state,
                district=district,
                scheme_id=best_scheme.get("scheme_id") if best_scheme else None,
                max_results=1,
            )
            if partner_res.get("partners"):
                nearest_partner = partner_res["partners"][0]
        except Exception as e:
            print(f"Error fetching nearest partner: {e}")

    return {
        "status": "success",
        "match_score": overall_match_score,
        "best_scheme": best_scheme,
        "nearest_partner": nearest_partner,
        "primary": {
            "eligible": eligible_primary,
            "ineligible": [
                result
                for result in primary_results
                if not result["eligible"]
            ],
        },
        "secondary": {
            "eligible": eligible_secondary,
            "ineligible": [
                result
                for result in secondary_results
                if not result["eligible"]
            ],
        },
    }
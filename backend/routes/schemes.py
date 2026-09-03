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


def load_schemes() -> list[dict[str, Any]]:
    with open(
        SCHEME_FILE,
        "r",
        encoding="utf-8",
    ) as file:
        data = json.load(file)

    return data["schemes"]


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

    results = evaluate_schemes(
        user_data,
        schemes,
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

    return {
        "status": "success",
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
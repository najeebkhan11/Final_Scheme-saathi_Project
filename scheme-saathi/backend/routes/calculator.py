"""EMI Calculator API route for Scheme Saathi.

Provides deterministic EMI calculation endpoint.
Does NOT use AI — uses standard financial formulas.
"""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.emi_calculator import calculate_emi, calculate_emi_for_scheme


router = APIRouter(
    prefix="/api/emi",
    tags=["EMI Calculator"],
)


class EMICalculationRequest(BaseModel):
    principal: float = Field(..., gt=0, description="Loan amount in INR")
    interest_rate: Optional[float] = Field(
        default=None, ge=0, description="Annual interest rate in %"
    )
    tenure_months: Optional[int] = Field(
        default=None, gt=0, description="Loan tenure in months"
    )
    scheme_id: Optional[str] = Field(
        default=None, description="Scheme ID for scheme-specific defaults"
    )
    moratorium_months: int = Field(default=0, ge=0)
    moratorium_treatment: str = Field(default="simple_interest")


@router.post("/calculate")
def calculate(request: EMICalculationRequest):
    """Calculate EMI using deterministic formula.

    If scheme_id is provided, uses scheme-specific defaults for
    interest rate and tenure when not explicitly supplied.
    """
    if request.scheme_id:
        result = calculate_emi_for_scheme(
            scheme_id=request.scheme_id,
            principal=request.principal,
            annual_interest_rate=request.interest_rate,
            tenure_months=request.tenure_months,
            moratorium_months=request.moratorium_months,
            moratorium_treatment=request.moratorium_treatment,
        )
    else:
        rate = request.interest_rate if request.interest_rate is not None else 6.0
        tenure = request.tenure_months if request.tenure_months is not None else 60
        result = calculate_emi(
            principal=request.principal,
            annual_interest_rate=rate,
            tenure_months=tenure,
            moratorium_months=request.moratorium_months,
            moratorium_treatment=request.moratorium_treatment,
        )

    return {
        "status": "success",
        "emi": result,
    }

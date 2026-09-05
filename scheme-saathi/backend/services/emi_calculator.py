"""EMI Calculator Service.

Provides deterministic EMI calculations for government schemes.
This service does NOT use AI - it uses standard financial formulas.
"""

import math
from typing import Any


def calculate_emi(
    principal: float,
    annual_interest_rate: float,
    tenure_months: int,
    moratorium_months: int = 0,
    moratorium_treatment: str = "simple_interest",
) -> dict[str, Any]:
    """Calculate EMI for a loan.

    This is a deterministic function using standard EMI formula.
    It does NOT use AI or make any subjective recommendations.

    EMI Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)

    Where:
        P = Principal loan amount
        r = Monthly interest rate (annual rate / 12 / 100)
        n = Number of monthly installments

    Args:
        principal: Loan amount in INR (must be > 0)
        annual_interest_rate: Annual interest rate in percentage (e.g., 6.5 for 6.5%)
        tenure_months: Loan tenure in months (must be > 0)
        moratorium_months: Moratorium period in months (default 0)
        moratorium_treatment: How to treat moratorium ("simple_interest" or "none")

    Returns:
        dict with keys:
            - principal: Original loan amount
            - interest_rate: Annual interest rate
            - tenure_months: Total tenure
            - moratorium_months: Moratorium period
            - monthly_emi: Monthly EMI amount
            - total_interest: Total interest payable
            - total_repayment: Total amount to be repaid
            - moratorium_treatment: How moratorium was treated
            - calculation_method: Formula used
    """
    if principal <= 0:
        raise ValueError("Principal must be greater than 0")
    if tenure_months <= 0:
        raise ValueError("Tenure must be greater than 0")
    if annual_interest_rate < 0:
        raise ValueError("Interest rate cannot be negative")

    # Handle 0% interest rate (interest-free loan)
    if annual_interest_rate == 0:
        monthly_emi = principal / tenure_months
        return {
            "principal": principal,
            "interest_rate": annual_interest_rate,
            "tenure_months": tenure_months,
            "moratorium_months": moratorium_months,
            "monthly_emi": round(monthly_emi, 2),
            "total_interest": 0,
            "total_repayment": principal,
            "moratorium_treatment": "none",
            "calculation_method": "zero_interest",
        }

    # Calculate monthly interest rate
    monthly_rate = annual_interest_rate / 12 / 100

    # Calculate EMI using standard formula
    # EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    if monthly_rate > 0:
        emi_factor = (1 + monthly_rate) ** tenure_months
        monthly_emi = principal * monthly_rate * emi_factor / (emi_factor - 1)
    else:
        monthly_emi = principal / tenure_months

    # Calculate total repayment
    total_repayment = monthly_emi * tenure_months
    total_interest = total_repayment - principal

    # Handle moratorium period
    moratorium_interest = 0
    if moratorium_months > 0:
        if moratorium_treatment == "simple_interest":
            # During moratorium, simple interest accrues on outstanding principal
            moratorium_interest = principal * (annual_interest_rate / 100) * (moratorium_months / 12)
            total_interest += moratorium_interest
            total_repayment += moratorium_interest
        # If moratorium_treatment is "none", no additional interest during moratorium

    return {
        "principal": principal,
        "interest_rate": annual_interest_rate,
        "tenure_months": tenure_months,
        "moratorium_months": moratorium_months,
        "monthly_emi": round(monthly_emi, 2),
        "total_interest": round(total_interest, 2),
        "total_repayment": round(total_repayment, 2),
        "moratorium_treatment": moratorium_treatment if moratorium_months > 0 else "none",
        "calculation_method": "standard_emi_formula",
    }


def calculate_emi_for_scheme(
    scheme_id: str,
    principal: float,
    annual_interest_rate: float | None = None,
    tenure_months: int | None = None,
    moratorium_months: int = 0,
    moratorium_treatment: str = "simple_interest",
) -> dict[str, Any]:
    """Calculate EMI for a specific scheme with default parameters.

    Uses scheme-specific defaults for interest rate and tenure if not provided.

    Args:
        scheme_id: Scheme ID (e.g., "NSFDC_ATNF")
        principal: Loan amount in INR
        annual_interest_rate: Override scheme's default interest rate (optional)
        tenure_months: Override scheme's default tenure (optional)
        moratorium_months: Moratorium period in months (default 0)
        moratorium_treatment: How to treat moratorium

    Returns:
        dict with EMI calculation results plus scheme metadata
    """
    # Scheme-specific defaults
    scheme_defaults = {
        "NSFDC_ATNF": {"interest_rate": 6.0, "tenure_months": 60},
        "NSFDC_MSFDC": {"interest_rate": 6.0, "tenure_months": 84},
        "NSFDC_Consumption": {"interest_rate": 6.0, "tenure_months": 60},
        "NSFDC_Trust": {"interest_rate": 6.0, "tenure_months": 60},
        "NSFDC_Marriage": {"interest_rate": 6.0, "tenure_months": 36},
        "VISVAS": {"interest_rate": 1.0, "tenure_months": 60},  # 5% subvention on 6%
    }

    defaults = scheme_defaults.get(scheme_id, {"interest_rate": 6.0, "tenure_months": 60})

    # Use provided values or defaults
    rate = annual_interest_rate if annual_interest_rate is not None else defaults["interest_rate"]
    tenure = tenure_months if tenure_months is not None else defaults["tenure_months"]

    # Calculate EMI
    result = calculate_emi(
        principal=principal,
        annual_interest_rate=rate,
        tenure_months=tenure,
        moratorium_months=moratorium_months,
        moratorium_treatment=moratorium_treatment,
    )

    # Add scheme metadata
    result["scheme_id"] = scheme_id
    result["scheme_name"] = _get_scheme_name(scheme_id)

    return result


def _get_scheme_name(scheme_id: str) -> str:
    """Get human-readable scheme name."""
    scheme_names = {
        "NSFDC_ATNF": "Term Loan for Education/Business",
        "NSFDC_MSFDC": "Mahila Samakhya Financial Development Corporation",
        "NSFDC_Consumption": "Consumption Loan Scheme",
        "NSFDC_Trust": "Trust Fund for SC/ST",
        "NSFDC_Marriage": "Marriage Loan Scheme",
        "VISVAS": "Vanchit Ikai Samooh aur Vargon ki Aarthik Sahayata Yojana",
    }
    return scheme_names.get(scheme_id, "Unknown Scheme")


def get_scheme_financial_terms(scheme_id: str) -> dict[str, Any] | None:
    """Get financial terms for a scheme from the master data."""
    import json
    from pathlib import Path

    scheme_file = Path(__file__).resolve().parent.parent / "data" / "schemes.json"

    if not scheme_file.exists():
        return None

    with open(scheme_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    schemes = data.get("schemes", [])

    for scheme in schemes:
        if scheme.get("id") == scheme_id:
            financial_terms = scheme.get("financial_terms", {})
            return {
                "scheme_id": scheme_id,
                "scheme_name": scheme.get("name", "Unknown"),
                "interest_rate": financial_terms.get("interest_rate_percent"),
                "max_loan_amount": financial_terms.get("max_loan_amount_inr"),
                "tenure_months": financial_terms.get("tenure_months"),
                "moratorium_months": financial_terms.get("moratorium_months"),
            }

    return None

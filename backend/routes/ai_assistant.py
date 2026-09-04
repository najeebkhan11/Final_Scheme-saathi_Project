"""
AI Assistant API route for Scheme Saathi.

Handles:
- POST /api/ai/assistant — main chat endpoint
- GET /api/ai/languages — available language options
"""

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from schemas.ai_assistant import AIAssistantRequest, AIAssistantResponse
from services.ai_assistant import get_ai_response
from services.channel_partner_locator import find_channel_partners
from services.emi_calculator import calculate_emi_for_scheme
from services.languages import build_language_selector_options
from database.database import get_db


router = APIRouter(
    prefix="/api/ai",
    tags=["AI Assistant"],
)


BASE_DIR = Path(__file__).resolve().parent.parent
SCHEME_FILE = BASE_DIR / "data" / "schemes.json"


_SCHEMES_CACHE: list[dict[str, Any]] | None = None


def _load_schemes() -> list[dict[str, Any]]:
    global _SCHEMES_CACHE
    if _SCHEMES_CACHE is not None:
        return _SCHEMES_CACHE
    with open(SCHEME_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    _SCHEMES_CACHE = data["schemes"]
    return _SCHEMES_CACHE


def _get_user_profile(user_id: int) -> dict[str, Any] | None:
    """Retrieve user profile from the database."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM user_profiles WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def _get_user_profile_from_token(authorization: str | None) -> tuple[dict[str, Any] | None, int | None]:
    """Extract user profile from the JWT token if available.

    Returns (profile, user_id) tuple.
    """
    if not authorization:
        return None, None
    try:
        from services.auth import decode_token
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None, None
        payload = decode_token(token)
        if not payload or "sub" not in payload:
            return None, None
        user_id = int(payload["sub"])
        profile = _get_user_profile(user_id)
        return profile, user_id
    except Exception:
        return None, None


def _run_rule_engine_locally(
    user_profile: dict[str, Any],
    schemes: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the eligibility rule engine and return (eligible, ineligible).

    OUT_OF_SCOPE schemes are excluded from eligibility evaluation.
    They are only available as AI Assistant fallback alternatives.
    """
    from services.eligibility import evaluate_schemes

    user_data = {
        "category": user_profile.get("category", ""),
        "gender": user_profile.get("gender"),
        "annual_income": float(user_profile.get("annual_income", 0)),
        "purpose": user_profile.get("purpose"),
        "project_cost": user_profile.get("project_cost"),
        "required_loan": user_profile.get("required_loan"),
        "education_level": user_profile.get("education_level"),
    }

    # Filter OUT_OF_SCOPE schemes from eligibility evaluation
    eligible_for_matching = [
        s for s in schemes
        if s.get("type") not in ("OUT_OF_SCOPE",)
    ]

    results = evaluate_schemes(user_data, eligible_for_matching)

    eligible = [r for r in results if r["eligible"]]
    ineligible = [r for r in results if not r["eligible"]]

    return eligible, ineligible


def _enrich_schemes_with_application_fields(
    schemes: list[dict[str, Any]],
    scheme_data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Enrich scheme results with application_steps, official_url, and
    application_process_verified from the master scheme data.

    This ensures the AI context includes application-related fields
    even if the rule engine output doesn't carry them.
    """
    scheme_lookup = {s["id"]: s for s in scheme_data}

    enriched = []
    for scheme in schemes:
        sid = scheme.get("scheme_id") or scheme.get("id", "")
        master = scheme_lookup.get(sid, {})
        source = master.get("source") or {}
        channel_req = master.get("channel_requirements") or {}

        enriched_scheme = dict(scheme)
        enriched_scheme["official_url"] = source.get("official_url")
        enriched_scheme["application_steps"] = master.get("application_steps")
        enriched_scheme["application_process_verified"] = master.get(
            "application_process_verified", False
        )
        enriched_scheme["financial_terms_raw"] = master.get("financial_terms")
        enriched_scheme["channel_requirements"] = channel_req

        # Preserve criterion_status from rule engine output for ineligible schemes
        if "criterion_status" in scheme:
            enriched_scheme["criterion_status"] = scheme["criterion_status"]

        # Flag schemes that need Channel Partner assistance
        # If application process is not verified AND scheme requires channel route
        has_channel_requirement = bool(channel_req.get("implementation"))
        app_process_verified = enriched_scheme["application_process_verified"]
        if not app_process_verified and has_channel_requirement:
            enriched_scheme["channel_partner_fallback_needed"] = True
        elif not app_process_verified and not enriched_scheme.get("application_steps"):
            enriched_scheme["channel_partner_fallback_needed"] = True

        enriched.append(enriched_scheme)

    return enriched


def _get_application_process_verified(
    scheme: dict[str, Any],
) -> bool:
    """Check if the scheme's complete application process is verified."""
    if scheme.get("application_process_verified"):
        return True
    if scheme.get("application_steps"):
        return True
    return False


class LanguageOption(BaseModel):
    code: str
    name: str
    native_name: str
    display: str


@router.get("/languages")
def get_languages():
    """Return available language options for the AI Assistant."""
    options = build_language_selector_options()
    return {
        "status": "success",
        "languages": options,
    }


@router.post("/assistant")
async def ai_assistant(
    request: AIAssistantRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """Main AI Assistant endpoint.

    Accepts a user message and optional context, returns AI response
    with structured data from verified backend sources.

    When authenticated and no scheme_context is provided,
    automatically fetches user profile and runs the rule engine
    to provide the AI with eligibility context.
    """
    user_profile = None

    # Try to get profile from the Authorization header
    token_profile, user_id = _get_user_profile_from_token(authorization)

    eligible_schemes = None
    ineligible_schemes = None

    # Load master scheme data for enrichment
    try:
        all_schemes = _load_schemes()
    except Exception:
        all_schemes = []

    # If the frontend provides scheme context (from previous matching),
    # use it directly instead of re-running the rule engine.
    if request.scheme_context:
        ctx = request.scheme_context
        eligible_schemes = ctx.get("eligible_schemes", [])
        ineligible_schemes = ctx.get("ineligible_schemes", [])
        user_profile = ctx.get("user_profile", None)

        # If no user_profile in context but we have token profile, use it
        if not user_profile and token_profile:
            user_profile = token_profile

    elif token_profile:
        # Authenticated but no scheme_context provided
        # Auto-fetch profile and run rule engine for AI context
        user_profile = token_profile

        # Check if profile has enough data to run rule engine
        has_category = bool(user_profile.get("category"))
        has_income = user_profile.get("annual_income") is not None

        if has_category and has_income:
            try:
                eligible_schemes, ineligible_schemes = _run_rule_engine_locally(
                    user_profile, all_schemes
                )
            except Exception as e:
                # Rule engine failure should not crash the AI assistant
                eligible_schemes = None
                ineligible_schemes = None

    # Enrich eligible/ineligible schemes with application fields
    if eligible_schemes and all_schemes:
        eligible_schemes = _enrich_schemes_with_application_fields(
            eligible_schemes, all_schemes
        )
    if ineligible_schemes and all_schemes:
        ineligible_schemes = _enrich_schemes_with_application_fields(
            ineligible_schemes, all_schemes
        )

    # Auto-fetch channel partners for schemes that need them
    # If any scheme has channel_partner_fallback_needed, fetch partner data
    partner_output = request.partner_output
    if not partner_output:
        schemes_needing_partners = []
        for scheme in (eligible_schemes or []):
            if scheme.get("channel_partner_fallback_needed"):
                schemes_needing_partners.append(scheme)
        for scheme in (ineligible_schemes or []):
            if scheme.get("channel_partner_fallback_needed"):
                schemes_needing_partners.append(scheme)

        if schemes_needing_partners:
            # Determine user location from profile or scheme context
            user_state = None
            user_district = None
            if user_profile:
                user_state = user_profile.get("state")
                user_district = user_profile.get("district")
            elif request.scheme_context:
                ctx_profile = request.scheme_context.get("user_profile", {})
                user_state = ctx_profile.get("state")
                user_district = ctx_profile.get("district")

            # Find partners for the first scheme needing partners
            # (typically all schemes share the same channel requirements)
            if user_state:
                try:
                    partner_output = find_channel_partners(
                        state=user_state,
                        district=user_district,
                        max_results=5,
                    )
                except Exception:
                    # Partner locator failure should not crash the AI assistant
                    partner_output = None

    # Auto-calculate EMI if user asks about EMI or loan calculations
    # Check if message contains EMI-related keywords
    emi_output = request.emi_output
    if not emi_output and request.message:
        emi_keywords = ["emi", "monthly installment", "loan repayment", "calculate emi", "loan amount"]
        message_lower = request.message.lower()
        if any(keyword in message_lower for keyword in emi_keywords):
            # Try to calculate EMI for the first eligible scheme with loan amount
            for scheme in (eligible_schemes or []):
                scheme_id = scheme.get("scheme_id") or scheme.get("id")
                # Get loan amount from user profile or scheme context
                loan_amount = None
                if user_profile:
                    loan_amount = user_profile.get("required_loan") or user_profile.get("project_cost")
                elif request.scheme_context:
                    ctx_profile = request.scheme_context.get("user_profile", {})
                    loan_amount = ctx_profile.get("required_loan") or ctx_profile.get("project_cost")

                if loan_amount and scheme_id:
                    try:
                        emi_output = calculate_emi_for_scheme(
                            scheme_id=scheme_id,
                            principal=float(loan_amount),
                        )
                        break  # Calculate EMI for the first matching scheme
                    except Exception:
                        # EMI calculation failure should not crash the AI assistant
                        emi_output = None

    # If ineligibility query is provided, we use it for explanation
    ineligibility_query = request.ineligibility_query

    # Determine out-of-scope schemes
    # (verified in scheme data but not within Scheme Saathi's primary scope)
    out_of_scope_schemes = []
    if all_schemes:
        known_ids = set()
        known_ids.update(
            (s.get("scheme_id") or s.get("id"))
            for s in (eligible_schemes or [])
            if (s.get("scheme_id") or s.get("id"))
        )
        known_ids.update(
            (s.get("scheme_id") or s.get("id"))
            for s in (ineligible_schemes or [])
            if (s.get("scheme_id") or s.get("id"))
        )
        # Check for out-of-scope schemes in master data
        # These are schemes that are verified but marked as out-of-scope
        for scheme in all_schemes:
            if scheme.get("out_of_scope") or scheme.get("type") == "OUT_OF_SCOPE":
                sid = scheme.get("id", "")
                # Only include if not already in eligible/ineligible
                if sid not in known_ids:
                    source = scheme.get("source") or {}
                    out_of_scope_schemes.append({
                        "name": scheme.get("name", "Unknown"),
                        "official_url": source.get("official_url"),
                        "reason": "Verified but outside Scheme Saathi primary scope",
                        "scheme_id": sid,
                    })

    # Also accept out-of-scope schemes from frontend context
    if request.scheme_context and request.scheme_context.get("out_of_scope_schemes"):
        for oos in request.scheme_context["out_of_scope_schemes"]:
            if oos.get("name") and oos.get("official_url"):
                out_of_scope_schemes.append({
                    "name": oos["name"],
                    "official_url": oos["official_url"],
                    "reason": oos.get("reason", "Outside Scheme Saathi Scope"),
                    "scheme_id": oos.get("scheme_id", ""),
                })

    try:
        response_data = await get_ai_response(
            message=request.message,
            language=request.language,
            user_profile=user_profile,
            eligible_schemes=eligible_schemes,
            ineligible_schemes=ineligible_schemes,
            emi_output=emi_output,
            partner_output=partner_output,
            ineligibility_query=ineligibility_query,
            out_of_scope_schemes=out_of_scope_schemes or None,
        )
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Error generating AI response: {e}", exc_info=True)
        response_data = {
            "reply": (
                "Welcome to **Scheme Saathi**! I can help you with all concessional government schemes for "
                "Scheduled Caste entrepreneurs under the National Scheduled Castes Finance and Development Corporation (NSFDC).\n\n"
                "You can ask about:\n"
                "- **Micro Finance Scheme (MFS)** (Loans up to ₹1.25L at 6.5% interest, 40% reserved for women)\n"
                "- **Term Loan (TL)** (Loans up to ₹45L at 6%–8% interest for businesses and transport)\n"
                "- **Educational Loan Scheme (ELS)** (Up to ₹20L in India / ₹40L Abroad at 6.0%–6.5%)\n"
                "- **Udyam Nidhi Yojana (UNY)** (Entrepreneurship support up to ₹4.5L)\n"
                "- **Eligibility & Required Documents** (Caste certificate, income up to ₹5 Lakh)\n\n"
                "What would you like to know more about?"
            ),
            "language_used": request.language or "en",
            "language_detected": False,
            "disclaimer": "Eligibility is determined by Scheme Saathi's rule engine. Final approval is decided by the concerned lending institution.",
        }

    return {
        "status": "success",
        **response_data,
    }


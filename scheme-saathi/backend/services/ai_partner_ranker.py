import os
import json
from google import genai


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

_GENAI_CLIENT = None
_RANKING_CACHE: dict[str, list[dict]] = {}


def _get_client():
    global _GENAI_CLIENT
    if _GENAI_CLIENT is None and GEMINI_API_KEY:
        _GENAI_CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _GENAI_CLIENT


def rank_partners_with_ai(
    partners,
    user_state=None,
    user_district=None,
    loan_category=None,
    scheme_id=None,
):
    """
    AI ranks ONLY partners already found by the backend.
    AI is never allowed to invent new partners.
    """

    if not partners:
        return []

    # If Gemini key is unavailable, use normal ranking
    if not GEMINI_API_KEY:
        return partners

    cache_key = f"{user_state}_{user_district}_{loan_category}_{scheme_id}_{len(partners)}"
    if cache_key in _RANKING_CACHE:
        return _RANKING_CACHE[cache_key]

    try:
        client = _get_client()
        if not client:
            return partners

        partner_data = []

        for index, partner in enumerate(partners):
            partner_data.append({
                "index": index,
                "name": partner.get("name"),
                "type": partner.get("type"),
                "state": partner.get("state"),
                "district": partner.get("district"),
                "distance_km": partner.get("distance_km"),
                "supported_loan_categories": partner.get(
                    "supported_loan_categories", []
                ),
                "supported_schemes": partner.get(
                    "supported_schemes", []
                ),
            })

        prompt = f"""
You are an AI ranking system for India's government financial
scheme Channel Partner Locator.

IMPORTANT RULES:

1. You MUST ONLY rank partners provided in PARTNERS.
2. NEVER invent a bank, agency, channel partner, address,
   scheme, or organisation.
3. Return ONLY JSON.
4. Prefer geographically closer partners.
5. Prefer partners compatible with the requested scheme.
6. Prefer partners compatible with the loan category.

USER DETAILS:

State: {user_state}
District: {user_district}
Loan Category: {loan_category}
Scheme ID: {scheme_id}

PARTNERS:

{json.dumps(partner_data, ensure_ascii=False)}

Return this JSON:

{{
    "ranking": [
        {{
            "index": 0,
            "score": 95,
            "reason": "Short reason"
        }}
    ]
}}
"""

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        text = response.text.strip()

        # Remove markdown formatting if Gemini returns it
        text = text.replace("```json", "")
        text = text.replace("```", "")
        text = text.strip()

        ai_result = json.loads(text)

        rankings = ai_result.get("ranking", [])

        ranked_partners = []

        for item in rankings:

            index = item.get("index")

            if (
                isinstance(index, int)
                and 0 <= index < len(partners)
            ):
                partner = partners[index].copy()

                partner["ai_score"] = item.get(
                    "score",
                    0
                )

                partner["ai_reason"] = item.get(
                    "reason",
                    "Recommended based on available partner information."
                )

                ranked_partners.append(partner)

        # Add partners Gemini didn't return
        ranked_indexes = {
            item.get("index")
            for item in rankings
            if isinstance(item.get("index"), int)
        }

        for index, partner in enumerate(partners):

            if index not in ranked_indexes:

                partner_copy = partner.copy()

                partner_copy["ai_score"] = 0

                partner_copy["ai_reason"] = (
                    "Alternative partner based on available data."
                )

                ranked_partners.append(partner_copy)

        _RANKING_CACHE[cache_key] = ranked_partners
        return ranked_partners

    except Exception as error:

        print(
            f"AI partner ranking error: {error}"
        )

        # Normal fallback sorting
        return sorted(
            partners,
            key=lambda x: (
                x.get("distance_km")
                if x.get("distance_km") is not None
                else 999999
            )
        )
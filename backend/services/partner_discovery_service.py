import json
from pathlib import Path
from typing import Any


DATA_FILE = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "channel_partners.json"
)


def normalize(value: Any) -> str:

    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("-", " ")
        .replace("_", " ")
    )


def load_cached_partners():

    if not DATA_FILE.exists():

        print(
            f"Partner database not found: {DATA_FILE}"
        )

        return []

    try:

        with open(
            DATA_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        return data.get(
            "partners",
            []
        )

    except Exception as error:

        print(
            f"Error loading partners: {error}"
        )

        return []


def discover_partners(
    state=None,
    district=None,
    loan_category=None,
    scheme_id=None,
):
    """
    Partner Discovery Layer.

    Currently:
    1. Searches cached verified partner database.

    Future:
    Add official government APIs or verified
    government directories here without changing
    the frontend or locator.
    """

    all_partners = load_cached_partners()

    results = []

    normalized_state = normalize(state)
    normalized_district = normalize(district)

    for partner in all_partners:

        # Ignore inactive partners
        if normalize(
            partner.get("status")
        ) != "active":

            continue

        partner_state = normalize(
            partner.get("state")
        )

        partner_district = normalize(
            partner.get("district")
        )

        score = 0

        # State matching
        if (
            normalized_state
            and partner_state == normalized_state
        ):

            score += 50

        # District matching
        if (
            normalized_district
            and partner_district == normalized_district
        ):

            score += 50

        # Scheme matching
        supported_schemes = partner.get(
            "supported_schemes",
            []
        )

        if (
            scheme_id
            and supported_schemes
        ):

            normalized_schemes = [
                normalize(item)
                for item in supported_schemes
            ]

            if normalize(scheme_id) in normalized_schemes:

                score += 30

        # Loan category matching
        categories = partner.get(
            "supported_loan_categories",
            []
        )

        if (
            loan_category
            and categories
        ):

            normalized_categories = [
                normalize(item)
                for item in categories
            ]

            if (
                normalize(loan_category)
                in normalized_categories
            ):

                score += 30

        partner_copy = partner.copy()

        partner_copy["discovery_score"] = score

        results.append(partner_copy)

    return results
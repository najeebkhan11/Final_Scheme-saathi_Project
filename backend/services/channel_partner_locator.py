"""
Channel Partner Locator Service
===============================

Search Priority:

1. Exact District Partner
2. Exact State Partner
3. GPS Nearby Verified Physical Partner
4. Official National Application Route

Important:
- Physical partners are never mixed with national online routes.
- A distant centre is not shown as "nearby".
- If no verified nearby partner exists, the official application
  route is returned instead.
"""

from pathlib import Path
from typing import Any
import json
import math


# ============================================================
# CONFIGURATION
# ============================================================

PARTNER_FILE = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "channel_partners.json"
)

# Maximum distance for a physical partner to be considered nearby.
# This prevents Lucknow/Mumbai/Kolkata/Bengaluru from appearing
# for every state in India.
MAX_NEARBY_DISTANCE_KM = 300


# ============================================================
# LOAD PARTNERS
# ============================================================

_PARTNERS_CACHE: list[dict[str, Any]] | None = None


def load_partners() -> list[dict[str, Any]]:
    """Load channel partners from JSON safely with in-memory caching."""
    global _PARTNERS_CACHE
    if _PARTNERS_CACHE is not None:
        return _PARTNERS_CACHE

    if not PARTNER_FILE.exists():
        print(f"WARNING: Partner data file not found: {PARTNER_FILE}")
        return []

    try:
        with open(PARTNER_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        partners = data.get("partners", [])

        if not isinstance(partners, list):
            return []

        _PARTNERS_CACHE = partners
        return _PARTNERS_CACHE

    except json.JSONDecodeError as error:
        print(f"ERROR: Invalid channel_partners.json: {error}")
        return []

    except Exception as error:
        print(f"ERROR loading channel partners: {error}")
        return []


# ============================================================
# NORMALIZATION
# ============================================================

def normalize(value: Any) -> str:
    """Normalize text for comparison."""

    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("-", " ")
        .replace("_", " ")
        .replace(".", "")
    )


# ============================================================
# STATE ALIASES
# ============================================================

STATE_ALIASES = {
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
    "pondicherry": "puducherry",
    "pondicherry (ut)": "puducherry",
    "puducherry (ut)": "puducherry",
    "jammu kashmir": "jammu and kashmir",
    "jammu & kashmir": "jammu and kashmir",
    "nct of delhi": "delhi",
    "new delhi": "delhi",
    "delhi (nct)": "delhi",
    "chandigarh (ut)": "chandigarh",
    "dadra and nagar haveli (ut)": "dadra and nagar haveli",
    "daman and diu (ut)": "daman and diu",
    "lakshadweep (ut)": "lakshadweep",
    "andaman and nicobar islands (ut)": "andaman and nicobar islands",
}


def normalize_state(state: str | None) -> str:
    """Normalize Indian state names."""

    normalized = normalize(state)

    return STATE_ALIASES.get(
        normalized,
        normalized
    )


# ============================================================
# DISTRICT NORMALIZATION
# ============================================================

DISTRICT_ALIASES = {
    "bangalore": "bengaluru",
    "bangalore urban": "bengaluru urban",
    "bombay": "mumbai",
    "calcutta": "kolkata",
}


def districts_match(
    partner_district: str | None,
    user_district: str | None
) -> bool:
    """Check whether districts match."""

    partner_value = normalize(partner_district)
    user_value = normalize(user_district)

    if not partner_value or not user_value:
        return False

    partner_value = DISTRICT_ALIASES.get(
        partner_value,
        partner_value
    )

    user_value = DISTRICT_ALIASES.get(
        user_value,
        user_value
    )

    if partner_value == user_value:
        return True

    # Allows minor district variations
    return (
        partner_value in user_value
        or user_value in partner_value
    )


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate distance between two GPS coordinates
    using the Haversine formula.
    """

    earth_radius_km = 6371.0

    lat_difference = math.radians(lat2 - lat1)
    lon_difference = math.radians(lon2 - lon1)

    a = (
        math.sin(lat_difference / 2) ** 2
        +
        math.cos(math.radians(lat1))
        *
        math.cos(math.radians(lat2))
        *
        math.sin(lon_difference / 2) ** 2
    )

    c = (
        2
        *
        math.atan2(
            math.sqrt(a),
            math.sqrt(1 - a)
        )
    )

    return earth_radius_km * c


# ============================================================
# PARTNER TYPE CHECKS
# ============================================================

def is_active(partner: dict[str, Any]) -> bool:
    """Check whether partner is active."""

    return normalize(
        partner.get("status")
    ) == "active"


def is_verified(partner: dict[str, Any]) -> bool:
    """Check whether partner is verified."""

    return bool(
        partner.get("verified", False)
    )


def is_national_route(partner: dict[str, Any]) -> bool:
    """
    Check if this is a national online application route.
    """

    if normalize(partner.get("state")) in ("all india", "national", "pan india"):
        return True

    return bool(
        partner.get("is_fallback", False)
        or partner.get("record_scope") == "national_digital_portal"
    )


def is_physical_location(partner: dict[str, Any]) -> bool:
    """
    Physical location must:
    - not be a national route
    - have latitude
    - have longitude
    """

    if is_national_route(partner):
        return False

    latitude = partner.get("latitude")
    longitude = partner.get("longitude")

    return (
        latitude is not None
        and longitude is not None
    )


# ============================================================
# SCHEME COMPATIBILITY
# ============================================================

def supports_scheme(
    partner: dict[str, Any],
    scheme_id: str | None
) -> bool:
    """
    Empty supported_schemes means the partner can be
    considered a general official channel.
    """

    if not scheme_id:
        return True

    supported_schemes = partner.get(
        "supported_schemes",
        []
    )

    if not supported_schemes:
        return True

    requested_scheme = normalize(scheme_id)

    return requested_scheme in [
        normalize(item)
        for item in supported_schemes
    ]


# ============================================================
# LOAN CATEGORY COMPATIBILITY
# ============================================================

def supports_category(
    partner: dict[str, Any],
    loan_category: str | None
) -> bool:
    """
    Empty categories means general official support.
    """

    if not loan_category:
        return True

    categories = partner.get(
        "supported_loan_categories",
        []
    )

    if not categories:
        return True

    requested_category = normalize(
        loan_category
    )

    return requested_category in [
        normalize(category)
        for category in categories
    ]


# ============================================================
# FILTER ELIGIBLE PARTNERS
# ============================================================

def get_eligible_partners(
    partners: list[dict[str, Any]],
    scheme_id: str | None,
    loan_category: str | None
) -> list[dict[str, Any]]:

    eligible = []

    for partner in partners:

        if not is_active(partner):
            continue

        if not is_verified(partner):
            continue

        if not supports_scheme(
            partner,
            scheme_id
        ):
            continue

        if not supports_category(
            partner,
            loan_category
        ):
            continue

        eligible.append(partner)

    return eligible


# ============================================================
# FORMAT PARTNER
# ============================================================

def format_partner(
    partner: dict[str, Any],
    user_lat: float | None = None,
    user_lon: float | None = None,
    match_type: str = "eligible"
) -> dict[str, Any]:

    distance_km = None

    partner_lat = partner.get("latitude")
    partner_lon = partner.get("longitude")

    try:

        if (
            user_lat is not None
            and user_lon is not None
            and partner_lat is not None
            and partner_lon is not None
        ):

            distance_km = calculate_distance(
                float(user_lat),
                float(user_lon),
                float(partner_lat),
                float(partner_lon)
            )

    except (
        ValueError,
        TypeError
    ):
        distance_km = None

    return {
        "partner_id": partner.get("partner_id"),

        "name": partner.get("name"),

        "type": partner.get("type"),

        "state": partner.get("state"),

        "district": partner.get("district"),

        "address": partner.get("address"),

        "contact": partner.get("contact"),

        "website": partner.get("website"),

        "official_url": partner.get("official_url"),

        "supported_loan_categories":
            partner.get(
                "supported_loan_categories",
                []
            ),

        "supported_schemes":
            partner.get(
                "supported_schemes",
                []
            ),

        "max_loan_amount_handled":
            partner.get(
                "max_loan_amount_handled"
            ),

        "latitude":
            partner.get("latitude"),

        "longitude":
            partner.get("longitude"),

        "distance_km":
            round(distance_km, 2)
            if distance_km is not None
            else None,

        "verified":
            partner.get(
                "verified",
                False
            ),

        "verification_source":
            partner.get(
                "verification_source"
            ),

        "verification_date":
            partner.get(
                "verification_date"
            ),

        "is_fallback":
            partner.get(
                "is_fallback",
                False
            ),

        "is_application_channel":
            partner.get(
                "is_application_channel",
                False
            ),

        "fallback_priority":
            partner.get(
                "fallback_priority",
                999
            ),

        "match_type":
            match_type
    }


# ============================================================
# SORT PARTNERS
# ============================================================

def sort_by_distance(
    partners: list[dict[str, Any]]
) -> list[dict[str, Any]]:

    return sorted(
        partners,
        key=lambda item: (
            item.get("distance_km")
            if item.get("distance_km") is not None
            else float("inf")
        )
    )


# ============================================================
# RESPONSE
# ============================================================

def create_response(
    partners: list[dict[str, Any]],
    state: str | None,
    district: str | None,
    scheme_id: str | None,
    loan_category: str | None,
    search_type: str,
    message: str
) -> dict[str, Any]:

    return {
        "partners": partners,

        "total_found": len(partners),

        "search_type": search_type,

        "search_criteria": {
            "state": state,
            "district": district,
            "scheme_id": scheme_id,
            "loan_category": loan_category
        },

        "message": message
    }


# ============================================================
# FIND CHANNEL PARTNERS
# ============================================================

def find_channel_partners(
    state: str | None = None,
    district: str | None = None,
    scheme_id: str | None = None,
    loan_category: str | None = None,
    max_results: int = 5,
    user_lat: float | None = None,
    user_lon: float | None = None
) -> dict[str, Any]:

    """
    Find the best available channel partner.

    Priority:

    1. Exact district
    2. Exact state
    3. GPS nearby physical location
    4. Official national application route
    """

    partners = load_partners()

    try:
        max_results = int(max_results)
    except (
        TypeError,
        ValueError
    ):
        max_results = 5

    max_results = max(
        1,
        min(max_results, 10)
    )

    if not partners:

        return create_response(
            partners=[],
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="no_data",
            message=(
                "No Channel Partner data is currently available."
            )
        )

    eligible_partners = get_eligible_partners(
        partners,
        scheme_id,
        loan_category
    )

    if not eligible_partners:

        return create_response(
            partners=[],
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="no_eligible_partner",
            message=(
                "No verified eligible Channel Partner "
                "was found for this request."
            )
        )

    normalized_state = normalize_state(state)

    # ========================================================
    # STEP 1: EXACT DISTRICT MATCH
    # ========================================================

    district_matches = []

    if normalized_state and district:

        for partner in eligible_partners:

            if is_national_route(partner):
                continue

            partner_state = normalize_state(
                partner.get("state")
            )

            if (
                partner_state == normalized_state
                and districts_match(
                    partner.get("district"),
                    district
                )
            ):

                district_matches.append(
                    format_partner(
                        partner,
                        user_lat,
                        user_lon,
                        "exact_district"
                    )
                )

    if district_matches:

        district_matches = sort_by_distance(
            district_matches
        )

        district_matches = district_matches[
            :max_results
        ]

        return create_response(
            partners=district_matches,
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="exact_district",
            message=(
                f"Found {len(district_matches)} verified "
                f"partner(s) in your district."
            )
        )

    # ========================================================
    # STEP 2: EXACT STATE MATCH
    # ========================================================

    state_matches = []

    if normalized_state:

        for partner in eligible_partners:

            if is_national_route(partner):
                continue

            partner_state = normalize_state(
                partner.get("state")
            )

            if partner_state == normalized_state:

                state_matches.append(
                    format_partner(
                        partner,
                        user_lat,
                        user_lon,
                        "exact_state"
                    )
                )

    if state_matches:

        state_matches = sort_by_distance(
            state_matches
        )

        state_matches = state_matches[
            :max_results
        ]

        return create_response(
            partners=state_matches,
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="exact_state",
            message=(
                f"No exact district partner was found. "
                f"Showing verified partner(s) available "
                f"in {state}."
            )
        )

    # ========================================================
    # STEP 3: GPS NEARBY PHYSICAL PARTNER
    # ========================================================

    nearby_matches = []

    if (
        user_lat is not None
        and user_lon is not None
    ):

        for partner in eligible_partners:

            # Never use national portal as nearby location
            if not is_physical_location(partner):
                continue

            formatted = format_partner(
                partner,
                user_lat,
                user_lon,
                "gps_nearby"
            )

            distance = formatted.get(
                "distance_km"
            )

            if distance is None:
                continue

            # CRITICAL FIX:
            # Only show genuinely nearby physical partners.
            if distance <= MAX_NEARBY_DISTANCE_KM:

                nearby_matches.append(
                    formatted
                )

    if nearby_matches:

        nearby_matches = sort_by_distance(
            nearby_matches
        )

        nearby_matches = nearby_matches[
            :max_results
        ]

        return create_response(
            partners=nearby_matches,
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="gps_nearby",
            message=(
                f"Found {len(nearby_matches)} verified "
                f"partner(s) within "
                f"{MAX_NEARBY_DISTANCE_KM} km of your "
                f"current location."
            )
        )

    # ========================================================
    # STEP 4: OFFICIAL NATIONAL ROUTE
    # ========================================================

    national_routes = []

    for partner in eligible_partners:

        if is_national_route(partner):

            national_routes.append(
                format_partner(
                    partner,
                    user_lat,
                    user_lon,
                    "official_national_route"
                )
            )

    if national_routes:

        national_routes = sorted(
            national_routes,
            key=lambda item: item.get(
                "fallback_priority",
                999
            )
        )

        national_routes = national_routes[
            :1
        ]

        return create_response(
            partners=national_routes,
            state=state,
            district=district,
            scheme_id=scheme_id,
            loan_category=loan_category,
            search_type="official_national_route",
            message=(
                "No verified physical Channel Partner was "
                "found in your district, state, or nearby area. "
                "Showing the official national application route."
            )
        )

    # ========================================================
    # NOT FOUND
    # ========================================================

    return create_response(
        partners=[],
        state=state,
        district=district,
        scheme_id=scheme_id,
        loan_category=loan_category,
        search_type="not_found",
        message=(
            "No verified Channel Partner was found."
        )
    )


# ============================================================
# GET PARTNER BY ID
# ============================================================

def get_partner_by_id(
    partner_id: str
) -> dict[str, Any] | None:

    """Get a partner by ID."""

    if not partner_id:
        return None

    requested_id = normalize(partner_id)

    partners = load_partners()

    for partner in partners:

        if normalize(
            partner.get("partner_id")
        ) == requested_id:

            return partner

    return None
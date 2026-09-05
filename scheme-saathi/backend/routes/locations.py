import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api/locations",
    tags=["Locations"],
)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "india_locations.json"
_LOCATIONS_CACHE = None

def load_locations():
    global _LOCATIONS_CACHE
    if _LOCATIONS_CACHE is not None:
        return _LOCATIONS_CACHE
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        _LOCATIONS_CACHE = json.load(f)
    return _LOCATIONS_CACHE

@router.get("/states")
def get_states():
    data = load_locations()
    states = []
    for item in data["states"]:
        states.append({
            "name": item["state"],
            "districts_count": len(item["districts"])
        })
    return {
        "status": "success",
        "count": len(states),
        "states": states
    }

@router.get("/states/{state}/districts")
def get_districts(state: str):
    data = load_locations()
    for item in data["states"]:
        if item["state"].lower() == state.lower():
            return {
                "status": "success",
                "state": item["state"],
                "districts": item["districts"]
            }
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"State '{state}' not found. Please provide a valid Indian state or Union Territory."
    )

@router.post("/validate")
def validate_location(state: str, district: str):
    data = load_locations()
    for item in data["states"]:
        if item["state"].lower() == state.lower():
            if district in item["districts"]:
                return {
                    "status": "success",
                    "valid": True,
                    "state": item["state"],
                    "district": district
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"District '{district}' does not belong to state '{item['state']}'. Please select a valid district."
                )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"State '{state}' not found. Please provide a valid Indian state or Union Territory."
    )


STATE_ALIASES = {
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
    "pondicherry": "puducherry",
    "jammu kashmir": "jammu and kashmir",
    "jammu & kashmir": "jammu and kashmir",
    "nct of delhi": "delhi",
    "new delhi": "delhi",
    "delhi (nct)": "delhi",
    "chandigarh (ut)": "chandigarh",
    "dadra and nagar haveli (ut)": "dadra and nagar haveli",
    "daman and diu (ut)": "daman and diu",
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/reverse-geocode")
@router.post("/reverse-geocode")
def reverse_geocode(latitude: float | None = None, longitude: float | None = None):
    """Resolve latitude/longitude into verified Indian State and District.
    Falls back to client IP detection if coordinates are not provided.
    """
    import urllib.request

    loc_data = load_locations()
    valid_states = loc_data.get("states", [])

    detected_lat = latitude
    detected_lon = longitude
    detected_state = ""
    detected_district = ""
    city = ""
    display_name = ""

    # If coordinates are missing, detect via IP geolocation
    if detected_lat is None or detected_lon is None:
        try:
            req = urllib.request.Request(
                "https://ipapi.co/json/",
                headers={"User-Agent": "SchemeSaathi-Locator/1.0"},
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                ip_data = json.loads(resp.read().decode("utf-8"))
                detected_lat = ip_data.get("latitude")
                detected_lon = ip_data.get("longitude")
                raw_region = ip_data.get("region", "")
                city = ip_data.get("city", "")
                display_name = f"{city}, {raw_region}, India" if city else raw_region
                if raw_region:
                    norm_raw = STATE_ALIASES.get(raw_region.lower().strip(), raw_region.lower().strip())
                    for s in valid_states:
                        if s["state"].lower() == norm_raw:
                            detected_state = s["state"]
                            break
        except Exception as e:
            print(f"IP Geolocation fallback failed: {e}")

    # If we have coordinates, query Nominatim for exact state & district
    if detected_lat is not None and detected_lon is not None:
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={detected_lat}&lon={detected_lon}&zoom=10&addressdetails=1"
            req = urllib.request.Request(url, headers={"User-Agent": "SchemeSaathi-Locator/1.0"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                addr = data.get("address", {})
                raw_state = addr.get("state", "")
                raw_district = (
                    addr.get("state_district")
                    or addr.get("county")
                    or addr.get("district")
                    or addr.get("city")
                    or addr.get("town")
                    or ""
                )
                city = addr.get("city") or addr.get("town") or addr.get("suburb") or city
                display_name = data.get("display_name", display_name)

                if raw_state:
                    norm_raw = STATE_ALIASES.get(raw_state.strip().lower(), raw_state.strip().lower())
                    for s in valid_states:
                        s_norm = STATE_ALIASES.get(s["state"].strip().lower(), s["state"].strip().lower())
                        if s_norm == norm_raw or norm_raw in s_norm or s_norm in norm_raw:
                            detected_state = s["state"]
                            # Match district
                            if raw_district:
                                raw_dist_clean = (
                                    raw_district.lower().replace("district", "").replace("division", "").strip()
                                )
                                for d in s["districts"]:
                                    d_clean = d.lower()
                                    if (
                                        d_clean == raw_dist_clean
                                        or raw_dist_clean in d_clean
                                        or d_clean in raw_dist_clean
                                    ):
                                        detected_district = d
                                        break
                            break
        except Exception as e:
            print(f"Nominatim reverse lookup failed: {e}")

    # Fallback to closest partner in channel_partners.json if state not resolved
    if not detected_state and detected_lat is not None and detected_lon is not None:
        try:
            partners_file = Path(__file__).resolve().parent.parent / "data" / "channel_partners.json"
            if partners_file.exists():
                with open(partners_file, "r", encoding="utf-8") as f:
                    partners_data = json.load(f).get("partners", [])
                closest = None
                min_dist = float("inf")
                for p in partners_data:
                    plat = p.get("latitude")
                    plon = p.get("longitude")
                    pstate = p.get("state")
                    if plat and plon and pstate and pstate.lower() not in ("all india", "national"):
                        d = _haversine_km(detected_lat, detected_lon, plat, plon)
                        if d < min_dist:
                            min_dist = d
                            closest = p
                if closest:
                    detected_state = closest.get("state", "")
                    detected_district = closest.get("district", "")
                    if detected_district == "All Districts":
                        detected_district = ""
        except Exception as e:
            print(f"Partner distance fallback failed: {e}")

    return {
        "status": "success",
        "state": detected_state,
        "district": detected_district,
        "city": city,
        "latitude": detected_lat,
        "longitude": detected_lon,
        "display_name": display_name,
    }


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

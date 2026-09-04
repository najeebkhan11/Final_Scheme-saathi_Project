import asyncio
from fastapi import (
    APIRouter,
    HTTPException,
)

from pydantic import (
    BaseModel,
)

from typing import Optional

from services.channel_partner_locator import (
    find_channel_partners,
    get_partner_by_id,
)
from services.ai_partner_ranker import rank_partners_with_ai

router = APIRouter(
    prefix="/api/partners",
    tags=["Channel Partners"],
)


class PartnerSearchRequest(
    BaseModel
):
    state: Optional[str] = None
    district: Optional[str] = None
    scheme_id: Optional[str] = None
    loan_category: Optional[str] = None
    max_results: int = 10
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    ai_rank: Optional[bool] = True


@router.post("/search")
async def search_partners(
    request: PartnerSearchRequest,
):
    try:
        result = find_channel_partners(
            state=request.state,
            district=request.district,
            scheme_id=request.scheme_id,
            loan_category=request.loan_category,
            max_results=request.max_results,
            user_lat=request.latitude,
            user_lon=request.longitude,
        )

        # AI Ranking enhancement when partners are found
        if request.ai_rank and result.get("partners"):
            try:
                ranked = await asyncio.to_thread(
                    rank_partners_with_ai,
                    result["partners"],
                    user_state=request.state,
                    user_district=request.district,
                    loan_category=request.loan_category,
                    scheme_id=request.scheme_id,
                )
                if ranked:
                    result["partners"] = ranked
                    result["ai_ranked"] = True
            except Exception as rank_err:
                print(f"AI ranking fallback: {rank_err}")

        return result

    except Exception as error:
        print(
            "Partner Locator Error:",
            error
        )
        raise HTTPException(
            status_code=500,
            detail=(
                f"Partner search failed: {str(error)}"
            ),
        )


@router.get("/{partner_id}")
def get_partner(partner_id: str):
    """Get a specific partner by ID."""
    partner = get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {
        "status": "success",
        "partner": partner,
    }
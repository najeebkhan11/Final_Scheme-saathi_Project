from pydantic import BaseModel, Field
from typing import Optional


class AIAssistantRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    language: Optional[str] = Field(default=None, max_length=10)
    scheme_context: Optional[dict] = Field(default=None)
    emi_output: Optional[dict] = Field(default=None)
    partner_output: Optional[dict] = Field(default=None)
    ineligibility_query: Optional[dict] = Field(default=None)
    coordinates: Optional[dict] = Field(default=None)
    location: Optional[dict] = Field(default=None)


class AIAssistantResponse(BaseModel):
    reply: str
    language_used: str
    language_detected: bool
    primary_recommendation: Optional[dict] = None
    other_eligible_schemes: Optional[list[dict]] = None
    emi_projection: Optional[dict] = None
    matched_channel_partners: Optional[list[dict]] = None
    application_guidance: Optional[dict] = None
    ineligibility_explanations: Optional[list[dict]] = None
    out_of_scope_schemes: Optional[list[dict]] = None
    secondary_support: Optional[list[dict]] = None
    disclaimer: str = ""

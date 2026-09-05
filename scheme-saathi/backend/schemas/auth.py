from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    identifier: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

import re
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status

from database.database import get_db
from schemas.auth import SignupRequest, LoginRequest, TokenResponse
from schemas.user import UserProfileRequest
from services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

INDIAN_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def _validate_indian_phone(phone: str) -> str:
    """Validate and normalize a 10-digit Indian mobile number.

    Accepts exactly 10 digits starting with 6, 7, 8, or 9.
    Rejects +91 or 91 prefixes.
    Returns the stripped phone string on success.
    """
    cleaned = phone.strip()
    if not INDIAN_PHONE_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid 10 digit Indian number.",
        )
    return cleaned


# ──────────────────────────────────────────────
# Signup (requires valid Indian mobile number)
# ──────────────────────────────────────────────


@router.post("/signup", response_model=TokenResponse)
def signup(request: SignupRequest):
    identifier = request.identifier.strip()
    name = request.name.strip()
    password = request.password

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full Name cannot be empty.",
        )
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required.",
        )
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    # Validate Indian phone number format
    _validate_indian_phone(identifier)

    hashed_pw = hash_password(password)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM users WHERE lower(identifier) = ?",
            (identifier,),
        )
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this mobile number already exists. Please sign in.",
            )

        cursor.execute(
            "INSERT INTO users (name, identifier, password_hash) VALUES (?, ?, ?)",
            (name, identifier, hashed_pw),
        )
        user_id = cursor.lastrowid

    # Automatically sync new registered citizen to Excel in D:\Project-SIH\Admin_Data
    try:
        from services.excel_exporter import export_profiles_to_excel
        export_profiles_to_excel()
    except Exception:
        pass

    token = create_access_token(user_id=user_id, identifier=identifier)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": name,
            "identifier": identifier,
        },
    }


# ──────────────────────────────────────────────
# Login (password only)
# ──────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):
    identifier = request.identifier.strip()
    password = request.password

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide both mobile number and password.",
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, identifier, password_hash FROM users WHERE lower(identifier) = ?",
            (identifier,),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid mobile number or password. Please verify your credentials or create an account.",
            )

        if not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid mobile number or password. Please verify your credentials.",
            )

        user_id = user["id"]
        user_name = user["name"]
        user_identifier = user["identifier"]

    token = create_access_token(user_id=user_id, identifier=user_identifier)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user_name,
            "identifier": user_identifier,
        },
    }


# ──────────────────────────────────────────────
# Profile endpoints (unchanged)
# ──────────────────────────────────────────────


@router.get("/me")
def me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "success",
        "user": current_user,
    }


@router.post("/profile")
def save_profile(
    profile_data: UserProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    data = profile_data.model_dump()

    with get_db() as conn:
        cursor = conn.cursor()

        # If name is provided and changed, update users table
        if data.get("name"):
            cursor.execute(
                "UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (data["name"].strip(), user_id),
            )

        cursor.execute("SELECT id FROM user_profiles WHERE user_id = ?", (user_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE user_profiles
                SET age = ?, gender = ?, category = ?, state = ?, district = ?,
                    annual_income = ?, purpose = ?, business_type = ?, project_stage = ?,
                    project_cost = ?, required_loan = ?, course = ?, institution = ?,
                    course_fee = ?, education_level = ?, own_contribution = ?,
                    existing_loan = ?, outstanding_amount = ?, overdue = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (
                    data.get("age"),
                    data.get("gender"),
                    data.get("category"),
                    data.get("state"),
                    data.get("district"),
                    data.get("annual_income"),
                    data.get("purpose"),
                    data.get("business_type"),
                    data.get("project_stage"),
                    data.get("project_cost"),
                    data.get("required_loan"),
                    data.get("course"),
                    data.get("institution"),
                    data.get("course_fee"),
                    data.get("education_level"),
                    data.get("own_contribution"),
                    data.get("existing_loan"),
                    data.get("outstanding_amount"),
                    data.get("overdue"),
                    user_id,
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO user_profiles (
                    user_id, age, gender, category, state, district,
                    annual_income, purpose, business_type, project_stage,
                    project_cost, required_loan, course, institution,
                    course_fee, education_level, own_contribution,
                    existing_loan, outstanding_amount, overdue
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    data.get("age"),
                    data.get("gender"),
                    data.get("category"),
                    data.get("state"),
                    data.get("district"),
                    data.get("annual_income"),
                    data.get("purpose"),
                    data.get("business_type"),
                    data.get("project_stage"),
                    data.get("project_cost"),
                    data.get("required_loan"),
                    data.get("course"),
                    data.get("institution"),
                    data.get("course_fee"),
                    data.get("education_level"),
                    data.get("own_contribution"),
                    data.get("existing_loan"),
                    data.get("outstanding_amount"),
                    data.get("overdue"),
                ),
            )

    # Automatically sync updated profile to Excel in D:\Project-SIH\Admin_Data
    try:
        from services.excel_exporter import export_profiles_to_excel
        export_profiles_to_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": "User profile saved successfully",
    }


@router.get("/profile")
def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return {
                "status": "success",
                "profile": None,
                "user": {
                    "id": current_user["id"],
                    "name": current_user["name"],
                    "identifier": current_user["identifier"],
                },
            }
        p = dict(row)
        # Attach frontend-friendly camelCase fields
        p["fullName"] = current_user.get("name", "")
        p["annualIncome"] = str(p["annual_income"]) if p.get("annual_income") is not None else ""
        p["businessType"] = p.get("business_type") or ""
        p["projectStage"] = p.get("project_stage") or ""
        p["projectCost"] = str(p["project_cost"]) if p.get("project_cost") is not None else ""
        p["requiredLoan"] = str(p["required_loan"]) if p.get("required_loan") is not None else ""
        p["courseFee"] = str(p["course_fee"]) if p.get("course_fee") is not None else ""
        p["educationLevel"] = p.get("education_level") or ""
        p["ownContribution"] = str(p["own_contribution"]) if p.get("own_contribution") is not None else ""
        p["existingLoan"] = p.get("existing_loan") or ""
        p["outstandingAmount"] = str(p["outstanding_amount"]) if p.get("outstanding_amount") is not None else ""
        p["overdue"] = p.get("overdue") or ""

        return {
            "status": "success",
            "profile": p,
            "user": {
                "id": current_user["id"],
                "name": current_user["name"],
                "identifier": current_user["identifier"],
            },
        }

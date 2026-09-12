import re
import json
import random
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field

from database.database import get_db
from services.auth import get_current_user

router = APIRouter(
    prefix="/api/applications",
    tags=["Applications"],
)


# ---------------------------------------------------------------------------
# NOTE: All sample/demo applications are now seeded directly in database.py
# on first boot. No hardcoded dicts here — everything comes from SQLite.
# ---------------------------------------------------------------------------


class ApplicationSubmitRequest(BaseModel):
    scheme_id: str
    scheme_name: str
    scheme_type: Optional[str] = "PRIMARY"
    authority: Optional[str] = "National Scheduled Castes Finance and Development Corporation (NSFDC)"
    applicant_name: Optional[str] = None
    mobile: Optional[str] = None
    loan_amount: Optional[str] = None
    purpose: Optional[str] = None
    channel_partner: Optional[Dict[str, Any]] = None


class ApplicationSearchRequest(BaseModel):
    application_id: Optional[str] = None
    mobile: Optional[str] = None
    applicant_name: Optional[str] = None


def generate_timeline(submission_dt: datetime, scheme_name: str, app_id: str) -> list[dict]:
    d0 = submission_dt.strftime("%d %b %Y, %I:%M %p")
    d1 = (submission_dt + timedelta(days=2)).strftime("Expected: %d %b %Y")
    d2 = (submission_dt + timedelta(days=6)).strftime("Expected: %d %b %Y")
    d3 = (submission_dt + timedelta(days=10)).strftime("Expected: %d %b %Y")
    d4 = (submission_dt + timedelta(days=14)).strftime("Expected: %d %b %Y")

    return [
        {
            "stage_index": 0,
            "title": "Application Submitted",
            "subtitle": "Online Submission via Scheme Saathi",
            "date": d0,
            "status": "COMPLETED",
            "remarks": f"Application for {scheme_name} successfully recorded under Reference #{app_id}."
        },
        {
            "stage_index": 1,
            "title": "Document Verification",
            "subtitle": "District Scrutiny Cell",
            "date": d1,
            "status": "IN_PROGRESS",
            "remarks": "Digital KYC, category, and eligibility criteria verification in progress."
        },
        {
            "stage_index": 2,
            "title": "SCA / Channel Partner Review",
            "subtitle": "State Channelizing Agency Committee",
            "date": d2,
            "status": "PENDING",
            "remarks": "Quota allocation appraisal by nominated Channel Partner."
        },
        {
            "stage_index": 3,
            "title": "Bank Credit Appraisal & Sanction",
            "subtitle": "Lending Branch Partner",
            "date": d3,
            "status": "PENDING",
            "remarks": "Credit agreement execution and sanction letter issuance."
        },
        {
            "stage_index": 4,
            "title": "Disbursement & DBT Credit",
            "subtitle": "Direct Benefit Transfer",
            "date": d4,
            "status": "PENDING",
            "remarks": "Subsidized loan credit directly to Aadhaar-linked bank account."
        }
    ]


def row_to_application_dict(row: dict) -> dict[str, Any]:
    partner = None
    if row.get("channel_partner_json"):
        try:
            partner = json.loads(row["channel_partner_json"])
        except Exception:
            partner = None

    timeline = []
    if row.get("timeline_json"):
        try:
            timeline = json.loads(row["timeline_json"])
        except Exception:
            timeline = []

    mobile = row.get("mobile", "")
    masked = "XXXXXX" + mobile[-4:] if len(mobile) >= 4 else "XXXXXX0000"

    return {
        "application_id": row["application_id"],
        "applicant_name": row["applicant_name"],
        "mobile_masked": masked,
        "scheme_id": row["scheme_id"],
        "scheme_name": row["scheme_name"],
        "scheme_type": row.get("scheme_type") or "PRIMARY",
        "authority": row.get("authority") or "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": row.get("loan_amount") or "₹ 1,50,000",
        "purpose": row.get("purpose") or "Self Employment Requirement",
        "submission_date": row.get("submission_date"),
        "last_updated": row.get("last_updated"),
        "estimated_completion": row.get("estimated_completion"),
        "current_stage_index": row.get("current_stage_index", 0),
        "status_code": row.get("status_code", "IN_PROGRESS"),
        "status_label": row.get("status_label", "Application Submitted"),
        "status_color": row.get("status_color", "blue"),
        "channel_partner": partner or {
            "name": "State Channelizing Agency (SCA)",
            "district": "Lead District Branch",
            "state": "State Division",
            "office_address": "Vikas Bhawan Complex",
            "officer_in_charge": "District Nodal Officer",
            "contact_phone": "1800-180-5566",
            "helpline": "1800-180-6000"
        },
        "action_required": row.get("action_required"),
        "official_note": row.get("official_note") or "Your application is under scrutiny by the designated Channel Partner.",
        "timeline": timeline,
    }


@router.post("/submit")
def submit_application(
    request: ApplicationSubmitRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = None
    applicant_name = request.applicant_name or "Applicant"
    mobile = request.mobile or "9876543210"

    # If Authorization token provided, extract user from DB
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            from jose import jwt
            from services.auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT name, identifier FROM users WHERE id = ?", (user_id,))
                    user_row = cursor.fetchone()
                    if user_row:
                        if not request.applicant_name or request.applicant_name == "Applicant":
                            applicant_name = user_row["name"]
                        if not request.mobile or request.mobile == "9876543210":
                            mobile = user_row["identifier"]
        except Exception:
            pass

    # Ensure user is registered in users & user_profiles table so they appear in Author Desk
    with get_db() as conn:
        cursor = conn.cursor()
        if not user_id and mobile:
            cursor.execute("SELECT id, name FROM users WHERE identifier = ?", (mobile,))
            existing_user = cursor.fetchone()
            if existing_user:
                user_id = existing_user["id"]
                if not applicant_name or applicant_name == "Applicant":
                    applicant_name = existing_user["name"]
            else:
                cursor.execute(
                    "INSERT INTO users (name, identifier, password_hash) VALUES (?, ?, 'auto_citizen')",
                    (applicant_name, mobile),
                )
                user_id = cursor.lastrowid

        # Ensure user_profiles has a record for this user
        if user_id:
            cursor.execute("SELECT id FROM user_profiles WHERE user_id = ?", (user_id,))
            p_row = cursor.fetchone()
            if not p_row:
                try:
                    cursor.execute(
                        """
                        INSERT INTO user_profiles (
                            user_id, category, purpose, required_loan, created_at, updated_at
                        ) VALUES (?, 'SC', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                        (user_id, request.purpose or "Income Generating Activity", 150000.0),
                    )
                except Exception:
                    pass

    # Generate unique ID
    clean_scheme = re.sub(r"[^A-Z0-9]", "", request.scheme_id.upper())[:4] or "SCH"
    rand_num = random.randint(1000, 9999)
    app_id = f"SS-2026-{clean_scheme}-{rand_num}"

    now = datetime.now()
    submission_date = now.strftime("%Y-%m-%d")
    last_updated = now.strftime("%Y-%m-%d")
    est_date = (now + timedelta(days=14)).strftime("%Y-%m-%d")

    timeline = generate_timeline(now, request.scheme_name, app_id)
    timeline_json = json.dumps(timeline)
    partner_json = json.dumps(request.channel_partner) if request.channel_partner else None

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO user_applications (
                application_id, user_id, applicant_name, mobile,
                scheme_id, scheme_name, scheme_type, authority,
                loan_amount, purpose, submission_date, last_updated,
                estimated_completion, current_stage_index, status_code,
                status_label, status_color, channel_partner_json,
                official_note, action_required, timeline_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                app_id,
                user_id,
                applicant_name,
                mobile,
                request.scheme_id,
                request.scheme_name,
                request.scheme_type or "PRIMARY",
                request.authority or "National Scheduled Castes Finance and Development Corporation (NSFDC)",
                request.loan_amount or "₹ 1,50,000",
                request.purpose or "Income Generating Activity",
                submission_date,
                last_updated,
                est_date,
                0,
                "IN_PROGRESS",
                "Application Submitted - Under Scrutiny",
                "blue",
                partner_json,
                f"Application registered successfully under #{app_id}. Initial document verification in progress.",
                None,
                timeline_json,
            ),
        )

    # Return constructed application
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_applications WHERE application_id = ?", (app_id,))
        row = cursor.fetchone()
        app_dict = row_to_application_dict(dict(row))

    # Automatically sync new submission into Excel workbook
    try:
        from services.excel_exporter import sync_all_admin_excel
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Application submitted successfully and saved to database",
        "application_id": app_id,
        "application": app_dict,
    }


@router.get("/my-applications")
def get_my_applications(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["id"]
    identifier = current_user.get("identifier", "")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM user_applications
            WHERE user_id = ? OR mobile = ?
            ORDER BY created_at DESC
            """,
            (user_id, identifier),
        )
        rows = cursor.fetchall()
        apps = [row_to_application_dict(dict(r)) for r in rows]

    return {
        "status": "success",
        "count": len(apps),
        "applications": apps,
    }


@router.get("/track/{application_id}")
def track_application(application_id: str):
    """
    Track an application by its Application ID or a registered mobile number.
    Only returns real data from the database — no fake auto-generation.
    """
    app_id = application_id.strip()
    if not app_id:
        raise HTTPException(status_code=400, detail="Application ID cannot be empty.")

    digits = re.sub(r"\D", "", app_id)
    last10 = digits[-10:] if len(digits) >= 10 else digits

    with get_db() as conn:
        cursor = conn.cursor()

        # --- Search by Application ID or mobile number ---
        if len(digits) >= 10:
            # Could be a mobile number — search by mobile too
            cursor.execute(
                """
                SELECT * FROM user_applications
                WHERE lower(application_id) = lower(?)
                   OR mobile = ?
                   OR mobile LIKE ?
                ORDER BY created_at DESC LIMIT 1
                """,
                (app_id, app_id, f"%{last10}%"),
            )
        else:
            # Treat as application ID or partial name
            cursor.execute(
                """
                SELECT * FROM user_applications
                WHERE lower(application_id) = lower(?)
                   OR lower(applicant_name) = lower(?)
                   OR mobile = ?
                ORDER BY created_at DESC LIMIT 1
                """,
                (app_id, app_id, app_id),
            )

        row = cursor.fetchone()
        if row:
            return {
                "status": "success",
                "found": True,
                "source": "database",
                "application": row_to_application_dict(dict(row)),
            }

    # Nothing found — return a clear 404
    raise HTTPException(
        status_code=404,
        detail=f"No application found for '{app_id}'. Please check your Application ID or registered mobile number."
    )


@router.post("/search")
def search_applications(req: ApplicationSearchRequest):
    """
    Search applications by Application ID, mobile number, or applicant name.
    Returns real database records only.
    """
    app_id = (req.application_id or "").strip()
    mobile = (req.mobile or "").strip()
    name = (req.applicant_name or "").strip()

    if not app_id and not mobile and not name:
        raise HTTPException(
            status_code=400,
            detail="Please provide an Application ID, Mobile Number, or Applicant Name."
        )

    digits = re.sub(r"\D", "", mobile or app_id)
    last10 = digits[-10:] if len(digits) >= 10 else digits

    with get_db() as conn:
        cursor = conn.cursor()
        clauses = []
        params = []

        if app_id:
            clauses.append("lower(application_id) = lower(?)")
            params.append(app_id)
        if mobile:
            clauses.append("(mobile = ? OR mobile LIKE ?)")
            params.extend([mobile, f"%{last10}%"])
        if name:
            clauses.append("lower(applicant_name) LIKE lower(?)")
            params.append(f"%{name}%")

        if clauses:
            query = f"SELECT * FROM user_applications WHERE {' OR '.join(clauses)} ORDER BY created_at DESC LIMIT 1"
            cursor.execute(query, params)
            row = cursor.fetchone()
            if row:
                return {
                    "status": "success",
                    "found": True,
                    "source": "database",
                    "application": row_to_application_dict(dict(row)),
                }

    raise HTTPException(
        status_code=404,
        detail="No application found matching the entered details. Please check your Application ID, mobile number, or name."
    )

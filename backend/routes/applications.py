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

SAMPLE_APPLICATIONS: dict[str, dict[str, Any]] = {
    "SS-2026-MFS-8492": {
        "application_id": "SS-2026-MFS-8492",
        "applicant_name": "Ramesh Chandra",
        "mobile_masked": "XXXXXX4219",
        "scheme_id": "MFS",
        "scheme_name": "Micro Finance Scheme (MFS)",
        "scheme_type": "PRIMARY",
        "authority": "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": "Rs 1,40,000",
        "purpose": "Small Retail Kirana Store Expansion",
        "submission_date": "2026-08-18",
        "last_updated": "2026-09-02",
        "estimated_completion": "2026-09-15",
        "current_stage_index": 1,
        "status_code": "IN_PROGRESS",
        "status_label": "Under Document Verification",
        "status_color": "blue",
        "channel_partner": {
            "name": "State Scheduled Castes Development Corporation (SCDC)",
            "district": "Lucknow",
            "state": "Uttar Pradesh",
            "office_address": "Vikas Bhawan, 2nd Floor, Civil Lines, Lucknow - 226001",
            "officer_in_charge": "Shri S. K. Verma (District Manager)",
            "contact_phone": "+91 522-2239871",
            "helpline": "1800-180-5566"
        },
        "action_required": None,
        "official_note": "Your digital KYC and Caste certificate have been verified. Field verification by the district officer is scheduled between 05 Sep and 08 Sep 2026.",
        "timeline": [
            {
                "stage_index": 0,
                "title": "Application Submitted",
                "subtitle": "Online Submission via Scheme Saathi",
                "date": "18 Aug 2026, 11:30 AM",
                "status": "COMPLETED",
                "remarks": "Application form and primary documents successfully registered under Ref #SS-2026-MFS-8492."
            },
            {
                "stage_index": 1,
                "title": "Document Verification",
                "subtitle": "District Scrutiny Cell",
                "date": "25 Aug 2026, 04:15 PM",
                "status": "IN_PROGRESS",
                "remarks": "Aadhaar and Caste certificates validated via DigiLocker. Physical scrutiny of premises pending."
            },
            {
                "stage_index": 2,
                "title": "SCA / Channel Partner Review",
                "subtitle": "State Channelizing Agency Committee",
                "date": "Expected: 08 Sep 2026",
                "status": "PENDING",
                "remarks": "Quotas and fund allocation appraisal by State Channelizing Agency."
            },
            {
                "stage_index": 3,
                "title": "Bank Credit Appraisal & Sanction",
                "subtitle": "Lending Branch Partner",
                "date": "Expected: 12 Sep 2026",
                "status": "PENDING",
                "remarks": "Credit agreement execution and sanction letter issuance."
            },
            {
                "stage_index": 4,
                "title": "Disbursement & DBT Credit",
                "subtitle": "Direct Benefit Transfer",
                "date": "Expected: 15 Sep 2026",
                "status": "PENDING",
                "remarks": "Loan credit directly to Aadhaar-linked bank account."
            }
        ]
    },
    "SS-2026-ELS-3104": {
        "application_id": "SS-2026-ELS-3104",
        "applicant_name": "Pooja Kumari",
        "mobile_masked": "XXXXXX8832",
        "scheme_id": "ELS",
        "scheme_name": "Educational Loan Scheme (ELS)",
        "scheme_type": "PRIMARY",
        "authority": "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": "Rs 7,50,000",
        "purpose": "B.Tech Computer Science & Engineering (4-Year Degree)",
        "submission_date": "2026-07-10",
        "last_updated": "2026-09-01",
        "estimated_completion": "2026-09-08",
        "current_stage_index": 3,
        "status_code": "APPROVED",
        "status_label": "Loan Sanctioned - Ready for Disbursement",
        "status_color": "emerald",
        "channel_partner": {
            "name": "Punjab National Bank - Special MSME/Govt Scheme Branch",
            "district": "Patna",
            "state": "Bihar",
            "office_address": "PNB House, Exhibition Road, Patna - 800001",
            "officer_in_charge": "Ms. Sunita Roy (Chief Credit Officer)",
            "contact_phone": "+91 612-2589012",
            "helpline": "1800-180-2222"
        },
        "action_required": "Please visit the branch by 06 Sep 2026 with your admission letter original and bank passbook to sign the subsidy agreement.",
        "official_note": "Sanction letter #ELS-2026-9812 has been issued. Subsidized interest rate at 4.0% p.a. approved for the study tenure.",
        "timeline": [
            {
                "stage_index": 0,
                "title": "Application Submitted",
                "subtitle": "Online Submission via Scheme Saathi",
                "date": "10 Jul 2026, 02:40 PM",
                "status": "COMPLETED",
                "remarks": "Educational loan request submitted with Institute Bonafide Certificate."
            },
            {
                "stage_index": 1,
                "title": "Document Verification",
                "subtitle": "State Nodal Cell",
                "date": "24 Jul 2026, 10:00 AM",
                "status": "COMPLETED",
                "remarks": "Fee structure, marksheet, and income certificate verified and approved."
            },
            {
                "stage_index": 2,
                "title": "SCA / Channel Partner Review",
                "subtitle": "Bihar State SC/ST Finance Development Corp",
                "date": "14 Aug 2026, 03:20 PM",
                "status": "COMPLETED",
                "remarks": "Candidate recommended for full tuition & hostel fee loan subsidy."
            },
            {
                "stage_index": 3,
                "title": "Bank Credit Appraisal & Sanction",
                "subtitle": "PNB Exhibition Road Branch",
                "date": "01 Sep 2026, 11:15 AM",
                "status": "COMPLETED",
                "remarks": "Sanction Order #ELS-2026-9812 generated. 1st installment ready for transfer to college."
            },
            {
                "stage_index": 4,
                "title": "Disbursement & DBT Credit",
                "subtitle": "Direct College Account Transfer",
                "date": "Scheduled: 08 Sep 2026",
                "status": "IN_PROGRESS",
                "remarks": "Awaiting beneficiary agreement signature."
            }
        ]
    },
    "SS-2026-TL-5521": {
        "application_id": "SS-2026-TL-5521",
        "applicant_name": "Manoj Meghwal",
        "mobile_masked": "XXXXXX1904",
        "scheme_id": "TERM_LOAN",
        "scheme_name": "Term Loan (TL)",
        "scheme_type": "PRIMARY",
        "authority": "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": "Rs 12,00,000",
        "purpose": "Food Processing & Packaging Unit",
        "submission_date": "2026-08-05",
        "last_updated": "2026-09-03",
        "estimated_completion": "2026-09-22",
        "current_stage_index": 1,
        "status_code": "ACTION_REQUIRED",
        "status_label": "Action Required - Document Clarification",
        "status_color": "amber",
        "channel_partner": {
            "name": "Rajasthan SC/ST Finance and Development Co-op Corp (Anusuchit Jati Nigam)",
            "district": "Jaipur",
            "state": "Rajasthan",
            "office_address": "Nehru Sahkar Bhawan, 4th Floor, Tonk Road, Jaipur - 302015",
            "officer_in_charge": "Dr. R. P. Sharma (District Project Officer)",
            "contact_phone": "+91 141-2740921",
            "helpline": "1800-180-6127"
        },
        "action_required": "Please provide an updated Family Income Certificate for FY 2026-27 issued by Tehsildar. The current document uploaded has expired.",
        "official_note": "Scrutiny committee found that the annual income certificate submitted was issued in 2024. As per NSFDC policy, income certificate must be valid within the past 12 months.",
        "timeline": [
            {
                "stage_index": 0,
                "title": "Application Submitted",
                "subtitle": "Online Submission via Scheme Saathi",
                "date": "05 Aug 2026, 09:12 AM",
                "status": "COMPLETED",
                "remarks": "Project report and application for Rs 12 Lakhs submitted."
            },
            {
                "stage_index": 1,
                "title": "Document Verification",
                "subtitle": "Jaipur District Scrutiny Committee",
                "date": "03 Sep 2026, 02:45 PM",
                "status": "ACTION_REQUIRED",
                "remarks": "Deficiency raised: Valid income proof required within 7 days."
            },
            {
                "stage_index": 2,
                "title": "SCA / Channel Partner Review",
                "subtitle": "State Appraisal Board",
                "date": "On Hold",
                "status": "PENDING",
                "remarks": "Will proceed immediately upon resolution of document query."
            },
            {
                "stage_index": 3,
                "title": "Bank Credit Appraisal & Sanction",
                "subtitle": "Lead District Bank",
                "date": "Pending",
                "status": "PENDING",
                "remarks": "Evaluation of machinery quotation and margin money."
            },
            {
                "stage_index": 4,
                "title": "Disbursement & DBT Credit",
                "subtitle": "Direct Supplier & Beneficiary Credit",
                "date": "Pending",
                "status": "PENDING",
                "remarks": "Post-sanction disbursement."
            }
        ]
    }
}


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


def build_dynamic_application(app_id: str) -> dict[str, Any]:
    cleaned = app_id.strip().upper()
    today = datetime.now()
    sub_date = (today - timedelta(days=6)).strftime("%Y-%m-%d")
    update_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    est_date = (today + timedelta(days=10)).strftime("%Y-%m-%d")

    return {
        "application_id": cleaned,
        "applicant_name": "Registered Citizen",
        "mobile_masked": "XXXXXX" + ("8891" if len(cleaned) < 4 else cleaned[-4:]),
        "scheme_id": "MFS",
        "scheme_name": "NSFDC Credit Assistance Scheme",
        "scheme_type": "PRIMARY",
        "authority": "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": "Rs 1,50,000",
        "purpose": "Self Employment Project",
        "submission_date": sub_date,
        "last_updated": update_date,
        "estimated_completion": est_date,
        "current_stage_index": 1,
        "status_code": "IN_PROGRESS",
        "status_label": "Application Received & Under Verification",
        "status_color": "blue",
        "channel_partner": {
            "name": "State Channelizing Agency (SCA) District Office",
            "district": "Lead District Center",
            "state": "State Division",
            "office_address": "District Collectorate Complex, Administrative Wing",
            "officer_in_charge": "District Nodal Officer",
            "contact_phone": "1800-200-5566",
            "helpline": "1800-180-6000"
        },
        "action_required": "Keep your original Aadhaar and Caste certificates ready for the verification visit.",
        "official_note": f"Application {cleaned} is recorded in the National Beneficiary Registry. District scrutiny is currently in progress.",
        "timeline": [
            {
                "stage_index": 0,
                "title": "Application Submitted",
                "subtitle": "Scheme Saathi Application Portal",
                "date": f"{sub_date}, 10:00 AM",
                "status": "COMPLETED",
                "remarks": f"Application {cleaned} successfully registered."
            },
            {
                "stage_index": 1,
                "title": "Document Verification",
                "subtitle": "District Scrutiny Cell",
                "date": f"{update_date}, 02:30 PM",
                "status": "IN_PROGRESS",
                "remarks": "KYC scrutiny and eligibility criteria matching underway."
            },
            {
                "stage_index": 2,
                "title": "SCA / Channel Partner Review",
                "subtitle": "State Channelizing Agency Committee",
                "date": f"Expected: {(today + timedelta(days=4)).strftime('%d %b %Y')}",
                "status": "PENDING",
                "remarks": "Review by district task force committee."
            },
            {
                "stage_index": 3,
                "title": "Bank Credit Appraisal & Sanction",
                "subtitle": "Nominated Public Sector Bank",
                "date": f"Expected: {(today + timedelta(days=7)).strftime('%d %b %Y')}",
                "status": "PENDING",
                "remarks": "Sanction letter generation and terms communication."
            },
            {
                "stage_index": 4,
                "title": "Disbursement & DBT Credit",
                "subtitle": "Direct Benefit Transfer",
                "date": f"Expected: {est_date}",
                "status": "PENDING",
                "remarks": "Disbursement directly to beneficiary account."
            }
        ]
    }


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
                        applicant_name = user_row["name"]
                        mobile = user_row["identifier"]
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

    # Automatically sync new submission into Excel workbook in D:\Project-SIH\Admin_Data
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


@router.get("/samples")
def get_sample_applications():
    samples = []
    for app_id, data in SAMPLE_APPLICATIONS.items():
        samples.append({
            "application_id": app_id,
            "applicant_name": data["applicant_name"],
            "scheme_name": data["scheme_name"],
            "status_label": data["status_label"],
            "status_code": data["status_code"],
            "status_color": data["status_color"],
            "loan_amount": data["loan_amount"]
        })
    return {"count": len(samples), "samples": samples}


@router.get("/track/{application_id}")
def track_application(application_id: str):
    app_id = application_id.strip()
    if not app_id:
        raise HTTPException(status_code=400, detail="Application ID cannot be empty.")

    digits = re.sub(r"\D", "", app_id)
    last10 = digits[-10:] if len(digits) >= 10 else digits

    # 1. Search in SQLite Database first
    with get_db() as conn:
        cursor = conn.cursor()
        if len(digits) >= 10:
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

    # 2. Check in Sample Applications dictionary if explicitly requested
    for sample_id, data in SAMPLE_APPLICATIONS.items():
        if sample_id.lower() == app_id.lower():
            return {"status": "success", "found": True, "source": "sample", "application": data}

    raise HTTPException(
        status_code=404,
        detail=f"No application found for '{app_id}'. Please verify your Application ID or registered mobile number."
    )


@router.post("/search")
def search_applications(req: ApplicationSearchRequest):
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

    if app_id:
        for s_id, s_data in SAMPLE_APPLICATIONS.items():
            if s_id.lower() == app_id.lower():
                return {"status": "success", "found": True, "source": "sample", "application": s_data}

    raise HTTPException(
        status_code=404,
        detail="No application found matching the entered details. Please check your information or submit an application through Scheme Finder."
    )

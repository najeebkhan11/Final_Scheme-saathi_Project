import re
from datetime import datetime, timedelta
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
    },
    "SS-2026-AMY-1980": {
        "application_id": "SS-2026-AMY-1980",
        "applicant_name": "Kavita Devi",
        "mobile_masked": "XXXXXX9012",
        "scheme_id": "AMY",
        "scheme_name": "Aajeevika Micro-Finance Yojana (AMY)",
        "scheme_type": "PRIMARY",
        "authority": "National Scheduled Castes Finance and Development Corporation (NSFDC)",
        "loan_amount": "Rs 50,000",
        "purpose": "Handicraft & Tailoring Equipment",
        "submission_date": "2026-08-28",
        "last_updated": "2026-09-02",
        "estimated_completion": "2026-09-12",
        "current_stage_index": 2,
        "status_code": "IN_PROGRESS",
        "status_label": "Under SCA / Partner Appraisal",
        "status_color": "blue",
        "channel_partner": {
            "name": "Mahila Arthik Vikas Mahamandal (MAVIM) / SCA",
            "district": "Pune",
            "state": "Maharashtra",
            "office_address": "Administrative Building, Swargate, Pune - 411042",
            "officer_in_charge": "Smt. Anita Patil (Cluster Coordinator)",
            "contact_phone": "+91 20-24441098",
            "helpline": "1800-222-014"
        },
        "action_required": None,
        "official_note": "Application recommended by Self-Help Group (SHG) cluster. Under fast-track micro-finance appraisal.",
        "timeline": [
            {
                "stage_index": 0,
                "title": "Application Submitted",
                "subtitle": "Fast-Track SHG Submission",
                "date": "28 Aug 2026, 10:15 AM",
                "status": "COMPLETED",
                "remarks": "Micro-finance application received with SHG peer endorsement."
            },
            {
                "stage_index": 1,
                "title": "Document Verification",
                "subtitle": "District Scrutiny Desk",
                "date": "30 Aug 2026, 03:00 PM",
                "status": "COMPLETED",
                "remarks": "Aadhaar e-KYC and SC category certificate verified."
            },
            {
                "stage_index": 2,
                "title": "SCA / Channel Partner Review",
                "subtitle": "MAVIM District Appraisal",
                "date": "02 Sep 2026, 01:20 PM",
                "status": "IN_PROGRESS",
                "remarks": "Under quota allotment for self-employment cluster."
            },
            {
                "stage_index": 3,
                "title": "Bank Credit Appraisal & Sanction",
                "subtitle": "Bank of Maharashtra (Nodal Branch)",
                "date": "Expected: 07 Sep 2026",
                "status": "PENDING",
                "remarks": "Digital sanction generation."
            },
            {
                "stage_index": 4,
                "title": "Disbursement & DBT Credit",
                "subtitle": "Direct DBT to Savings Account",
                "date": "Expected: 12 Sep 2026",
                "status": "PENDING",
                "remarks": "Account credit upon partner signoff."
            }
        ]
    }
}


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
    
    for sample_id, data in SAMPLE_APPLICATIONS.items():
        if sample_id.lower() == app_id.lower():
            return {"status": "success", "found": True, "application": data}
        
    digits = re.sub(r"\D", "", app_id)
    if len(digits) == 10:
        first = list(SAMPLE_APPLICATIONS.values())[0].copy()
        first["mobile_masked"] = f"XXXXXX{digits[-4:]}"
        return {"status": "success", "found": True, "application": first}

    dynamic_app = build_dynamic_application(app_id)
    return {"status": "success", "found": True, "application": dynamic_app}

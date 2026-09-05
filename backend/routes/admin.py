import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database.database import get_db
from routes.applications import row_to_application_dict
from services.excel_exporter import sync_all_admin_excel, ADMIN_DATA_DIR

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin & Author Desk"],
)

STAGE_META = [
    {
        "index": 0,
        "title": "Application Submitted",
        "default_label": "Application Submitted - Under Scrutiny",
        "default_code": "IN_PROGRESS",
        "default_note": "Application received and logged. Awaiting author verification to proceed to document scrutiny.",
    },
    {
        "index": 1,
        "title": "Document Verification",
        "default_label": "Under Document Verification",
        "default_code": "IN_PROGRESS",
        "default_note": "Author has authorized application for Document Verification. Scrutiny of KYC, category, and eligibility criteria in progress.",
    },
    {
        "index": 2,
        "title": "SCA / Channel Partner Review",
        "default_label": "SCA / Channel Partner Review",
        "default_code": "IN_PROGRESS",
        "default_note": "Documents verified by Scrutiny Cell. Forwarded to State Channelizing Agency (SCA) for quota allocation and endorsement.",
    },
    {
        "index": 3,
        "title": "Bank Credit Appraisal & Sanction",
        "default_label": "Bank Credit Appraisal & Sanction",
        "default_code": "IN_PROGRESS",
        "default_note": "SCA appraisal approved. Nominated Lending Bank is processing credit sanction order.",
    },
    {
        "index": 4,
        "title": "Disbursement & DBT Credit",
        "default_label": "Loan Sanctioned - Ready for Disbursement",
        "default_code": "APPROVED",
        "default_note": "Credit sanction granted. Direct Benefit Transfer (DBT) subsidy and loan amount scheduled for disbursement to beneficiary account.",
    },
]


class UpdateStageRequest(BaseModel):
    target_stage_index: int = Field(..., ge=0, le=4)
    status_code: Optional[str] = None
    status_label: Optional[str] = None
    official_note: Optional[str] = None
    action_required: Optional[str] = None


@router.get("/applications")
def get_all_applications(
    search: Optional[str] = Query(None),
    stage: Optional[int] = Query(None),
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM user_applications WHERE 1=1"
        params = []

        if stage is not None and stage >= 0:
            query += " AND current_stage_index = ?"
            params.append(stage)

        if search:
            term = f"%{search.strip().lower()}%"
            query += " AND (lower(application_id) LIKE ? OR lower(applicant_name) LIKE ? OR mobile LIKE ? OR lower(scheme_name) LIKE ?)"
            params.extend([term, term, term, term])

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        applications = [row_to_application_dict(dict(r)) for r in rows]

    return {
        "status": "success",
        "count": len(applications),
        "applications": applications,
        "excel_folder": str(ADMIN_DATA_DIR),
    }


@router.post("/applications/{application_id}/update-stage")
def update_application_stage(application_id: str, req: UpdateStageRequest):
    app_id = application_id.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found in database.")

        app_data = dict(row)
        target_idx = req.target_stage_index
        meta = STAGE_META[target_idx]

        status_code = req.status_code or meta["default_code"]
        status_label = req.status_label or meta["default_label"]
        official_note = req.official_note or meta["default_note"]
        action_req = req.action_required if req.action_required is not None else app_data.get("action_required")

        now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
        today_date = datetime.now().strftime("%Y-%m-%d")

        # Update Timeline JSON
        timeline = []
        if app_data.get("timeline_json"):
            try:
                timeline = json.loads(app_data["timeline_json"])
            except Exception:
                timeline = []

        # Ensure timeline has 5 standard entries
        if len(timeline) < 5:
            from routes.applications import generate_timeline
            timeline = generate_timeline(datetime.now(), app_data.get("scheme_name", "Scheme"), app_id)

        for idx, t_step in enumerate(timeline):
            if idx < target_idx:
                t_step["status"] = "COMPLETED"
            elif idx == target_idx:
                t_step["status"] = "COMPLETED" if (target_idx == 4 and status_code == "APPROVED") else "IN_PROGRESS"
                t_step["date"] = now_str
                if official_note:
                    t_step["remarks"] = official_note
            else:
                t_step["status"] = "PENDING"

        timeline_json = json.dumps(timeline)

        cursor.execute(
            """
            UPDATE user_applications
            SET current_stage_index = ?,
                status_code = ?,
                status_label = ?,
                official_note = ?,
                action_required = ?,
                timeline_json = ?,
                last_updated = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE lower(application_id) = lower(?)
            """,
            (
                target_idx,
                status_code,
                status_label,
                official_note,
                action_req,
                timeline_json,
                today_date,
                app_id,
            ),
        )

        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        updated_row = cursor.fetchone()
        updated_app = row_to_application_dict(dict(updated_row))

    # Auto-sync to Excel on disk
    try:
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Application {app_id} advanced to Stage {target_idx + 1}: {meta['title']}",
        "application": updated_app,
    }


@router.get("/users")
def get_all_users():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                u.id, u.name, u.identifier, u.created_at,
                p.category, p.state, p.district, p.annual_income, p.purpose, p.required_loan
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            ORDER BY u.created_at DESC
            """
        )
        rows = cursor.fetchall()
        users = [dict(r) for r in rows]

    return {"status": "success", "count": len(users), "users": users}


@router.post("/sync-excel")
def trigger_excel_sync():
    res = sync_all_admin_excel()
    return res


@router.get("/download-excel")
def download_applications_excel():
    excel_path = ADMIN_DATA_DIR / "User_Applications.xlsx"
    if not excel_path.exists():
        sync_all_admin_excel()

    if not excel_path.exists():
        raise HTTPException(status_code=404, detail="Excel file could not be generated.")

    return FileResponse(
        path=str(excel_path),
        filename="Scheme_Saathi_User_Applications.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

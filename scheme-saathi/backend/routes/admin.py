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


def _get_or_create_app(conn, app_id: str):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
    row = cursor.fetchone()
    if row:
        return row
    try:
        from routes.applications import generate_ai_application_dossier
        generate_ai_application_dossier(app_id)
        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        return cursor.fetchone()
    except Exception:
        return None


@router.post("/applications/{application_id}/update-stage")
def update_application_stage(application_id: str, req: UpdateStageRequest):
    app_id = application_id.strip()

    with get_db() as conn:
        row = _get_or_create_app(conn, app_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found in database.")

        cursor = conn.cursor()

        app_data = dict(row)
        target_idx = req.target_stage_index
        meta = STAGE_META[target_idx]

        status_code = req.status_code or meta["default_code"]
        status_label = req.status_label or meta["default_label"]
        official_note = req.official_note or meta["default_note"]
        action_req = req.action_required if req.action_required is not None else (
            None if target_idx > app_data.get("current_stage_index", 0) else app_data.get("action_required")
        )

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


class StageActionRequest(BaseModel):
    remarks: Optional[str] = None
    officer_name: Optional[str] = "District Verification Officer"
    sanction_amount: Optional[str] = None
    disbursement_ref: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.get("/applications/{application_id}/full-dossier")
def get_application_full_dossier(application_id: str):
    """
    Returns complete application dossier for Author Desk:
    - Application metadata and current stage
    - All provisioned documents with upload status & verification actions
    - Complete immutable audit trail
    - Stage transition eligibility summary
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()

        # Ensure documents exist
        from routes.documents import provision_application_documents
        provision_application_documents(conn, app_row["application_id"], app_row["scheme_id"], app_row["user_id"])
        conn.commit()

        # Documents list
        cursor.execute(
            "SELECT * FROM user_documents WHERE lower(application_id) = lower(?) ORDER BY required DESC, id ASC",
            (app_id,),
        )
        doc_rows = cursor.fetchall()

        # Audit logs list
        cursor.execute(
            "SELECT * FROM application_audit_logs WHERE lower(application_id) = lower(?) ORDER BY timestamp DESC, log_id DESC",
            (app_id,),
        )
        audit_rows = cursor.fetchall()

    docs = []
    total_required = 0
    verified_required = 0
    rejected_count = 0
    missing_count = 0
    under_verification_count = 0

    for r in doc_rows:
        d = dict(r)
        is_req = bool(d.get("required", 1))
        status = d.get("status") or "MISSING"

        if is_req:
            total_required += 1
            if status == "VERIFIED":
                verified_required += 1

        if status == "REJECTED":
            rejected_count += 1
        elif status == "MISSING":
            missing_count += 1
        elif status in ("UPLOADED", "UNDER_VERIFICATION"):
            under_verification_count += 1

        docs.append({
            "id": d["id"],
            "document_id": d["document_id"],
            "application_id": d["application_id"],
            "document_type": d["doc_type"],
            "document_name": d["doc_name"],
            "required": is_req,
            "status": status,
            "file_name": d.get("file_name"),
            "file_size": d.get("file_size"),
            "mime_type": d.get("mime_type"),
            "uploaded_at": str(d["uploaded_at"]) if d.get("uploaded_at") else None,
            "verified_at": str(d["verified_at"]) if d.get("verified_at") else None,
            "verified_by": d.get("verified_by"),
            "rejection_reason": d.get("rejection_reason"),
            "remarks": d.get("remarks"),
            "view_url": f"/api/documents/{d['document_id']}/file" if d.get("file_name") else None,
        })

    is_complete = total_required > 0 and (verified_required == total_required)

    audit_logs = [
        {
            "id": a["log_id"],
            "action": a["action"],
            "role": a["role"],
            "old_status": a["old_status"],
            "new_status": a["new_status"],
            "remarks": a["remarks"],
            "created_at": str(a["timestamp"]),
        }
        for a in audit_rows
    ]

    return {
        "status": "success",
        "application": row_to_application_dict(dict(app_row)),
        "document_summary": {
            "total_documents": len(docs),
            "total_required": total_required,
            "verified_required": verified_required,
            "rejected_count": rejected_count,
            "missing_count": missing_count,
            "under_verification_count": under_verification_count,
            "is_complete": is_complete,
            "can_proceed_to_sca": is_complete,
        },
        "documents": docs,
        "audit_logs": audit_logs,
    }


@router.post("/applications/{application_id}/proceed-to-sca")
def proceed_to_sca_review(application_id: str, req: StageActionRequest):
    """
    Intelligent Completeness Gatekeeper:
    Checks if 100% of required documents are VERIFIED.
    If yes, advances application to Stage 2 (SCA / Channel Partner Review).
    If no, blocks transition with HTTP 400 and returns the exact missing/unverified documents.
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()
        app_data = dict(app_row)

        # Query all required documents
        cursor.execute(
            "SELECT * FROM user_documents WHERE lower(application_id) = lower(?) AND required = 1",
            (app_id,),
        )
        req_docs = [dict(r) for r in cursor.fetchall()]

        unverified = [d for d in req_docs if d.get("status") != "VERIFIED"]
        if unverified:
            missing_names = [f"{d['doc_name']} ({d.get('status', 'MISSING')})" for d in unverified]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot proceed to SCA Review. {len(unverified)} required document(s) not verified: {', '.join(missing_names)}",
            )

        # Update stage to Stage 2 (index 2: SCA / Channel Partner Review)
        now_dt = datetime.now()
        now_str = now_dt.strftime("%d %b %Y, %I:%M %p")
        today_date = now_dt.strftime("%Y-%m-%d")

        # Load & update timeline
        timeline = []
        if app_data.get("timeline_json"):
            try:
                timeline = json.loads(app_data["timeline_json"])
            except Exception:
                pass
        if len(timeline) < 5:
            from routes.applications import generate_timeline
            timeline = generate_timeline(now_dt, app_data.get("scheme_name", "Scheme"), app_id)

        official_note = req.remarks or "All mandatory KYC and eligibility documents verified. Transferred to State Channelizing Agency (SCA) for quota appraisal."

        for idx, t_step in enumerate(timeline):
            if idx < 2:
                t_step["status"] = "COMPLETED"
            elif idx == 2:
                t_step["status"] = "IN_PROGRESS"
                t_step["date"] = now_str
                t_step["remarks"] = official_note
            else:
                t_step["status"] = "PENDING"

        cursor.execute(
            """
            UPDATE user_applications
            SET current_stage_index = 2,
                status_code = 'IN_PROGRESS',
                status_label = 'SCA / Channel Partner Review',
                official_note = ?,
                action_required = NULL,
                document_verified_at = CURRENT_TIMESTAMP,
                timeline_json = ?,
                last_updated = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE lower(application_id) = lower(?)
            """,
            (official_note, json.dumps(timeline), today_date, app_id),
        )

        from services.audit import log_application_action
        log_application_action(
            application_id=app_data["application_id"],
            action="ADVANCED_TO_SCA_REVIEW",
            role="AUTHOR",
            old_status=app_data.get("status_code"),
            new_status="IN_PROGRESS",
            remarks=f"All {len(req_docs)} required documents verified. Application authorized and dispatched to SCA Review by {req.officer_name}.",
            conn=conn,
        )
        conn.commit()

        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        updated_row = cursor.fetchone()
        updated_app = row_to_application_dict(dict(updated_row))

    try:
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Application {app_id} successfully forwarded to Stage 3: SCA / Channel Partner Review.",
        "application": updated_app,
    }


@router.post("/applications/{application_id}/sca-review")
def review_sca_stage(application_id: str, req: StageActionRequest):
    """
    SCA Endorsement:
    Approves SCA review and forwards application to Stage 3: Bank Credit Appraisal & Sanction.
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()
        app_data = dict(app_row)
        now_dt = datetime.now()
        now_str = now_dt.strftime("%d %b %Y, %I:%M %p")
        today_date = now_dt.strftime("%Y-%m-%d")

        timeline = []
        if app_data.get("timeline_json"):
            try:
                timeline = json.loads(app_data["timeline_json"])
            except Exception:
                pass
        if len(timeline) < 5:
            from routes.applications import generate_timeline
            timeline = generate_timeline(now_dt, app_data.get("scheme_name", "Scheme"), app_id)

        official_note = req.remarks or "SCA Committee has validated quota eligibility and endorsed application to Nominated Lending Bank Branch for Credit Appraisal."

        for idx, t_step in enumerate(timeline):
            if idx < 3:
                t_step["status"] = "COMPLETED"
            elif idx == 3:
                t_step["status"] = "IN_PROGRESS"
                t_step["date"] = now_str
                t_step["remarks"] = official_note
            else:
                t_step["status"] = "PENDING"

        cursor.execute(
            """
            UPDATE user_applications
            SET current_stage_index = 3,
                status_code = 'IN_PROGRESS',
                status_label = 'Bank Credit Appraisal & Sanction',
                official_note = ?,
                action_required = NULL,
                sca_reviewed_at = CURRENT_TIMESTAMP,
                timeline_json = ?,
                last_updated = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE lower(application_id) = lower(?)
            """,
            (official_note, json.dumps(timeline), today_date, app_id),
        )

        from services.audit import log_application_action
        log_application_action(
            application_id=app_data["application_id"],
            action="SCA_REVIEW_APPROVED",
            role="AUTHOR",
            old_status=app_data.get("status_code"),
            new_status="IN_PROGRESS",
            remarks=f"SCA Review approved by {req.officer_name}. Quota confirmed and forwarded to Bank Credit Appraisal.",
            conn=conn,
        )
        conn.commit()

        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        updated_row = cursor.fetchone()
        updated_app = row_to_application_dict(dict(updated_row))

    try:
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Application {app_id} successfully endorsed by SCA and sent to Bank Appraisal.",
        "application": updated_app,
    }


@router.post("/applications/{application_id}/bank-sanction")
def sanction_bank_loan(application_id: str, req: StageActionRequest):
    """
    Bank Credit Sanction:
    Authorizes loan sanction with sanction amount and proceeds to Stage 4 (Disbursement Pending).
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()
        app_data = dict(app_row)
        now_dt = datetime.now()
        now_str = now_dt.strftime("%d %b %Y, %I:%M %p")
        today_date = now_dt.strftime("%Y-%m-%d")

        sanction_amount = req.sanction_amount or app_data.get("loan_amount", "₹ 1,50,000")

        timeline = []
        if app_data.get("timeline_json"):
            try:
                timeline = json.loads(app_data["timeline_json"])
            except Exception:
                pass
        if len(timeline) < 5:
            from routes.applications import generate_timeline
            timeline = generate_timeline(now_dt, app_data.get("scheme_name", "Scheme"), app_id)

        official_note = req.remarks or f"Bank credit sanction order issued for {sanction_amount}. Direct Benefit Transfer (DBT) subsidy credit queued."

        for idx, t_step in enumerate(timeline):
            if idx < 4:
                t_step["status"] = "COMPLETED"
            elif idx == 4:
                t_step["status"] = "IN_PROGRESS"
                t_step["date"] = now_str
                t_step["remarks"] = official_note

        cursor.execute(
            """
            UPDATE user_applications
            SET current_stage_index = 4,
                status_code = 'APPROVED',
                status_label = 'Sanction Granted - Awaiting DBT Credit',
                sanction_amount = ?,
                official_note = ?,
                action_required = NULL,
                sanctioned_at = CURRENT_TIMESTAMP,
                timeline_json = ?,
                last_updated = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE lower(application_id) = lower(?)
            """,
            (sanction_amount, official_note, json.dumps(timeline), today_date, app_id),
        )

        from services.audit import log_application_action
        log_application_action(
            application_id=app_data["application_id"],
            action="BANK_SANCTION_ISSUED",
            role="BANK",
            old_status=app_data.get("status_code"),
            new_status="APPROVED",
            remarks=f"Bank Sanction Order issued for amount {sanction_amount} by {req.officer_name}.",
            conn=conn,
        )
        conn.commit()

        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        updated_row = cursor.fetchone()
        updated_app = row_to_application_dict(dict(updated_row))

    try:
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Loan sanction issued for {app_id}. Ready for DBT disbursement.",
        "application": updated_app,
    }


@router.post("/applications/{application_id}/disbursement")
def record_disbursement(application_id: str, req: StageActionRequest):
    """
    Final Disbursement & DBT Credit:
    Records UTR / transaction reference, marks application as DISBURSED (100% complete).
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()
        app_data = dict(app_row)
        now_dt = datetime.now()
        now_str = now_dt.strftime("%d %b %Y, %I:%M %p")
        today_date = now_dt.strftime("%Y-%m-%d")

        disbursement_ref = req.disbursement_ref or f"UTR{now_dt.strftime('%Y%m%d%H%M%S')}"
        disbursed_amt = req.sanction_amount or app_data.get("sanction_amount") or app_data.get("loan_amount", "₹ 1,50,000")

        timeline = []
        if app_data.get("timeline_json"):
            try:
                timeline = json.loads(app_data["timeline_json"])
            except Exception:
                pass
        if len(timeline) < 5:
            from routes.applications import generate_timeline
            timeline = generate_timeline(now_dt, app_data.get("scheme_name", "Scheme"), app_id)

        official_note = req.remarks or f"DBT Disbursement completed! Concessional loan of {disbursed_amt} credited. Ref UTR: {disbursement_ref}."

        for t_step in timeline:
            t_step["status"] = "COMPLETED"
        if len(timeline) >= 5:
            timeline[4]["date"] = now_str
            timeline[4]["remarks"] = official_note

        cursor.execute(
            """
            UPDATE user_applications
            SET current_stage_index = 4,
                status_code = 'DISBURSED',
                status_label = 'Disbursed - Loan Credited',
                disbursement_amount = ?,
                disbursement_ref = ?,
                official_note = ?,
                action_required = NULL,
                disbursed_at = CURRENT_TIMESTAMP,
                timeline_json = ?,
                last_updated = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE lower(application_id) = lower(?)
            """,
            (disbursed_amt, disbursement_ref, official_note, json.dumps(timeline), today_date, app_id),
        )

        from services.audit import log_application_action
        log_application_action(
            application_id=app_data["application_id"],
            action="DISBURSED",
            role="TREASURY",
            old_status=app_data.get("status_code"),
            new_status="DISBURSED",
            remarks=f"Direct Benefit Transfer of {disbursed_amt} credited with UTR {disbursement_ref}.",
            conn=conn,
        )
        conn.commit()

        cursor.execute("SELECT * FROM user_applications WHERE lower(application_id) = lower(?)", (app_id,))
        updated_row = cursor.fetchone()
        updated_app = row_to_application_dict(dict(updated_row))

    try:
        sync_all_admin_excel()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Application {app_id} successfully disbursed and closed.",
        "disbursement_ref": disbursement_ref,
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


@router.get("/stats")
def get_admin_stats():
    """Return aggregate stats for the Author Desk dashboard."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM user_applications")
        total_apps = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM user_applications WHERE user_id IS NOT NULL")
        total_users_with_apps = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM user_applications WHERE status_code = 'APPROVED'")
        approved = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM user_applications WHERE status_code = 'ACTION_REQUIRED'")
        action_required = cursor.fetchone()[0]

        cursor.execute(
            "SELECT current_stage_index, COUNT(*) as cnt FROM user_applications GROUP BY current_stage_index ORDER BY current_stage_index"
        )
        stage_rows = cursor.fetchall()
        by_stage = {row[0]: row[1] for row in stage_rows}

        cursor.execute(
            "SELECT scheme_id, COUNT(*) as cnt FROM user_applications GROUP BY scheme_id ORDER BY cnt DESC LIMIT 5"
        )
        scheme_rows = cursor.fetchall()
        top_schemes = [{"scheme_id": row[0], "count": row[1]} for row in scheme_rows]

    return {
        "status": "success",
        "stats": {
            "total_applications": total_apps,
            "total_users": total_users,
            "total_users_with_apps": total_users_with_apps,
            "approved": approved,
            "action_required": action_required,
            "by_stage": by_stage,
            "top_schemes": top_schemes,
        },
    }


@router.get("/verify-pin")
def verify_admin_pin(pin: str):
    """Verify admin PIN against the ADMIN_PIN environment variable (default: 1234)."""
    import os
    correct_pin = os.environ.get("ADMIN_PIN", "1234")
    if pin == correct_pin:
        return {"status": "success", "valid": True}
    return {"status": "error", "valid": False}


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

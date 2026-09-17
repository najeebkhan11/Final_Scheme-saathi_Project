import os
import re
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database.database import get_db, BASE_DIR
from services.auth import decode_token
from services.audit import log_application_action

router = APIRouter(
    prefix="/api",
    tags=["Documents & Application Verification"],
)

# Resolve upload directory (local or serverless /tmp)
def _resolve_upload_dir() -> Path:
    is_serverless = bool(
        os.environ.get("VERCEL")
        or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("LAMBDA_TASK_ROOT")
        or os.environ.get("VERCEL_ENV")
    )
    if is_serverless:
        p = Path(tempfile.gettempdir()) / "scheme_saathi_uploads"
    else:
        p = BASE_DIR / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p

UPLOAD_DIR = _resolve_upload_dir()
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


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


class DocumentActionRequest(BaseModel):
    rejection_reason: Optional[str] = None
    remarks: Optional[str] = None
    verified_by: Optional[str] = "District Scrutiny Officer"


def provision_application_documents(conn, application_id: str, scheme_id: str, user_id: Optional[int] = None):
    """
    Ensures that every required document for the application's scheme is initialized in user_documents.
    """
    cursor = conn.cursor()

    s_upper = (scheme_id or "").upper().strip()
    cursor.execute(
        """
        SELECT document_type, document_name, required, category, description
        FROM scheme_documents
        WHERE scheme_id = ? AND active = 1
        ORDER BY id ASC
        """,
        (s_upper,),
    )
    rules = cursor.fetchall()

    if not rules and "-" in s_upper:
        cursor.execute(
            """
            SELECT document_type, document_name, required, category, description
            FROM scheme_documents
            WHERE scheme_id = ? AND active = 1
            ORDER BY id ASC
            """,
            (s_upper.replace("-", ""),),
        )
        rules = cursor.fetchall()

    if not rules:
        # Fallback to DEFAULT scheme rules
        cursor.execute(
            """
            SELECT document_type, document_name, required, category, description
            FROM scheme_documents
            WHERE scheme_id = 'DEFAULT' AND active = 1
            ORDER BY id ASC
            """
        )
        rules = cursor.fetchall()

    for r in rules:
        doc_type = r["document_type"]
        doc_name = r["document_name"]
        required = r["required"]
        doc_ref = f"DOC-{application_id[-8:]}-{doc_type[:6].upper()}"

        cursor.execute(
            """
            INSERT OR IGNORE INTO user_documents (
                document_id, application_id, user_id, doc_type, doc_name, required, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'MISSING')
            """,
            (doc_ref, application_id, user_id, doc_type, doc_name, required),
        )


@router.get("/schemes/{scheme_id}/documents")
def get_scheme_documents(scheme_id: str):
    """
    Returns the configured document requirements for a scheme.
    """
    s_id = scheme_id.upper()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT document_type, document_name, required, category, description,
                   allowed_file_types, max_file_size
            FROM scheme_documents
            WHERE scheme_id = ? AND active = 1
            ORDER BY id ASC
            """,
            (s_id,),
        )
        rows = cursor.fetchall()

        if not rows:
            cursor.execute(
                """
                SELECT document_type, document_name, required, category, description,
                       allowed_file_types, max_file_size
                FROM scheme_documents
                WHERE scheme_id = 'DEFAULT' AND active = 1
                ORDER BY id ASC
                """
            )
            rows = cursor.fetchall()

    docs = [
        {
            "type": r["document_type"],
            "name": r["document_name"],
            "required": bool(r["required"]),
            "category": r["category"],
            "description": r["description"],
            "allowed_file_types": r["allowed_file_types"],
            "max_file_size": r["max_file_size"],
        }
        for r in rows
    ]

    return {
        "status": "success",
        "scheme_id": s_id,
        "count": len(docs),
        "documents": docs,
    }


@router.get("/applications/{application_id}/documents")
def get_application_documents(application_id: str):
    """
    Returns the complete list of documents for an application, with upload status,
    verification status, rejection reasons, and an intelligent completeness summary.
    """
    app_id = application_id.strip()

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()

        # Ensure documents are provisioned
        provision_application_documents(conn, app_row["application_id"], app_row["scheme_id"], app_row["user_id"])
        conn.commit()

        cursor.execute(
            """
            SELECT * FROM user_documents
            WHERE lower(application_id) = lower(?)
            ORDER BY required DESC, id ASC
            """,
            (app_id,),
        )
        rows = cursor.fetchall()

    docs = []
    total_required = 0
    verified_required = 0
    rejected_count = 0
    missing_count = 0
    under_verification_count = 0

    for r in rows:
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

    return {
        "status": "success",
        "application_id": app_id,
        "scheme_id": app_row["scheme_id"],
        "scheme_name": app_row["scheme_name"],
        "summary": {
            "total_documents": len(docs),
            "total_required": total_required,
            "verified_required": verified_required,
            "rejected_count": rejected_count,
            "missing_count": missing_count,
            "under_verification_count": under_verification_count,
            "is_complete": is_complete,
            "status_label": "Documents Complete" if is_complete else f"{verified_required}/{total_required} Verified (Pending)",
        },
        "documents": docs,
    }


@router.post("/applications/{application_id}/documents/{document_type}/upload")
async def upload_application_document(
    application_id: str,
    document_type: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """
    Uploads a document file (PDF, JPG, PNG) for a specific document requirement.
    Validates file format and size, stores securely, updates status to UNDER_VERIFICATION,
    and logs an audit action.
    """
    app_id = application_id.strip()
    doc_type = document_type.strip()

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, JPG, JPEG, PNG.",
        )

    # Read content to validate size
    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 5 MB limit.")

    with get_db() as conn:
        app_row = _get_or_create_app(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")

        cursor = conn.cursor()

        # Ensure documents are provisioned
        provision_application_documents(conn, app_row["application_id"], app_row["scheme_id"], app_row["user_id"])
        conn.commit()

        cursor.execute(
            "SELECT * FROM user_documents WHERE lower(application_id) = lower(?) AND (lower(doc_type) = lower(?) OR lower(doc_type) = lower(?)) LIMIT 1",
            (app_id, doc_type, doc_type.replace("-", "_")),
        )
        doc_row = cursor.fetchone()

        # Save file to disk
        app_dir = UPLOAD_DIR / app_id
        app_dir.mkdir(parents=True, exist_ok=True)
        safe_filename = f"{doc_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
        save_path = app_dir / safe_filename

        with open(save_path, "wb") as f:
            f.write(content)

        old_status = doc_row["status"] if doc_row else "MISSING"
        new_status = "UNDER_VERIFICATION"
        doc_ref = doc_row["document_id"] if doc_row and doc_row["document_id"] else f"DOC-{app_id[-8:]}-{doc_type[:6].upper()}-{int(datetime.now().timestamp())}"

        if doc_row:
            cursor.execute(
                """
                UPDATE user_documents
                SET file_path = ?,
                    file_name = ?,
                    file_size = ?,
                    mime_type = ?,
                    status = ?,
                    uploaded_at = CURRENT_TIMESTAMP,
                    rejection_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (str(save_path), file.filename, file_size, file.content_type or "application/octet-stream", new_status, doc_row["id"]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO user_documents (
                    document_id, application_id, user_id, doc_type, doc_name,
                    required, file_path, file_name, file_size, mime_type,
                    status, uploaded_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    doc_ref,
                    app_row["application_id"],
                    app_row["user_id"],
                    doc_type.lower(),
                    doc_type.replace("_", " ").title(),
                    str(save_path),
                    file.filename,
                    file_size,
                    file.content_type or "application/octet-stream",
                    new_status,
                ),
            )

        # Log audit action
        log_application_action(
            application_id=app_row["application_id"],
            action="DOCUMENT_UPLOADED",
            role="USER",
            user_id=app_row["user_id"],
            old_status=old_status,
            new_status=new_status,
            remarks=f"Uploaded {file.filename} ({round(file_size / 1024, 1)} KB) for {doc_type}.",
            conn=conn,
        )
        conn.commit()

    return {
        "status": "success",
        "message": f"Document '{file.filename}' uploaded successfully and submitted for scrutiny.",
        "document_id": doc_ref,
        "document_type": doc_type,
        "file_name": file.filename,
        "file_size": file_size,
        "verification_status": new_status,
    }


@router.get("/documents/{document_id}/file")
def view_document_file(document_id: str):
    """
    Secure endpoint to view or stream an uploaded document.
    """
    doc_id = document_id.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_path, file_name, mime_type FROM user_documents WHERE document_id = ? OR id = ?", (doc_id, doc_id))
        row = cursor.fetchone()

    if not row or not row["file_path"]:
        raise HTTPException(status_code=404, detail="Document file not found.")

    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File on disk has expired or is missing.")

    return FileResponse(
        path=str(file_path),
        filename=row["file_name"],
        media_type=row["mime_type"] or "application/octet-stream",
    )


@router.post("/documents/{document_id}/verify")
def verify_document(document_id: str, req: DocumentActionRequest):
    """
    Author / Reviewer action: Marks a document as VERIFIED.
    """
    doc_id = document_id.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_documents WHERE document_id = ? OR id = ?", (doc_id, doc_id))
        doc_row = cursor.fetchone()
        if not doc_row:
            raise HTTPException(status_code=404, detail="Document record not found.")

        d = dict(doc_row)
        old_status = d.get("status") or "MISSING"
        new_status = "VERIFIED"

        cursor.execute(
            """
            UPDATE user_documents
            SET status = ?,
                verified_at = CURRENT_TIMESTAMP,
                verified_by = ?,
                rejection_reason = NULL,
                remarks = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_status, req.verified_by or "District Scrutiny Officer", req.remarks or "Document verified and approved.", d["id"]),
        )

        log_application_action(
            application_id=d["application_id"],
            action="DOCUMENT_VERIFIED",
            role="AUTHOR",
            old_status=old_status,
            new_status=new_status,
            remarks=f"Document '{d['doc_name']}' marked as VERIFIED by {req.verified_by}.",
            conn=conn,
        )
        conn.commit()

    return {
        "status": "success",
        "message": f"Document '{d['doc_name']}' successfully verified.",
        "document_id": d["document_id"],
        "verification_status": new_status,
    }


@router.post("/documents/{document_id}/reject")
def reject_document(document_id: str, req: DocumentActionRequest):
    """
    Author / Reviewer action: Rejects a document with a mandatory rejection reason.
    """
    doc_id = document_id.strip()
    if not req.rejection_reason or not req.rejection_reason.strip():
        raise HTTPException(status_code=400, detail="A rejection reason must be provided.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_documents WHERE document_id = ? OR id = ?", (doc_id, doc_id))
        doc_row = cursor.fetchone()
        if not doc_row:
            raise HTTPException(status_code=404, detail="Document record not found.")

        d = dict(doc_row)
        old_status = d.get("status") or "MISSING"
        new_status = "REJECTED"

        cursor.execute(
            """
            UPDATE user_documents
            SET status = ?,
                rejection_reason = ?,
                remarks = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_status, req.rejection_reason.strip(), req.remarks, d["id"]),
        )

        # Update application action_required banner
        cursor.execute(
            """
            UPDATE user_applications
            SET status_code = 'DOCUMENT_REJECTED',
                action_required = ?
            WHERE application_id = ?
            """,
            (f"Document clarification required: {d['doc_name']} was rejected ({req.rejection_reason.strip()}). Please re-upload.", d["application_id"]),
        )

        log_application_action(
            application_id=d["application_id"],
            action="DOCUMENT_REJECTED",
            role="AUTHOR",
            old_status=old_status,
            new_status=new_status,
            remarks=f"Document '{d['doc_name']}' REJECTED. Reason: {req.rejection_reason.strip()}",
            conn=conn,
        )
        conn.commit()

    return {
        "status": "success",
        "message": f"Document '{d['doc_name']}' marked as REJECTED.",
        "document_id": d["document_id"],
        "rejection_reason": req.rejection_reason.strip(),
        "verification_status": new_status,
    }

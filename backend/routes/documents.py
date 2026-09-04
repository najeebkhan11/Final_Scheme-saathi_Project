from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database.database import get_db
from services.auth import get_current_user

router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"],
)


class DocumentVerifyRequest(BaseModel):
    doc_type: str
    doc_name: str
    status: Optional[str] = "verified"
    verified_via: Optional[str] = "DigiLocker"


@router.get("/status")
def get_user_documents(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT doc_type, doc_name, status, verified_via, verified_at, updated_at FROM user_documents WHERE user_id = ?",
            (user_id,),
        )
        rows = cursor.fetchall()
        docs = {row["doc_type"]: dict(row) for row in rows}
    return {"status": "success", "documents": docs}


@router.post("/verify")
def verify_user_document(
    request: DocumentVerifyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO user_documents (user_id, doc_type, doc_name, status, verified_via, verified_at, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, doc_type) DO UPDATE SET
                status = excluded.status,
                doc_name = excluded.doc_name,
                verified_via = excluded.verified_via,
                verified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                request.doc_type,
                request.doc_name,
                request.status,
                request.verified_via,
            ),
        )
    return {
        "status": "success",
        "message": f"{request.doc_name} verified successfully via {request.verified_via}",
        "doc_type": request.doc_type,
        "verified": True,
    }

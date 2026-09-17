import sqlite3
from typing import Optional
from database.database import get_db


def log_application_action(
    application_id: str,
    action: str,
    role: str = "SYSTEM",
    user_id: Optional[int] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    remarks: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None,
):
    """
    Records an immutable audit event for an application action.
    """
    sql = """
    INSERT INTO application_audit_logs (
        application_id, user_id, role, action, old_status, new_status, remarks, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """
    params = (application_id, user_id, role, action, old_status, new_status, remarks)

    if conn:
        conn.execute(sql, params)
    else:
        with get_db() as db:
            db.execute(sql, params)

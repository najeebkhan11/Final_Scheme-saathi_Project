import os
import json
import sqlite3
from datetime import datetime
from pathlib import Path
import pandas as pd

from database.database import get_connection, DATABASE_PATH


def _resolve_admin_data_dir() -> Path:
    env_dir = os.environ.get("ADMIN_DATA_DIR")
    if env_dir:
        p = Path(env_dir)
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except Exception:
            pass

    is_serverless = bool(
        os.environ.get("VERCEL")
        or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("LAMBDA_TASK_ROOT")
    )
    if is_serverless:
        p = Path("/tmp/Admin_Data")
        p.mkdir(parents=True, exist_ok=True)
        return p

    local_p = Path(r"D:\Project-SIH\Admin_Data")
    try:
        local_p.mkdir(parents=True, exist_ok=True)
        return local_p
    except Exception:
        fallback = Path(__file__).resolve().parent.parent / "Admin_Data"
        try:
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback
        except Exception:
            p = Path("/tmp/Admin_Data")
            p.mkdir(parents=True, exist_ok=True)
            return p


ADMIN_DATA_DIR = _resolve_admin_data_dir()
DB_PATH = DATABASE_PATH

STAGE_NAMES = {
    0: "1. Application Submitted",
    1: "2. Document Verification",
    2: "3. SCA / Partner Review",
    3: "4. Bank Sanction",
    4: "5. Disbursement (DBT)",
}

def ensure_admin_dir():
    try:
        ADMIN_DATA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

def export_applications_to_excel():
    ensure_admin_dir()
    try:
        conn = get_connection()
    except Exception as e:
        return {"status": "error", "message": f"Database connection error: {e}"}
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
    SELECT 
        application_id, user_id, applicant_name, mobile,
        scheme_id, scheme_name, loan_amount, purpose,
        current_stage_index, status_code, status_label,
        submission_date, last_updated, estimated_completion,
        official_note, action_required, created_at, updated_at
    FROM user_applications
    ORDER BY created_at DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    records = []
    for r in rows:
        d = dict(r)
        stage_idx = d.get("current_stage_index", 0)
        records.append({
            "Application ID": d.get("application_id"),
            "Applicant Name": d.get("applicant_name"),
            "Mobile Number": d.get("mobile"),
            "Scheme Code": d.get("scheme_id"),
            "Scheme Name": d.get("scheme_name"),
            "Loan Amount": d.get("loan_amount"),
            "Purpose": d.get("purpose"),
            "Current Stage": STAGE_NAMES.get(stage_idx, f"Stage {stage_idx}"),
            "Current Stage Index": stage_idx,
            "Status Label": d.get("status_label"),
            "Status Code": d.get("status_code"),
            "Submission Date": d.get("submission_date"),
            "Last Updated": d.get("last_updated"),
            "Estimated Completion": d.get("estimated_completion"),
            "Official Remarks": d.get("official_note"),
            "Action Required": d.get("action_required") or "None",
            "Created At": d.get("created_at"),
            "Updated At": d.get("updated_at"),
        })

    df = pd.DataFrame(records)
    excel_path = ADMIN_DATA_DIR / "User_Applications.xlsx"
    csv_path = ADMIN_DATA_DIR / "User_Applications.csv"

    try:
        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Applications")
            worksheet = writer.sheets["Applications"]
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 14)

        df.to_csv(csv_path, index=False, encoding="utf-8-sig")

        return {
            "status": "success",
            "count": len(records),
            "excel_path": str(excel_path),
            "csv_path": str(csv_path),
            "updated_at": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def export_profiles_to_excel():
    ensure_admin_dir()
    try:
        conn = get_connection()
    except Exception as e:
        return {"status": "error", "message": f"Database connection error: {e}"}
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
    SELECT 
        u.id as user_id, u.name as user_name, u.identifier as login_identifier,
        p.full_name, p.age, p.gender, p.category, p.state, p.district,
        p.annual_income, p.purpose, p.business_type, p.project_stage,
        p.project_cost, p.required_loan, p.course, p.institution,
        p.course_fee, p.education_level, p.own_contribution,
        p.existing_loan, p.outstanding_amount, p.overdue,
        p.created_at, p.updated_at
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    ORDER BY u.created_at DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    records = []
    for r in rows:
        d = dict(r)
        records.append({
            "User ID": d.get("user_id"),
            "Login Name": d.get("user_name"),
            "Mobile / Identifier": d.get("login_identifier"),
            "Full Name": d.get("full_name") or d.get("user_name"),
            "Age": d.get("age"),
            "Gender": d.get("gender"),
            "Category (Caste)": d.get("category"),
            "State": d.get("state"),
            "District": d.get("district"),
            "Annual Family Income (INR)": d.get("annual_income"),
            "Purpose": d.get("purpose"),
            "Business Type": d.get("business_type"),
            "Project Stage": d.get("project_stage"),
            "Project Cost": d.get("project_cost"),
            "Required Loan": d.get("required_loan"),
            "Education Course": d.get("course"),
            "Institution": d.get("institution"),
            "Course Fee": d.get("course_fee"),
            "Own Contribution": d.get("own_contribution"),
            "Existing Loan": d.get("existing_loan"),
            "Outstanding Amount": d.get("outstanding_amount"),
            "Registered At": d.get("created_at"),
            "Profile Updated At": d.get("updated_at"),
        })

    df = pd.DataFrame(records)
    excel_path = ADMIN_DATA_DIR / "User_Profiles.xlsx"
    csv_path = ADMIN_DATA_DIR / "User_Profiles.csv"

    try:
        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="User_Profiles")
            worksheet = writer.sheets["User_Profiles"]
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 14)

        df.to_csv(csv_path, index=False, encoding="utf-8-sig")

        return {
            "status": "success",
            "count": len(records),
            "excel_path": str(excel_path),
            "csv_path": str(csv_path),
            "updated_at": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def sync_all_admin_excel():
    apps_res = export_applications_to_excel()
    profiles_res = export_profiles_to_excel()
    return {
        "status": "success",
        "applications": apps_res,
        "profiles": profiles_res,
        "folder": str(ADMIN_DATA_DIR),
    }

if __name__ == "__main__":
    res = sync_all_admin_excel()
    print("Sync result:", json.dumps(res, indent=2))

import os
import shutil
import sqlite3
import tempfile
from pathlib import Path
from contextlib import contextmanager

BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_database_path() -> Path:
    # 1. Respect explicit environment variable if set
    env_path = os.environ.get("DATABASE_PATH")
    if env_path:
        p = Path(env_path)
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            return p
        except Exception:
            pass

    # 2. Serverless detection (Vercel, AWS Lambda)
    is_serverless = bool(
        os.environ.get("VERCEL")
        or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("LAMBDA_TASK_ROOT")
        or os.environ.get("VERCEL_ENV")
    )

    if is_serverless:
        temp_dir = Path(tempfile.gettempdir())
        tmp_db = temp_dir / "scheme_saathi.db"
        try:
            tmp_db.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        bundled_db = BASE_DIR / "scheme_saathi.db"
        if not tmp_db.exists() and bundled_db.exists():
            try:
                shutil.copyfile(bundled_db, tmp_db)
            except Exception:
                pass
        return tmp_db

    # 3. Local environment
    local_db = BASE_DIR / "scheme_saathi.db"
    try:
        local_db.parent.mkdir(parents=True, exist_ok=True)
        # Test if directory is writable
        test_file = local_db.parent / ".perm_test"
        try:
            test_file.touch()
            test_file.unlink(missing_ok=True)
            return local_db
        except (OSError, PermissionError):
            temp_dir = Path(tempfile.gettempdir())
            tmp_db = temp_dir / "scheme_saathi.db"
            try:
                tmp_db.parent.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            if not tmp_db.exists() and local_db.exists():
                try:
                    shutil.copyfile(local_db, tmp_db)
                except Exception:
                    pass
            return tmp_db
    except Exception:
        temp_dir = Path(tempfile.gettempdir())
        return temp_dir / "scheme_saathi.db"


DATABASE_PATH = _resolve_database_path()


def get_connection() -> sqlite3.Connection:
    global DATABASE_PATH
    try:
        conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
    except sqlite3.OperationalError:
        # If opening fails due to read-only filesystem on Vercel/serverless, fallback to temp dir
        fallback_path = Path(tempfile.gettempdir()) / "scheme_saathi.db"
        if fallback_path != DATABASE_PATH:
            bundled = BASE_DIR / "scheme_saathi.db"
            if not fallback_path.exists() and bundled.exists():
                try:
                    shutil.copyfile(bundled, fallback_path)
                except Exception:
                    pass
            DATABASE_PATH = fallback_path
            conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
        else:
            raise

    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                identifier TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                age TEXT,
                gender TEXT,
                category TEXT,
                state TEXT,
                district TEXT,
                annual_income REAL,
                purpose TEXT,
                business_type TEXT,
                project_stage TEXT,
                project_cost REAL,
                required_loan REAL,
                course TEXT,
                institution TEXT,
                course_fee REAL,
                education_level TEXT,
                own_contribution REAL,
                existing_loan TEXT,
                outstanding_amount REAL,
                overdue TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                applicant_name TEXT NOT NULL,
                mobile TEXT,
                mobile_masked TEXT,
                scheme_id TEXT NOT NULL,
                scheme_name TEXT NOT NULL,
                scheme_type TEXT DEFAULT 'PRIMARY',
                authority TEXT,
                loan_amount TEXT,
                purpose TEXT,
                submission_date TEXT,
                last_updated TEXT,
                estimated_completion TEXT,
                current_stage_index INTEGER DEFAULT 0,
                status_code TEXT DEFAULT 'SUBMITTED',
                status_label TEXT DEFAULT 'Application Submitted',
                status_color TEXT DEFAULT 'blue',
                channel_partner_json TEXT,
                official_note TEXT,
                action_required TEXT,
                timeline_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )
        # Migrate existing table if mobile_masked or mobile is missing
        try:
            conn.execute("ALTER TABLE user_applications ADD COLUMN mobile_masked TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE user_applications ADD COLUMN mobile TEXT")
        except Exception:
            pass

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_user_applications_app_id ON user_applications(application_id);
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_user_applications_user_id ON user_applications(user_id);
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                doc_type TEXT NOT NULL,
                doc_name TEXT NOT NULL,
                status TEXT DEFAULT 'verified',
                verified_via TEXT DEFAULT 'DigiLocker',
                verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, doc_type)
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
            """
        )

        # Seed preset sample applications if table has no records
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM user_applications")
        count = cursor.fetchone()[0]
        if count == 0:
            try:
                import json
                # Demo / showcase applications seeded on first boot.
                # AI-generated dynamic timelines are added via generate_timeline at submit time;
                # these use hand-crafted timelines for realistic demo display.
                _SEED_APPLICATIONS = [
                    {
                        "application_id": "SS-2026-MFS-8492",
                        "applicant_name": "Ramesh Chandra",
                        "mobile": "XXXXXX4219",
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
                            "helpline": "1800-180-5566",
                        },
                        "official_note": "Your digital KYC and Caste certificate have been verified. Field verification by the district officer is scheduled between 05 Sep and 08 Sep 2026.",
                        "action_required": None,
                        "timeline": [
                            {"stage_index": 0, "title": "Application Submitted", "subtitle": "Online Submission via Scheme Saathi", "date": "18 Aug 2026, 11:30 AM", "status": "COMPLETED", "remarks": "Application form and primary documents successfully registered under Ref #SS-2026-MFS-8492."},
                            {"stage_index": 1, "title": "Document Verification", "subtitle": "District Scrutiny Cell", "date": "25 Aug 2026, 04:15 PM", "status": "IN_PROGRESS", "remarks": "Aadhaar and Caste certificates validated via DigiLocker. Physical scrutiny of premises pending."},
                            {"stage_index": 2, "title": "SCA / Channel Partner Review", "subtitle": "State Channelizing Agency Committee", "date": "Expected: 08 Sep 2026", "status": "PENDING", "remarks": "Quotas and fund allocation appraisal by State Channelizing Agency."},
                            {"stage_index": 3, "title": "Bank Credit Appraisal & Sanction", "subtitle": "Lending Branch Partner", "date": "Expected: 12 Sep 2026", "status": "PENDING", "remarks": "Credit agreement execution and sanction letter issuance."},
                            {"stage_index": 4, "title": "Disbursement & DBT Credit", "subtitle": "Direct Benefit Transfer", "date": "Expected: 15 Sep 2026", "status": "PENDING", "remarks": "Loan credit directly to Aadhaar-linked bank account."},
                        ],
                    },
                    {
                        "application_id": "SS-2026-ELS-3104",
                        "applicant_name": "Pooja Kumari",
                        "mobile": "XXXXXX8832",
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
                            "helpline": "1800-180-2222",
                        },
                        "official_note": "Sanction letter #ELS-2026-9812 has been issued. Subsidized interest rate at 4.0% p.a. approved for the study tenure.",
                        "action_required": "Please visit the branch by 06 Sep 2026 with your admission letter original and bank passbook to sign the subsidy agreement.",
                        "timeline": [
                            {"stage_index": 0, "title": "Application Submitted", "subtitle": "Online Submission via Scheme Saathi", "date": "10 Jul 2026, 02:40 PM", "status": "COMPLETED", "remarks": "Educational loan request submitted with Institute Bonafide Certificate."},
                            {"stage_index": 1, "title": "Document Verification", "subtitle": "State Nodal Cell", "date": "24 Jul 2026, 10:00 AM", "status": "COMPLETED", "remarks": "Fee structure, marksheet, and income certificate verified and approved."},
                            {"stage_index": 2, "title": "SCA / Channel Partner Review", "subtitle": "Bihar State SC/ST Finance Development Corp", "date": "14 Aug 2026, 03:20 PM", "status": "COMPLETED", "remarks": "Candidate recommended for full tuition & hostel fee loan subsidy."},
                            {"stage_index": 3, "title": "Bank Credit Appraisal & Sanction", "subtitle": "PNB Exhibition Road Branch", "date": "01 Sep 2026, 11:15 AM", "status": "COMPLETED", "remarks": "Sanction Order #ELS-2026-9812 generated. 1st installment ready for transfer to college."},
                            {"stage_index": 4, "title": "Disbursement & DBT Credit", "subtitle": "Direct College Account Transfer", "date": "Scheduled: 08 Sep 2026", "status": "IN_PROGRESS", "remarks": "Awaiting beneficiary agreement signature."},
                        ],
                    },
                    {
                        "application_id": "SS-2026-TL-5521",
                        "applicant_name": "Manoj Meghwal",
                        "mobile": "XXXXXX1904",
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
                            "helpline": "1800-180-6127",
                        },
                        "official_note": "Scrutiny committee found that the annual income certificate submitted was issued in 2024. As per NSFDC policy, income certificate must be valid within the past 12 months.",
                        "action_required": "Please provide an updated Family Income Certificate for FY 2026-27 issued by Tehsildar. The current document uploaded has expired.",
                        "timeline": [
                            {"stage_index": 0, "title": "Application Submitted", "subtitle": "Online Submission via Scheme Saathi", "date": "05 Aug 2026, 09:12 AM", "status": "COMPLETED", "remarks": "Project report and application for Rs 12 Lakhs submitted."},
                            {"stage_index": 1, "title": "Document Verification", "subtitle": "Jaipur District Scrutiny Committee", "date": "03 Sep 2026, 02:45 PM", "status": "ACTION_REQUIRED", "remarks": "Deficiency raised: Valid income proof required within 7 days."},
                            {"stage_index": 2, "title": "SCA / Channel Partner Review", "subtitle": "State Appraisal Board", "date": "On Hold", "status": "PENDING", "remarks": "Will proceed immediately upon resolution of document query."},
                            {"stage_index": 3, "title": "Bank Credit Appraisal & Sanction", "subtitle": "Lead District Bank", "date": "Pending", "status": "PENDING", "remarks": "Evaluation of machinery quotation and margin money."},
                            {"stage_index": 4, "title": "Disbursement & DBT Credit", "subtitle": "Direct Supplier & Beneficiary Credit", "date": "Pending", "status": "PENDING", "remarks": "Post-sanction disbursement."},
                        ],
                    },
                ]

                for data in _SEED_APPLICATIONS:
                    cursor.execute(
                        """
                        INSERT OR IGNORE INTO user_applications (
                            application_id, applicant_name, mobile, mobile_masked, scheme_id,
                            scheme_name, scheme_type, authority, loan_amount, purpose,
                            submission_date, last_updated, estimated_completion,
                            current_stage_index, status_code, status_label, status_color,
                            channel_partner_json, official_note, action_required, timeline_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            data["application_id"],
                            data["applicant_name"],
                            data.get("mobile", ""),
                            data.get("mobile_masked", ""),
                            data.get("scheme_id", "MFS"),
                            data.get("scheme_name", ""),
                            data.get("scheme_type", "PRIMARY"),
                            data.get("authority", ""),
                            data.get("loan_amount", ""),
                            data.get("purpose", ""),
                            data.get("submission_date", ""),
                            data.get("last_updated", ""),
                            data.get("estimated_completion", ""),
                            data.get("current_stage_index", 0),
                            data.get("status_code", "IN_PROGRESS"),
                            data.get("status_label", ""),
                            data.get("status_color", "blue"),
                            json.dumps(data.get("channel_partner") or {}),
                            data.get("official_note", ""),
                            data.get("action_required"),
                            json.dumps(data.get("timeline") or []),
                        ),
                    )
            except Exception as e:
                pass




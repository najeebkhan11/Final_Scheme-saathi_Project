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
                from routes.applications import SAMPLE_APPLICATIONS
                for app_id, data in SAMPLE_APPLICATIONS.items():
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
                            data.get("mobile", data.get("mobile_masked", "")),
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


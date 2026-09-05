from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from database.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    age = Column(String(10), nullable=True)
    gender = Column(String(50), nullable=True)
    category = Column(String(100), nullable=True)
    state = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    annual_income = Column(Float, nullable=True)
    purpose = Column(String(255), nullable=True)
    business_type = Column(String(255), nullable=True)
    project_stage = Column(String(255), nullable=True)
    project_cost = Column(Float, nullable=True)
    required_loan = Column(Float, nullable=True)
    course = Column(String(255), nullable=True)
    institution = Column(String(255), nullable=True)
    course_fee = Column(Float, nullable=True)
    education_level = Column(String(255), nullable=True)
    own_contribution = Column(Float, nullable=True)
    existing_loan = Column(String(255), nullable=True)
    outstanding_amount = Column(Float, nullable=True)
    overdue = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

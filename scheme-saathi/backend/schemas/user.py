from pydantic import BaseModel, Field, model_validator
from typing import Optional, Any, Dict


class UserProfileRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    category: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    annual_income: Optional[float] = None
    purpose: Optional[str] = None
    business_type: Optional[str] = None
    project_stage: Optional[str] = None
    project_cost: Optional[float] = None
    required_loan: Optional[float] = None
    course: Optional[str] = None
    institution: Optional[str] = None
    course_fee: Optional[float] = None
    education_level: Optional[str] = None
    own_contribution: Optional[float] = None
    existing_loan: Optional[str] = None
    outstanding_amount: Optional[float] = None
    overdue: Optional[str] = None
    recommendations: Optional[Any] = None

    @model_validator(mode="before")
    @classmethod
    def map_camel_case(cls, data: Any) -> Any:
        if isinstance(data, dict):
            mapping = {
                "fullName": "name",
                "annualIncome": "annual_income",
                "businessType": "business_type",
                "projectStage": "project_stage",
                "projectCost": "project_cost",
                "requiredLoan": "required_loan",
                "courseFee": "course_fee",
                "educationLevel": "education_level",
                "ownContribution": "own_contribution",
                "existingLoan": "existing_loan",
                "outstandingAmount": "outstanding_amount",
            }
            converted = dict(data)
            for camel, snake in mapping.items():
                if camel in converted and (snake not in converted or converted[snake] is None):
                    converted[snake] = converted[camel]
            # Convert empty string numbers to None or 0
            for num_key in [
                "annual_income", "project_cost", "required_loan",
                "course_fee", "own_contribution", "outstanding_amount"
            ]:
                if converted.get(num_key) == "":
                    converted[num_key] = None
                elif converted.get(num_key) is not None:
                    try:
                        converted[num_key] = float(converted[num_key])
                    except (ValueError, TypeError):
                        converted[num_key] = None
            return converted
        return data

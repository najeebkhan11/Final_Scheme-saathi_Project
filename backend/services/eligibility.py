from typing import Any


def _income_is_eligible(
    user_income: float,
    scheme: dict[str, Any],
) -> tuple[bool, str | None]:
    income_rule = scheme["eligibility"].get(
        "annual_family_income"
    )

    if not income_rule:
        return True, None

    limit = income_rule["amount_inr"]
    operator = income_rule["operator"]

    if operator == "<=":
        ok = user_income <= limit
        msg = (
            None
            if ok
            else (
                f"Annual family income ₹{user_income:,.0f} exceeds "
                f"the scheme limit of ₹{limit:,} (≤ ₹{limit:,})."
            )
        )
        return ok, msg

    if operator == "<":
        ok = user_income < limit
        msg = (
            None
            if ok
            else (
                f"Annual family income ₹{user_income:,.0f} is not below "
                f"the scheme limit of ₹{limit:,}."
            )
        )
        return ok, msg

    if operator == ">=":
        ok = user_income >= limit
        msg = (
            None
            if ok
            else (
                f"Annual family income ₹{user_income:,.0f} is below "
                f"the minimum of ₹{limit:,}."
            )
        )
        return ok, msg

    if operator == ">":
        ok = user_income > limit
        msg = (
            None
            if ok
            else (
                f"Annual family income ₹{user_income:,.0f} is not above "
                f"the minimum of ₹{limit:,}."
            )
        )
        return ok, msg

    return False, "Could not evaluate income rule."


def _community_is_eligible(
    user_category: str,
    scheme: dict[str, Any],
) -> tuple[bool, str | None]:
    allowed = (
        scheme["eligibility"]
        .get("community", {})
        .get("allowed", [])
    )

    if not allowed:
        return True, None

    normalized_allowed = {
        str(item).upper().strip()
        for item in allowed
    }

    ok = user_category.upper().strip() in normalized_allowed
    if ok:
        return True, None

    allowed_display = ", ".join(sorted(allowed))
    return (
        False,
        (
            f"Applicant category '{user_category}' does not match "
            f"the required categories: {allowed_display}."
        ),
    )


def _project_cost_is_eligible(
    project_cost: float | None,
    scheme: dict[str, Any],
) -> tuple[bool, str | None]:
    if project_cost is None:
        return True, None

    financial_terms = scheme["financial_terms"]

    minimum_project_cost = financial_terms.get(
        "minimum_project_cost_exclusive_inr"
    )

    maximum_project_cost = financial_terms.get(
        "maximum_project_cost_inr"
    )

    if (
        minimum_project_cost is not None
        and project_cost <= minimum_project_cost
    ):
        return (
            False,
            (
                "Project cost must be greater than "
                f"₹{minimum_project_cost:,}."
            ),
        )

    if (
        maximum_project_cost is not None
        and project_cost > maximum_project_cost
    ):
        return (
            False,
            (
                "Project cost exceeds the scheme limit "
                f"of ₹{maximum_project_cost:,}."
            ),
        )

    return True, None


def _purpose_is_eligible(
    purpose: str | None,
    scheme: dict[str, Any],
) -> bool:
    if not purpose:
        return True

    normalized_purpose = (
        str(purpose)
        .lower()
        .strip()
    )

    scheme_name = (
        str(scheme["name"])
        .lower()
        .strip()
    )

    if "educational" in scheme_name:
        return normalized_purpose == "education"

    business_purposes = {
        "new_business",
        "business_expansion",
        "agriculture",
        "skill",
    }

    if "micro finance" in scheme_name:
        return normalized_purpose in business_purposes

    if "aajeevika" in scheme_name:
        return normalized_purpose in business_purposes

    if "term loan" in scheme_name:
        return normalized_purpose in business_purposes

    if "udyam nidhi" in scheme_name:
        return normalized_purpose in business_purposes

    return True


def _education_is_eligible(
    user_data: dict[str, Any],
    scheme: dict[str, Any],
) -> tuple[bool, str | None]:
    scheme_name = (
        str(scheme["name"])
        .lower()
        .strip()
    )

    if "educational" not in scheme_name:
        return True, None

    if user_data.get("purpose") != "education":
        return (
            False,
            "The selected requirement is not education.",
        )

    education_level = user_data.get(
        "education_level"
    )

    allowed_levels = {
        "professional",
        "technical",
        "professional_technical",
        "undergraduate",
        "postgraduate",
        "doctoral",
        "higher_doctoral",
    }

    if education_level:
        normalized = (
            str(education_level)
            .lower()
            .strip()
        )

        if normalized not in allowed_levels:
            return (
                False,
                (
                    "The selected education level may not "
                    "match the applicable course requirements."
                ),
            )

    return True, None


def _gender_status(
    gender: str | None,
    scheme: dict[str, Any],
) -> dict[str, Any]:
    gender_rule = (
        scheme["eligibility"]
        .get("gender_rule", {})
    )

    rule_type = gender_rule.get("type")

    normalized_gender = (
        str(gender)
        .lower()
        .strip()
        if gender is not None
        else ""
    )

    if rule_type == "women_target":
        is_female = normalized_gender == "female"

        return {
            "rule_type": "women_target",
            "applies": is_female,
            "message": (
                "Women-focused fund allocation target applies."
                if is_female
                else (
                    "Applicant gender does not satisfy the "
                    "women-focused scheme condition."
                )
            ),
        }

    return {
        "rule_type": "none",
        "applies": False,
        "message": None,
    }


def check_scheme_eligibility(
    user_data: dict[str, Any],
    scheme: dict[str, Any],
) -> dict[str, Any]:

    reasons: list[str] = []
    failures: list[str] = []
    criterion_status: list[dict[str, Any]] = []

    category = (
        str(user_data.get("category", ""))
        .upper()
        .strip()
    )

    income = float(
        user_data.get("annual_income", 0)
    )

    project_cost_raw = user_data.get(
        "project_cost"
    )

    project_cost = (
        float(project_cost_raw)
        if project_cost_raw not in (
            None,
            "",
            0,
        )
        else None
    )

    purpose = user_data.get(
        "purpose"
    )

    gender = user_data.get(
        "gender"
    )

    # -----------------------------------------------------
    # COMMUNITY
    # -----------------------------------------------------

    community_ok, community_msg = _community_is_eligible(
        category,
        scheme,
    )

    criterion_status.append({
        "criterion": "community",
        "description": "Caste / community requirement",
        "satisfied": community_ok,
        "user_value": category or "Not provided",
        "required": (
            scheme["eligibility"]
            .get("community", {})
            .get("allowed", [])
        ),
        "message": community_msg if not community_ok else "Satisfied.",
    })

    if community_ok:
        reasons.append(
            "Community requirement satisfied."
        )
    else:
        failures.append(
            community_msg
            or (
                "Applicant does not satisfy the scheme's "
                "community requirement."
            )
        )

    # -----------------------------------------------------
    # INCOME
    # -----------------------------------------------------

    income_ok, income_msg = _income_is_eligible(
        income,
        scheme,
    )

    income_rule = scheme["eligibility"].get(
        "annual_family_income"
    )
    income_limit = (
        income_rule.get("amount_inr") if income_rule else None
    )
    income_operator = (
        income_rule.get("operator") if income_rule else None
    )

    criterion_status.append({
        "criterion": "income",
        "description": "Annual family income limit",
        "satisfied": income_ok,
        "user_value": f"₹{income:,.0f}",
        "required": (
            f"{income_operator} ₹{income_limit:,}"
            if income_limit is not None
            else "No limit"
        ),
        "message": (
            income_msg if not income_ok else "Satisfied."
        ),
    })

    if income_ok:
        reasons.append(
            (
                "Annual family income is within the "
                "applicable scheme limit."
            )
        )
    else:
        failures.append(
            income_msg
            or (
                "Annual family income exceeds the "
                "applicable scheme limit."
            )
        )

    # -----------------------------------------------------
    # PURPOSE
    # -----------------------------------------------------

    purpose_ok = _purpose_is_eligible(
        purpose,
        scheme,
    )

    criterion_status.append({
        "criterion": "purpose",
        "description": "Requirement / purpose type",
        "satisfied": purpose_ok,
        "user_value": purpose or "Not provided",
        "required": (
            scheme.get("purpose", [])
            if isinstance(scheme.get("purpose"), list)
            else scheme.get("purpose", "Any")
        ),
        "message": (
            "Satisfied."
            if purpose_ok
            else "Requirement type does not match the scheme."
        ),
    })

    if purpose_ok:
        reasons.append(
            "Requirement type is compatible with the scheme."
        )
    else:
        failures.append(
            "Requirement type does not match the scheme."
        )

    # -----------------------------------------------------
    # PROJECT COST
    # -----------------------------------------------------

    project_ok, project_error = (
        _project_cost_is_eligible(
            project_cost,
            scheme,
        )
    )

    financial_terms = scheme.get("financial_terms", {})
    min_cost = financial_terms.get(
        "minimum_project_cost_exclusive_inr"
    )
    max_cost = financial_terms.get(
        "maximum_project_cost_inr"
    )

    criterion_status.append({
        "criterion": "project_cost",
        "description": "Project cost range",
        "satisfied": project_ok,
        "user_value": (
            f"₹{project_cost:,.0f}" if project_cost is not None
            else "Not provided"
        ),
        "required": (
            (
                f"> ₹{min_cost:,}"
                if min_cost is not None
                else ""
            )
            + (
                f" and ≤ ₹{max_cost:,}"
                if max_cost is not None
                else ""
            )
        ).strip() or "No limit",
        "message": (
            project_error if not project_ok
            else (
                "Satisfied."
                if project_cost is not None
                else "No project cost provided; criterion skipped."
            )
        ),
    })

    if project_ok:
        if project_cost is not None:
            reasons.append(
                (
                    "Project cost falls within the "
                    "applicable scheme range."
                )
            )
    else:
        failures.append(
            project_error
            or (
                "Project cost is outside the "
                "applicable scheme range."
            )
        )

    # -----------------------------------------------------
    # EDUCATION
    # -----------------------------------------------------

    education_ok, education_error = (
        _education_is_eligible(
            user_data,
            scheme,
        )
    )

    criterion_status.append({
        "criterion": "education",
        "description": "Education level requirement",
        "satisfied": education_ok,
        "user_value": user_data.get("education_level") or "Not provided",
        "required": (
            "Professional/technical course"
            if "educational" in str(scheme.get("name", "")).lower()
            else "N/A"
        ),
        "message": (
            education_error if not education_ok
            else (
                "Satisfied."
                if scheme["id"] == "ELS"
                else "No education criterion for this scheme."
            )
        ),
    })

    if education_ok:
        if scheme["id"] == "ELS":
            reasons.append(
                "Education requirement is compatible with ELS."
            )
    else:
        failures.append(
            education_error
            or (
                "Education requirement does not satisfy "
                "the applicable conditions."
            )
        )

    # -----------------------------------------------------
    # GENDER
    # -----------------------------------------------------

    gender_status = _gender_status(
        gender,
        scheme,
    )

    is_women_target = (
        gender_status["rule_type"]
        == "women_target"
    )

    normalized_gender = (
        str(gender)
        .lower()
        .strip()
        if gender is not None
        else ""
    )

    female_only = bool(
        scheme.get("eligibility", {})
        .get("gender_rule", {})
        .get("female_only", False)
    )

    gender_ok = True
    gender_msg = "No gender restriction for this scheme."

    if female_only and normalized_gender != "female":
        gender_ok = False
        gender_msg = (
            "Applicant gender does not satisfy the female-only scheme condition."
        )
        failures.append(gender_msg)
    elif is_women_target and normalized_gender == "female":
        gender_msg = "Women-focused fund allocation target applies (40% priority allocation)."
        reasons.append(gender_msg)
    elif is_women_target:
        gender_msg = "General SC allocation applies (40% funds targeted for women)."
        reasons.append("Eligible under general scheme fund allocation.")

    criterion_status.append({
        "criterion": "gender",
        "description": "Gender requirement",
        "satisfied": gender_ok,
        "user_value": gender or "Not provided",
        "required": "Female only" if female_only else ("40% Women Target" if is_women_target else "Any"),
        "message": gender_msg,
    })

    # -----------------------------------------------------
    # FINAL RESULT & ENRICHMENT
    # -----------------------------------------------------

    eligible = len(failures) == 0

    financial_terms = scheme.get("financial_terms", {})
    max_loan = financial_terms.get("maximum_loan_amount_inr")
    interest_rate = financial_terms.get("beneficiary_interest_rate_percent")

    why_this_scheme: list[str] = []
    if eligible:
        score = 75

        # Community alignment
        if category == "SC":
            score += 10
            why_this_scheme.append(
                "100% targeted coverage for Scheduled Caste (SC) applicants under NSFDC mandate."
            )

        # Income ceiling compliance (revised Jan 2026 guidelines)
        if income <= 500000:
            score += 5
            why_this_scheme.append(
                f"Annual family income (₹{income:,.0f}) is fully compliant with the official ceiling of ≤ ₹5,00,000."
            )

        # Women priority
        if is_women_target and normalized_gender == "female":
            score += 8
            why_this_scheme.append(
                "Priority beneficiary status under Women-Focused fund allocation (40% targeted quota) with lowest concessional interest."
            )

        # Loan requirement fit
        req_loan = user_data.get("required_loan")
        if req_loan and max_loan:
            if float(req_loan) <= float(max_loan):
                score += 5
                why_this_scheme.append(
                    f"Requested loan of ₹{float(req_loan):,.0f} is within scheme limit of ₹{float(max_loan):,.0f}."
                )
            else:
                why_this_scheme.append(
                    f"Maximum scheme loan limit of ₹{float(max_loan):,.0f} can fund a significant portion of your requirement."
                )
        elif max_loan:
            why_this_scheme.append(
                f"Offers loan coverage up to ₹{float(max_loan):,.0f} with up to 90-95% project cost financing."
            )

        # Interest rate advantage
        if interest_rate is not None:
            why_this_scheme.append(
                f"Subsidized beneficiary interest rate of only {interest_rate}% p.a. with flexible quarterly repayment after moratorium."
            )

        # VISVAS subvention benefit
        why_this_scheme.append(
            "Eligible for additional 5% p.a. interest subvention under VISVAS scheme on prompt repayment."
        )

        match_score = min(score, 98)
    else:
        satisfied_count = sum(1 for c in criterion_status if c.get("satisfied"))
        total_count = len(criterion_status) if criterion_status else 1
        match_score = max(10, round((satisfied_count / total_count) * 45))

    return {
        "scheme_id": scheme["id"],
        "scheme_name": scheme["name"],
        "short_name": scheme.get("short_name", scheme["id"]),
        "type": scheme["type"],
        "authority": scheme.get("authority", "NSFDC"),
        "eligible": eligible,
        "match_score": match_score,
        "why_this_scheme": why_this_scheme,
        "financial_terms": financial_terms,
        "required_documents": scheme.get("required_documents", {}),
        "application_steps": scheme.get("application_steps", []),
        "channel_requirements": scheme.get("channel_requirements", {}),
        "purpose": scheme.get("purpose", []),
        "reasons": reasons,
        "failures": failures,
        "criterion_status": criterion_status,
        "gender_status": gender_status,
    }


def evaluate_schemes(
    user_data: dict[str, Any],
    schemes: list[dict[str, Any]],
) -> list[dict[str, Any]]:

    results: list[dict[str, Any]] = []

    for scheme in schemes:
        result = check_scheme_eligibility(
            user_data,
            scheme,
        )

        results.append(result)

    return results
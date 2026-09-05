"""
Scheme Saathi AI Assistant Service.

Connects to Google Gemini 2.5 Flash via the official google-genai SDK.
Uses verified backend context: user profile, scheme data, rule-engine output,
deterministic EMI output, deterministic partner locator output.

AI is responsible for: ranking, explaining, translating, guiding.
AI is NOT responsible for: eligibility, EMI calculation, partner matching.
"""

import os
import json
import logging
import asyncio
from typing import Any

from google import genai
from google.genai import types

from services.languages import (
    get_language_info,
    is_supported_language,
    get_language_name,
)

logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Retrieve Gemini API key dynamically from environment."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def _get_model_name() -> str:
    """Retrieve Gemini model name dynamically from environment."""
    return os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip() or "gemini-2.5-flash"


_GENAI_CLIENT = None


def _get_genai_client() -> genai.Client | None:
    global _GENAI_CLIENT
    api_key = _get_api_key()
    if not api_key:
        return None
    if _GENAI_CLIENT is None:
        try:
            _GENAI_CLIENT = genai.Client(api_key=api_key)
        except Exception as e:
            logger.error("Failed to initialize GenAI client: %s", e)
            return None
    return _GENAI_CLIENT


SYSTEM_PROMPT = """You are the Scheme Saathi AI Assistant — an expert, friendly, and professional advisor dedicated to empowering marginalized entrepreneurs, particularly eligible Scheduled Caste (SC) beneficiaries, with government concessional financial schemes and business support.

ABOUT SCHEME SAATHI:
- Authority: National Scheduled Castes Finance and Development Corporation (NSFDC), Ministry of Social Justice and Empowerment, Government of India.
- Mission: Deliver transparent, accessible concessional credit and capacity building to uplift SC entrepreneurs, youth, and women across India.
- Platform Tools:
  1. "Find My Schemes" (Interactive eligibility rule engine for personalized matching)
  2. "Explore Schemes" (Comprehensive scheme catalog with financial parameters)
  3. "Financial & EMI Calculator" (Deterministic monthly installment and repayment planner)
  4. "Channel Partner Locator" (Locates nearest accredited State Channelizing Agencies and bank branches)
  5. "Documents Page" (Official checklist of mandatory verification documents)

VERIFIED SCHEME DIRECTORY:
1. Micro Finance Scheme (MFS):
   - Authority: NSFDC | Type: Primary Concessional Credit
   - Purpose: Small income-generating activities, tiny business, petty trade, self-employment
   - Maximum Project Cost: ₹1,40,000 | Maximum Loan: ₹1,25,000 (90% finance coverage)
   - Interest Rate: 6.5% p.a. | Repayment Tenure: 3 years | Moratorium: 3 months
   - Women Earmark: 40% of total funds are specifically targeted for women beneficiaries
   - Implementation Route: State Channelizing Agencies (SCAs) / Channel Partners

2. Aajeevika Micro-Finance Yojana (AMY):
   - Authority: NSFDC | Type: Primary Micro-Finance
   - Purpose: Micro-finance support for small business activities through non-banking channels
   - Maximum Project Cost: ₹1,40,000 | Maximum Loan: ₹1,25,000 (90% finance coverage)
   - Interest Rate: 15% p.a. | Repayment Tenure: 3 years | Moratorium: 3 months
   - Implementation Route: Selected NBFC-MFIs

3. Term Loan (TL / TERM_LOAN):
   - Authority: NSFDC | Type: Primary Term Financing
   - Purpose: Medium to large enterprises, commercial transport, service sector, manufacturing, agriculture
   - Project Cost Range: Above ₹1,40,000 up to ₹50,00,000
   - Maximum Loan: Up to ₹45,00,000 (up to 90% of project cost)
   - Interest Rates: Concessional tiered rates:
     * Loans up to ₹5.00 Lakh: 6% p.a. for women, 7% p.a. for others
     * Loans up to ₹50.00 Lakh: 8% p.a.
   - Repayment Tenure: 5 to 10 years | Moratorium: 6 to 12 months
   - Implementation Route: State Channelizing Agencies (SCAs) / Scheduled Commercial Banks

4. Udyam Nidhi Yojana (UNY):
   - Authority: NSFDC | Type: Primary Entrepreneurship Support
   - Purpose: Small/micro activities and scalable self-employment ventures
   - Maximum Project Cost: ₹5,00,000 | Maximum Loan: ₹4,50,000 (90% coverage)
   - Interest Rate: 13%–15% p.a. | Repayment Tenure: 3 to 5 years
   - Implementation Route: Cooperative Societies, Cooperative Banks, Small Finance Banks (SFBs)

5. Educational Loan Scheme (ELS):
   - Authority: NSFDC | Type: Higher Education Financing
   - Purpose: Full-time professional or technical education (Engineering, Medicine, MBA, Law, etc.) in recognized institutes
   - Loan Limits: Up to ₹20,00,000 in India; Up to ₹40,00,000 Abroad (covers up to 90% of expenses)
   - Interest Rate: 6.5% p.a. | Special Rebate: 0.5% interest concession for women (effective 6.0% p.a.)
   - Repayment Tenure: Up to 10 years | Moratorium: Full course duration + 6 months
   - Implementation Route: State Channelizing Agencies (SCAs) / Banks

6. VISVAS Yojana (Secondary Connected Scheme):
   - Full Name: Vanchit Ikai Samooh aur Vargon ki Aarthik Sahayata Yojana
   - Benefit: 5% direct annual interest subvention credited directly into beneficiary accounts for standard repayment under NSFDC/NBCFDC loans.

7. Alternative / National Schemes (Out-of-Scope):
   - PMEGP: KVIC subsidy (15%-35%) for projects up to ₹50L manufacturing / ₹20L service.
   - PM MUDRA Yojana: Loans up to ₹10L (Shishu, Kishore, Tarun) via commercial banks.
   - CGTMSE: Collateral-free credit guarantee for micro and small enterprises up to ₹5 Crore.

GENERAL ELIGIBILITY CRITERIA:
- Target Community: Scheduled Caste (SC) applicants holding a valid government caste certificate.
- Annual Family Income: Must not exceed ₹5,00,000 (₹5 Lakh) p.a. (revised policy effective Jan 7, 2026).
- Age: 18 years and above.
- Credit Standing: No defaults or non-performing loans with any financial institution.

REQUIRED DOCUMENTS CHECKLIST:
- Valid Caste Certificate from competent state revenue authority
- Income Certificate / Proof of annual family income <= ₹5,00,000
- Identity & Address Proof: Aadhaar Card, Voter ID, PAN Card, Ration Card
- Passport-size photographs
- Business project report, machinery quotations, or activity estimates (for business/term loans)
- Admission letter, fee schedule, and qualifying marksheets (for Educational Loan Scheme)
- Bank passbook copy with account number and IFSC

CHANNEL PARTNERS & APPLICATION ROUTE:
- Applications are submitted and processed through authorized State Channelizing Agencies (SCAs), Regional Rural Banks (RRBs), participating Public Sector Banks, or authorized NBFC-MFIs.
- NSFDC sanctions funds and refinances partner institutions.
- Direct walk-in to NSFDC HQ is not required; applicants apply through the nearest Channel Agency in their state/district.

GUIDELINES FOR ANSWERING:
- Answer ANY question the user asks about Scheme Saathi, government schemes, eligibility, loans, interest, EMIs, documents, application process, or channel partners.
- Be warm, encouraging, respectful, and authoritative.
- Structure responses clearly using bold text for scheme names, interest rates, and loan figures, bullet points for lists, and numbered steps for processes.
- If the user asks general questions without having run the scheme finder (e.g., "Tell me about eligibility schemes", "What schemes do you have?", "How much loan can I get for a shop?"):
  * Provide a clear, comprehensive, and helpful answer using the verified scheme details above.
  * Suggest they use "Find My Schemes" to evaluate their exact eligibility through the platform's automated rule engine, or "Explore Schemes" to browse all options.
- If user profile and rule engine results ARE provided in context:
  * Prioritize the user's specific eligible schemes.
  * Rank them based on the user's personal profile (purpose, project cost, loan required, interest rate, gender).
  * Output the ranking JSON block at the very end.
- If ineligibility details are present in context:
  * Explain the exact criteria from the rule engine transparently without false promises.
- Financial numbers: Always use exact verified figures (e.g. ₹1.25 Lakh, 6.5%, ₹5 Lakh income limit).
- Multilingual: Match the user's input language (English, Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Gujarati, etc.) naturally while preserving scheme names and numbers.
- For completely unrelated topics (movies, jokes, gaming, general coding, sports, weather), politely remind the user that you specialize exclusively in Scheme Saathi and government schemes.
- Always include the standard rule-engine authority disclaimer at the end of structured recommendations."""



def _build_user_context(
    user_profile: dict[str, Any] | None,
    eligible_schemes: list[dict[str, Any]] | None,
    ineligible_schemes: list[dict[str, Any]] | None,
    emi_output: dict[str, Any] | None,
    partner_output: dict[str, Any] | None,
    ineligibility_query: dict[str, Any] | None,
    out_of_scope_schemes: list[dict[str, Any]] | None = None,
) -> str:
    """Build the user context block for the LLM prompt."""
    parts = []

    if user_profile:
        parts.append("USER PROFILE:")
        profile_fields = {
            "name": user_profile.get("name"),
            "age": user_profile.get("age"),
            "gender": user_profile.get("gender"),
            "category": user_profile.get("category"),
            "state": user_profile.get("state"),
            "district": user_profile.get("district"),
            "annual_income": user_profile.get("annual_income"),
            "purpose": user_profile.get("purpose"),
            "business_type": user_profile.get("business_type"),
            "project_cost": user_profile.get("project_cost"),
            "required_loan": user_profile.get("required_loan"),
            "education_level": user_profile.get("education_level"),
            "course": user_profile.get("course"),
            "institution": user_profile.get("institution"),
        }
        for key, value in profile_fields.items():
            if value is not None and value != "":
                parts.append(f"- {key}: {value}")
        parts.append("")

    if eligible_schemes:
        parts.append("ELIGIBLE SCHEMES (from rule engine):")
        for scheme in eligible_schemes:
            parts.append(f"- {scheme.get('scheme_name', scheme.get('name', 'Unknown'))} (ID: {scheme.get('scheme_id', scheme.get('id', 'Unknown'))})")
            if scheme.get("type"):
                parts.append(f"  Type: {scheme['type']}")
            if scheme.get("reasons"):
                for reason in scheme["reasons"]:
                    parts.append(f"  Reason: {reason}")
            financial = scheme.get("financial_terms") or scheme.get("financial_terms_raw")
            if financial:
                parts.append(f"  Financial terms: {json.dumps(financial, default=str)}")
            source = scheme.get("source")
            if source:
                parts.append(f"  Source: {json.dumps(source, default=str)}")
            channel = scheme.get("channel_requirements")
            if channel:
                parts.append(f"  Channel requirements: {json.dumps(channel, default=str)}")
            docs = scheme.get("required_documents")
            if docs:
                parts.append(f"  Required documents: {json.dumps(docs, default=str)}")
            if scheme.get("application_steps"):
                parts.append(f"  Application steps: {json.dumps(scheme['application_steps'], default=str)}")
            if scheme.get("official_url"):
                parts.append(f"  Official URL: {scheme['official_url']}")
            if scheme.get("application_process_verified") is not None:
                parts.append(f"  Application process verified: {scheme['application_process_verified']}")
            if scheme.get("channel_partner_fallback_needed"):
                parts.append("  NOTE: Complete application process is NOT verified. If user asks how to apply, recommend the Channel Partner Locator and use deterministic partner data.")
        parts.append("")
    else:
        parts.append("SCHEME SAATHI MASTER SCHEMES DIRECTORY:")
        parts.append("- Micro Finance Scheme (MFS): Small income-generating activities / petty business. Project cost up to ₹1,40,000, loan up to ₹1,25,000 (90% finance). Concessional 6.5% interest p.a., 3 years repayment with 3 months moratorium. 40% funds earmarked for women entrepreneurs. Channel: SCAs/Channel Partners.")
        parts.append("- Aajeevika Micro-Finance Yojana (AMY): Micro-finance support for small business through NBFC-MFIs. Project cost up to ₹1,40,000, loan up to ₹1,25,000. 15% interest p.a., 3 years tenure, 3 months moratorium.")
        parts.append("- Term Loan (TL / TERM_LOAN): Medium to large income-generating projects, transport, services, manufacturing. Project cost from ₹1,40,000 up to ₹50,00,000, loan up to ₹45,00,000 (90% coverage). Tiered interest: up to ₹5L: 6% for women, 7% for others; up to ₹50L: 8% p.a. Tenure 5-10 years, moratorium 6-12 months. Channel: SCAs/Banks.")
        parts.append("- Udyam Nidhi Yojana (UNY): Micro/small entrepreneurship. Project cost up to ₹5,00,000, loan up to ₹4,50,000. 13%–15% interest p.a., 3 to 5 years tenure. Channel: Cooperative Banks/Societies/SFBs.")
        parts.append("- Educational Loan Scheme (ELS): Full-time professional and technical higher education. Loans up to ₹20,00,000 in India, up to ₹40,00,000 Abroad (up to 90% expenses). 6.5% interest p.a. (0.5% rebate for women = 6.0% p.a.). Repayment up to 10 years, moratorium course + 6 months. Channel: SCAs/Banks.")
        parts.append("- VISVAS Yojana (Secondary Scheme): 5% direct interest subvention for eligible prompt-repaying borrowers under NSFDC.")
        parts.append("- Alternative General Schemes (Out of Scope): PMEGP (15%-35% subsidy up to ₹50L manufacturing / ₹20L services), PM MUDRA (up to ₹10L), CGTMSE (credit guarantee).")
        parts.append("- General Eligibility: Scheduled Caste (SC) with valid caste certificate, annual family income <= ₹5,00,000, age 18+, no active bank defaults.")
        parts.append("")

    if ineligible_schemes:

        parts.append("INELIGIBLE SCHEMES (from rule engine):")
        for scheme in ineligible_schemes:
            parts.append(f"- {scheme.get('scheme_name', scheme.get('name', 'Unknown'))} (ID: {scheme.get('scheme_id', scheme.get('id', 'Unknown'))})")
            if scheme.get("type"):
                parts.append(f"  Type: {scheme['type']}")
            if scheme.get("failures"):
                for failure in scheme["failures"]:
                    parts.append(f"  Failure reason: {failure}")
            criterion_status = scheme.get("criterion_status")
            if criterion_status:
                parts.append("  Criterion-level status:")
                for c in criterion_status:
                    status_marker = "✓" if c.get("satisfied") else "✗"
                    parts.append(
                        f"    {status_marker} {c.get('criterion', 'unknown')}: "
                        f"{c.get('user_value', 'N/A')} "
                        f"(required: {c.get('required', 'N/A')}) — "
                        f"{c.get('message', '')}"
                    )
            financial = scheme.get("financial_terms") or scheme.get("financial_terms_raw")
            if financial:
                parts.append(f"  Financial terms: {json.dumps(financial, default=str)}")
            eligibility = scheme.get("eligibility") or scheme.get("eligibility_criteria")
            if eligibility:
                parts.append(f"  Eligibility criteria: {json.dumps(eligibility, default=str)}")
        parts.append("")

    if out_of_scope_schemes:
        parts.append("OUT-OF-SCOPE SCHEMES (verified but outside Scheme Saathi):")
        for scheme in out_of_scope_schemes:
            parts.append(f"- {scheme.get('name', 'Unknown')}")
            if scheme.get("official_url"):
                parts.append(f"  Official URL: {scheme['official_url']}")
            if scheme.get("reason"):
                parts.append(f"  Reason: {scheme['reason']}")
        parts.append("")

    if ineligibility_query:
        parts.append("USER INELIGIBILITY QUESTION:")
        parts.append(f"- Scheme: {ineligibility_query.get('scheme_name', 'Unknown')}")
        parts.append(f"- Scheme ID: {ineligibility_query.get('scheme_id', 'Unknown')}")
        failure_reasons = ineligibility_query.get("failure_reasons", [])
        if failure_reasons:
            parts.append("- Rule engine failure reasons:")
            for reason in failure_reasons:
                parts.append(f"  * {reason}")
        parts.append("")

    if emi_output:
        parts.append("DETERMINISTIC EMI CALCULATOR OUTPUT:")
        parts.append(f"- Scheme: {emi_output.get('scheme_name', 'N/A')}")
        parts.append(f"- Principal: ₹{emi_output.get('principal', 'N/A')}")
        parts.append(f"- Interest rate: {emi_output.get('interest_rate', 'N/A')}% p.a.")
        parts.append(f"- Tenure: {emi_output.get('tenure_months', 'N/A')} months")
        parts.append(f"- Monthly EMI: ₹{emi_output.get('monthly_emi', 'N/A')}")
        parts.append(f"- Total interest: ₹{emi_output.get('total_interest', 'N/A')}")
        parts.append(f"- Total repayment: ₹{emi_output.get('total_repayment', 'N/A')}")
        if emi_output.get("moratorium_months"):
            parts.append(f"- Moratorium: {emi_output['moratorium_months']} months")
        if emi_output.get("moratorium_treatment"):
            parts.append(f"- Moratorium treatment: {emi_output['moratorium_treatment']}")
        parts.append("")

    if partner_output:
        parts.append("DETERMINISTIC CHANNEL PARTNER LOCATOR OUTPUT:")
        partners = partner_output.get("partners", [])
        if partners:
            for i, partner in enumerate(partners[:5], 1):
                parts.append(f"  Partner {i}:")
                parts.append(f"    Name: {partner.get('name', 'N/A')}")
                parts.append(f"    Type: {partner.get('type', 'N/A')}")
                parts.append(f"    Distance: {partner.get('distance_km', 'N/A')} km")
                parts.append(f"    Supported categories: {partner.get('supported_loan_categories', [])}")
                parts.append(f"    Max loan handled: ₹{partner.get('max_loan_amount_handled', 'N/A')}")
                if partner.get("address"):
                    parts.append(f"    Address: {partner['address']}")
                if partner.get("contact"):
                    parts.append(f"    Contact: {partner['contact']}")
                if partner.get("website") or partner.get("official_url"):
                    parts.append(f"    Website: {partner.get('website') or partner.get('official_url')}")
        else:
            parts.append("  No verified eligible Channel Partners found.")
        parts.append("")

    return "\n".join(parts)


def _detect_language_from_text(text: str) -> str:
    """Simple heuristic to detect if text contains specific language scripts.

    For scripts not covered, returns 'und' (undefined) instead of defaulting
    to English, so that the caller can keep the user's explicit language
    selection rather than silently switching to English.
    """
    text_lower = text.lower()

    devanagari_range = any("\u0900" <= ch <= "\u097f" for ch in text)
    bengali_range = any("\u0980" <= ch <= "\u09ff" for ch in text)
    tamil_range = any("\u0b80" <= ch <= "\u0bff" for ch in text)
    telugu_range = any("\u0c00" <= ch <= "\u0c7f" for ch in text)
    kannada_range = any("\u0c80" <= ch <= "\u0cff" for ch in text)
    malayalam_range = any("\u0d00" <= ch <= "\u0d7f" for ch in text)
    gujarati_range = any("\u0a80" <= ch <= "\u0aff" for ch in text)
    gurmukhi_range = any("\u0a00" <= ch <= "\u0a7f" for ch in text)
    odia_range = any("\u0b00" <= ch <= "\u0b7f" for ch in text)
    ol_chiki_range = any("\u1c50" <= ch <= "\u1c7f" for ch in text)  # Santali
    meitei_range = any("\uabc0" <= ch <= "\uabff" for ch in text)    # Manipuri (Meitei Mayek)

    hinglish_indicators = [
        "kya", "hai", "ka", "ki", "ke", "ko", "mein", "se", "ko",
        "yaar", "bhai", "bahut", "accha", "theek", "chahiye",
        "hoon", "hain", "tha", "thi", "hoga", "karna", "karo",
        "mujhe", "mera", "meri", "hamara", "unka", "uska",
        "kaunsi", "konsa", "kitna", "kab", "kaise", "kyun",
    ]

    hindi_words = [
        "aur", "yeh", "woh", "yahan", "wahan", "abhi", "phir",
        "lekin", "agar", "toh", "kyunki", "jaise", "sirf", "bhi",
    ]

    marathi_words = [
        "आहे", "आहेत", "होता", "होते", "होतो", "करा", "करत", "केले",
        "तुम्ही", "तुम्हाला", "मी", "माझे", "माझ्या", "तुमचे", "तुमच्या",
        "येथे", "तेथे", "कुठे", "कसे", "काय", "का", "पण", "म्हणून",
    ]

    nepali_words = [
        "छ", "छन्", "हो", "होइन", "गर्नु", "गरेको", "भएको", "हुन्छ",
        "तपाईं", "तिमी", "म", "मेरो", "तिम्रो", "तपाईंको", "हाम्रो",
        "यहाँ", "त्यहाँ", "कहाँ", "कसरी", "किन", "र", "तर", "पनि",
    ]

    sanskrit_words = [
        "अस्ति", "सन्ति", "करोति", "कुर्वन्ति", "भवति", "भवन्ति",
        "त्वम्", "भवान्", "अहम्", "मम", "तव", "भवतः", "अस्माकम्",
        "अत्र", "तत्र", "कुत्र", "कथम्", "किम्", "च", "तत्", "पि",
    ]

    if devanagari_range:
        # Check for Marathi-specific words first
        if any(w in text for w in marathi_words):
            return "mr"
        # Check for Nepali-specific words
        if any(w in text for w in nepali_words):
            return "ne"
        # Check for Sanskrit-specific words
        if any(w in text for w in sanskrit_words):
            return "sa"
        # Check for Hindi/Hinglish indicators
        if any(w in text_lower for w in ["ka", "ki", "ke", "hai", "kya", "mein"]):
            return "hi"
        if any(w in text_lower for w in ["raha", "ne", "ko", "se", "par"]):
            return "hi"
        # Default to Hindi for Devanagari if no specific language detected
        return "hi"

    if bengali_range:
        return "bn"
    if tamil_range:
        return "ta"
    if telugu_range:
        return "te"
    if kannada_range:
        return "kn"
    if malayalam_range:
        return "ml"
    if gujarati_range:
        return "gu"
    if gurmukhi_range:
        return "pa"
    if odia_range:
        return "or"
    if ol_chiki_range:
        return "sat"
    if meitei_range:
        return "mni"

    hinglish_score = sum(1 for w in hinglish_indicators if w in text_lower)
    hindi_score = sum(1 for w in hindi_words if w in text_lower)

    if hinglish_score >= 2 or hindi_score >= 2:
        return "hi"

    # For Latin-only text that doesn't match any non-English indicators,
    # return 'und' (undefined) so the caller keeps the explicit language
    # selection instead of assuming English.
    return "und"


def _detect_language(message: str, user_language: str | None) -> tuple[str, bool]:
    """Detect the language of the user message.

    Returns (language_code, is_detected).
    Priority: explicit > detected from text.
    If the detected language is 'und' (undefined), keep the user's
    explicit selection; never force English.
    """
    if user_language and is_supported_language(user_language):
        return user_language, False

    detected = _detect_language_from_text(message)

    # 'und' means the script was not recognised; keep the user's
    # explicit language selection rather than defaulting to English.
    if detected == "und":
        if user_language and is_supported_language(user_language):
            return user_language, False
        return "en", True

    return detected, True


async def _call_gemini(
    system_prompt: str,
    user_message: str,
    context: str,
) -> str | None:
    """Call Google Gemini and return the response text.

    Uses the proper ``system_instruction`` config parameter so that the
    system prompt is treated as a system-level instruction by the model
    rather than appearing as a user message.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable is not set")
        return None

    client = _get_genai_client()
    if not client:
        logger.error("Failed to initialize GenAI client")
        return None

    model_name = _get_model_name()

    full_user_content = (
        f"{context}\n\n"
        f"USER MESSAGE:\n{user_message}\n\n"
        f"RESPOND IN THE USER'S LANGUAGE. Be clear, polite, structured, and professional. "
        f"Format key scheme names, figures (amounts, interest rates, tenure), and requirements with markdown bold (**), bullet points, and numbered lists."
    )

    max_retries = 2
    retry_delay = 1.0

    for attempt in range(max_retries):
        try:
            def _generate_sync():
                return client.models.generate_content(
                    model=model_name,
                    contents=types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=full_user_content)],
                    ),
                    config=types.GenerateContentConfig(
                        system_instruction=types.Content(
                            parts=[types.Part.from_text(text=system_prompt)],
                        ),
                        temperature=0.3,
                        top_p=0.9,
                        max_output_tokens=2048,
                    ),
                )

            response = await asyncio.to_thread(_generate_sync)

            if response and response.text:
                return response.text

            logger.warning("Gemini model %s returned empty response", model_name)

        except Exception as e:
            error_str = str(e)
            logger.warning("Gemini attempt %d failed: %s", attempt + 1, error_str)
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2

    return None




def _build_disclaimer() -> str:
    return (
        "Eligibility is determined by Scheme Saathi's rule engine. "
        "EMI figures are computed by the deterministic calculator. "
        "Channel Partner matches are based on available verified partner data. "
        "Final approval is decided by the concerned authority/lending institution."
    )


def _parse_ai_ranking(
    reply: str,
    eligible_schemes: list[dict[str, Any]] | None,
) -> list[dict[str, Any]] | None:
    """Parse the AI's structured ranking from the response text.

    Looks for <!--RANKING_START-->...<!--RANKING_END--> JSON block.
    Validates that all scheme IDs exist in the eligible schemes list.
    Validates that scores are numeric 0-100.
    Returns None if parsing fails or validation fails.
    """
    if not reply or not eligible_schemes:
        return None

    # Extract the ranking block between markers
    start_marker = "<!--RANKING_START-->"
    end_marker = "<!--RANKING_END-->"

    start_idx = reply.find(start_marker)
    end_idx = reply.find(end_marker)

    if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
        logger.info("No ranking block found in AI response")
        return None

    ranking_text = reply[start_idx + len(start_marker):end_idx].strip()

    if not ranking_text:
        return None

    # Parse JSON
    try:
        ranking_data = json.loads(ranking_text)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse ranking JSON: %s", str(e))
        return None

    ranking_list = ranking_data.get("ranking")
    if not isinstance(ranking_list, list) or len(ranking_list) == 0:
        logger.warning("Ranking JSON missing 'ranking' array or empty")
        return None

    # Build set of valid eligible scheme IDs
    valid_ids = set()
    scheme_lookup = {}
    for scheme in eligible_schemes:
        sid = scheme.get("scheme_id") or scheme.get("id", "")
        if sid:
            valid_ids.add(sid)
            scheme_lookup[sid] = scheme

    # Build verified URL set from backend scheme data
    verified_urls: set[str] = set()
    for scheme in eligible_schemes:
        source = scheme.get("source") or {}
        if source.get("official_url"):
            verified_urls.add(source["official_url"].rstrip("/"))
        if source.get("policy_registry_url"):
            verified_urls.add(source["policy_registry_url"].rstrip("/"))

    # Validate and build result
    validated = []
    seen_ids = set()

    for entry in ranking_list:
        if not isinstance(entry, dict):
            continue

        scheme_id = entry.get("scheme_id", "")
        score = entry.get("score")
        reason = entry.get("reason", "")
        official_url = entry.get("official_url")

        # Validate scheme_id
        if not scheme_id or scheme_id not in valid_ids:
            logger.warning("AI ranked unknown scheme_id: %s", scheme_id)
            continue

        # Prevent duplicates
        if scheme_id in seen_ids:
            continue
        seen_ids.add(scheme_id)

        # Validate score — must be numeric 0-100
        if not isinstance(score, (int, float)) or score < 1 or score > 100:
            logger.warning(
                "Invalid score %s for scheme %s, defaulting to 50",
                score, scheme_id,
            )
            score = 50

        # Validate URL — strip if not from verified backend data
        if official_url:
            if official_url.rstrip("/") not in verified_urls:
                logger.warning(
                    "AI provided unverified URL for scheme %s: %s — stripping",
                    scheme_id, official_url,
                )
                official_url = None

        scheme = scheme_lookup[scheme_id]

        validated.append({
            "scheme_id": scheme_id,
            "scheme_name": scheme.get("scheme_name") or scheme.get("name", ""),
            "score": int(score),
            "reason": reason if isinstance(reason, str) else "",
            "official_url": official_url,
        })

    if not validated:
        logger.warning("No valid entries in AI ranking")
        return None

    # Sort by score descending (highest = best fit)
    validated.sort(key=lambda x: x["score"], reverse=True)

    return validated


def _strip_ranking_markers(reply: str) -> str:
    """Remove the <!--RANKING_START-->...<!--RANKING_END--> block from the reply text."""
    start_marker = "<!--RANKING_START-->"
    end_marker = "<!--RANKING_END-->"

    start_idx = reply.find(start_marker)
    end_idx = reply.find(end_marker)

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        # Remove the block and any surrounding whitespace
        cleaned = reply[:start_idx].rstrip() + reply[end_idx + len(end_marker):]
        return cleaned.strip()

    return reply


def _extract_structured_data(
    reply: str,
    eligible_schemes: list[dict[str, Any]] | None,
    emi_output: dict[str, Any] | None,
    partner_output: dict[str, Any] | None,
    ineligibility_query: dict[str, Any] | None,
    out_of_scope_schemes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Extract structured response fields, using AI ranking when available.

    Attempts to parse AI-generated ranking from the reply.
    Falls back to rule-engine order if parsing fails.
    Validates scheme IDs, scores, and URLs against backend data.
    """
    result: dict[str, Any] = {
        "disclaimer": _build_disclaimer(),
    }

    if eligible_schemes and len(eligible_schemes) > 0:
        # Try to parse AI ranking
        ai_ranking = _parse_ai_ranking(reply, eligible_schemes)

        if ai_ranking and len(ai_ranking) > 0:
            # AI ranking succeeded — use it
            best = ai_ranking[0]
            result["primary_recommendation"] = {
                "scheme_id": best["scheme_id"],
                "scheme_name": best["scheme_name"],
                "rank": 1,
                "score": best["score"],
                "reasons": [best["reason"]] if best["reason"] else [],
                "official_url": best.get("official_url"),
            }

            if len(ai_ranking) > 1:
                others = []
                for i, entry in enumerate(ai_ranking[1:], 2):
                    others.append({
                        "scheme_id": entry["scheme_id"],
                        "scheme_name": entry["scheme_name"],
                        "rank": i,
                        "score": entry["score"],
                        "reasons": [entry["reason"]] if entry["reason"] else [],
                        "official_url": entry.get("official_url"),
                    })
                result["other_eligible_schemes"] = others

            logger.info("Using AI ranking with %d schemes", len(ai_ranking))
        else:
            # Fallback: use rule-engine order
            top = eligible_schemes[0]
            top_source = top.get("source") or {}
            result["primary_recommendation"] = {
                "scheme_id": top.get("scheme_id", top.get("id", "")),
                "scheme_name": top.get("scheme_name", top.get("name", "")),
                "rank": 1,
                "score": None,
                "reasons": top.get("reasons", []),
                "official_url": top_source.get("official_url"),
            }

            if len(eligible_schemes) > 1:
                others = []
                for i, scheme in enumerate(eligible_schemes[1:], 2):
                    scheme_source = scheme.get("source") or {}
                    others.append({
                        "scheme_id": scheme.get("scheme_id", scheme.get("id", "")),
                        "scheme_name": scheme.get("scheme_name", scheme.get("name", "")),
                        "rank": i,
                        "score": None,
                        "reasons": scheme.get("reasons", []),
                        "official_url": scheme_source.get("official_url"),
                    })
                result["other_eligible_schemes"] = others

            logger.info("AI ranking unavailable, using rule-engine order")

    if emi_output:
        result["emi_projection"] = emi_output

    if partner_output:
        result["matched_channel_partners"] = partner_output.get("partners", [])

    if ineligibility_query:
        result["ineligibility_explanations"] = [{
            "scheme_id": ineligibility_query.get("scheme_id", ""),
            "scheme_name": ineligibility_query.get("scheme_name", ""),
            "failure_reasons": ineligibility_query.get("failure_reasons", []),
            "criterion_status": ineligibility_query.get("criterion_status", []),
        }]

    if out_of_scope_schemes:
        result["out_of_scope_schemes"] = [
            {
                "name": s.get("name", "Unknown"),
                "official_url": s.get("official_url"),
                "reason": s.get("reason", ""),
            }
            for s in out_of_scope_schemes
        ]

    # Build application guidance from eligible schemes
    if eligible_schemes:
        guidance_items = []
        for scheme in eligible_schemes:
            sid = scheme.get("scheme_id") or scheme.get("id", "")
            scheme_name = scheme.get("scheme_name") or scheme.get("name", "")
            app_verified = scheme.get("application_process_verified", False)
            app_steps = scheme.get("application_steps")
            official_url = scheme.get("official_url")
            channel_req = scheme.get("channel_requirements")
            needs_partner = scheme.get("channel_partner_fallback_needed", False)

            if app_verified and app_steps:
                guidance_items.append({
                    "scheme_id": sid,
                    "scheme_name": scheme_name,
                    "status": "verified",
                    "application_steps": app_steps,
                    "official_url": official_url,
                })
            elif needs_partner:
                guidance_items.append({
                    "scheme_id": sid,
                    "scheme_name": scheme_name,
                    "status": "channel_partner_needed",
                    "message": "Complete application process is not verified. Channel Partner assistance is recommended.",
                    "official_url": official_url,
                    "channel_requirements": channel_req,
                })
            elif official_url:
                guidance_items.append({
                    "scheme_id": sid,
                    "scheme_name": scheme_name,
                    "status": "partial",
                    "official_url": official_url,
                    "message": "Limited application information available. Please check the official website.",
                })

        if guidance_items:
            result["application_guidance"] = guidance_items

    return result


def _build_knowledge_fallback(message: str, language_key: str) -> str:
    """Smart knowledge-based fallback response if the LLM API is unavailable."""
    msg_lower = message.lower()

    if any(w in msg_lower for w in ["eligib", "criteria", "qualif", "paatr", "पात्रता", "income", "आय", "limit"]):
        return (
            "### Scheme Saathi Eligibility Criteria\n\n"
            "To qualify for concessional financial schemes under Scheme Saathi (NSFDC):\n\n"
            "- **Community**: Scheduled Caste (SC) with a valid state caste certificate\n"
            "- **Annual Family Income**: Up to **₹5,00,000 (₹5 Lakh)** p.a. (revised by NSFDC from Jan 7, 2026)\n"
            "- **Age**: 18 years and above\n"
            "- **Credit Standing**: Clean financial discipline with no existing bank defaults\n\n"
            "💡 *Tip: Use the **Find My Schemes** tool to check your exact personalized eligibility!*"
        )
    elif any(w in msg_lower for w in ["mfs", "micro finance", "microfinance", "small business", "chhota"]):
        return (
            "### Micro Finance Scheme (MFS)\n\n"
            "- **Authority**: NSFDC (Ministry of Social Justice and Empowerment)\n"
            "- **Purpose**: Small income-generating activities, petty shops, tailoring, handicrafts, tiny business\n"
            "- **Project Cost Limit**: Up to **₹1,40,000**\n"
            "- **Loan Amount**: Up to **₹1,25,000** (90% finance coverage)\n"
            "- **Interest Rate**: **6.5% p.a.**\n"
            "- **Repayment Tenure**: 3 years with a **3-month moratorium**\n"
            "- **Women Benefit**: **40% of total funds** are specifically earmarked for women beneficiaries\n"
            "- **How to Apply**: Through nearest State Channelizing Agency (SCA) or Channel Partner"
        )
    elif any(w in msg_lower for w in ["term loan", "termloan", "tl", "bada loan", "industry", "transport"]):
        return (
            "### Term Loan (TL)\n\n"
            "- **Purpose**: Commercial ventures, transport vehicles, service sector, manufacturing, agriculture\n"
            "- **Project Cost**: Above **₹1,40,000** up to **₹50,00,000**\n"
            "- **Maximum Loan**: Up to **₹45,00,000** (up to 90% of project cost)\n"
            "- **Interest Rates**:\n"
            "  * Loans up to ₹5.00 Lakh: **6% p.a. for women**, **7% p.a. for others**\n"
            "  * Loans up to ₹50.00 Lakh: **8% p.a.**\n"
            "- **Repayment**: 5 to 10 years with a **6 to 12 months moratorium**\n"
            "- **Implementation**: State Channelizing Agencies (SCAs) and Scheduled Commercial Banks"
        )
    elif any(w in msg_lower for w in ["educat", "els", "padhai", "study", "college", "foreign", "shiksha"]):
        return (
            "### Educational Loan Scheme (ELS)\n\n"
            "- **Purpose**: Higher professional & technical degrees (Engineering, Medicine, Management, Law) in India or abroad\n"
            "- **Loan Ceiling**: Up to **₹20,00,000 in India**; up to **₹40,00,000 Abroad** (covers up to 90% of course fee & living expenses)\n"
            "- **Interest Rate**: **6.5% p.a.** (Women receive an additional **0.5% rebate = 6.0% p.a.**)\n"
            "- **Repayment**: Up to 10 years; **Moratorium**: Full course duration + 6 months\n"
            "- **Implementation**: SCAs and Banks"
        )
    elif any(w in msg_lower for w in ["women", "female", "mahila", "aurat", "ladies", "ladki"]):
        return (
            "### Concessions & Priority for Women in Scheme Saathi\n\n"
            "Scheme Saathi prioritizes women entrepreneurs with special quotas and lower interest rates:\n\n"
            "1. **Micro Finance Scheme (MFS)**: **40% of funds** are exclusively targeted for women entrepreneurs at **6.5% p.a.**\n"
            "2. **Term Loan (TL)**: Special concessional **6% p.a. interest rate** (1% below standard rate) for loans up to ₹5.00 Lakh\n"
            "3. **Educational Loan Scheme (ELS)**: **0.5% interest rebate**, reducing the rate to **6.0% p.a.** for female students\n\n"
            "You can use **Find My Schemes** to discover all schemes tailored for your profile!"
        )
    elif any(w in msg_lower for w in ["doc", "paper", "dastavej", "certificate", "praman", "kagaz"]):
        return (
            "### Required Documents Checklist\n\n"
            "To apply for Scheme Saathi schemes, please have these documents ready:\n\n"
            "1. **Valid Caste Certificate** issued by a competent revenue authority (Scheduled Caste)\n"
            "2. **Income Certificate / Proof** demonstrating annual family income <= ₹5,00,000\n"
            "3. **Identity & Address Proof** (Aadhaar Card, Voter ID, PAN Card, Ration Card)\n"
            "4. **Passport-size Photographs**\n"
            "5. **Project Report / Quotations / Cost Estimates** (for business and term loans)\n"
            "6. **Admission Letter & Fee Structure** (for Educational Loan Scheme)\n"
            "7. **Bank Passbook Copy** with account number and IFSC code"
        )
    elif any(w in msg_lower for w in ["emi", "calculator", "kist", "calculate", "monthly"]):
        return (
            "### Financial & EMI Calculator\n\n"
            "Scheme Saathi has a built-in **Financial & EMI Calculator**!\n\n"
            "- Calculate your exact monthly EMI based on verified NSFDC interest rates (6% to 8% p.a.)\n"
            "- Factor in moratorium relief periods (3 months for MFS, 6–12 months for Term Loans)\n"
            "- View total interest payable and an amortized repayment timeline\n\n"
            "Navigate to the **EMI Calculator** from the top menu or dashboard to test your loan numbers."
        )
    elif any(w in msg_lower for w in ["partner", "locator", "bank", "branch", "sca", "kaha", "agency"]):
        return (
            "### Channel Partners & Application Centers\n\n"
            "Scheme Saathi schemes are delivered through verified **Channel Partners**:\n\n"
            "- **State Channelizing Agencies (SCAs)** in your state\n"
            "- **Participating Scheduled Commercial Banks** and Regional Rural Banks (RRBs)\n"
            "- **Authorized NBFC-MFIs** (for micro-finance schemes like AMY)\n\n"
            "Use the **Channel Partner Locator** on the platform to locate the nearest office or branch in your district!"
        )
    elif any(w in msg_lower for w in ["visvas", "subvention"]):
        return (
            "### VISVAS Yojana (Interest Subvention Scheme)\n\n"
            "- **Full Title**: Vanchit Ikai Samooh aur Vargon ki Aarthik Sahayata Yojana\n"
            "- **Benefit**: **5% direct annual interest subvention** credited directly into beneficiary bank accounts\n"
            "- **Eligibility**: SC/OBC Self-Help Groups (SHGs) and individuals with standard, active loan accounts under NSFDC or NBCFDC schemes"
        )
    else:
        return (
            "### Welcome to Scheme Saathi AI Assistant!\n\n"
            "I can assist you with all government concessional schemes under the **National Scheduled Castes Finance and Development Corporation (NSFDC)**, Ministry of Social Justice and Empowerment:\n\n"
            "- **Micro Finance Scheme (MFS)**: Loans up to ₹1.25 Lakh at 6.5% interest (40% earmarked for women)\n"
            "- **Term Loan (TL)**: Loans up to ₹45 Lakh (projects up to ₹50 Lakh) at 6%–8% interest\n"
            "- **Educational Loan (ELS)**: Up to ₹20L in India / ₹40L abroad at 6.0%–6.5% interest\n"
            "- **Udyam Nidhi Yojana (UNY)**: Entrepreneurship loans up to ₹4.5 Lakh\n"
            "- **VISVAS Yojana**: 5% direct interest subvention for timely repayment\n\n"
            "Feel free to ask any question about eligibility, loan amounts, documents, or click **Find My Schemes** to check your personalized match!"
        )


async def get_ai_response(

    message: str,
    language: str | None = None,
    user_profile: dict[str, Any] | None = None,
    eligible_schemes: list[dict[str, Any]] | None = None,
    ineligible_schemes: list[dict[str, Any]] | None = None,
    emi_output: dict[str, Any] | None = None,
    partner_output: dict[str, Any] | None = None,
    ineligibility_query: dict[str, Any] | None = None,
    out_of_scope_schemes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Main entry point: get an AI response for the user's message."""

    language_used, language_detected = _detect_language(message, language)

    # Pre-language fallback messages (in the user's selected language when possible)
    _FALLBACK_MESSAGES = {
        "en": (
            "AI Assistant is temporarily unavailable. "
            "Please try again later or use the Financial Calculator and Partner Locator directly. "
            "Your scheme eligibility is always determined by the backend rule engine, not by the AI."
        ),
        "hi": (
            "AI सहायक अस्थायी रूप से उपलब्ध नहीं है। "
            "कृपया बाद में पुनः प्रयास करें या सीधे वित्तीय कैलकुलेटर और पार्टनर लोकेटर का उपयोग करें। "
            "आपकी योजना पात्रता हमेशा बैकएंड नियम इंजन द्वारा निर्धारित होती है, AI द्वारा नहीं।"
        ),
        "bn": (
            "AI সহকারী সাময়িকভাবে অনুপলব্ধ। "
            "অনুগ্রহ করে পরে আবার চেষ্টা করুন অথবা সরাসরি আর্থিক ক্যালকুলেটর এবং পার্টনার লোকেটর ব্যবহার করুন। "
            "আপনার স্কিম যোগ্যতা সর্বদা ব্যাকএন্ড নিয়ম ইঞ্জিন দ্বারা নির্ধারিত হয়, AI দ্বারা নয়।"
        ),
        "ta": (
            "AI உதவியாளர் தற்காலிகமாக கிடைக்கவில்லை. "
            "தயவுசெய்து பின்னர் மீண்டும் முயற்சிக்கவும் அல்லது நேரடியாக நிதிக் கணிப்பான் மற்றும் கூட்டாளர் லொகேட்டரைப் பயன்படுத்தவும். "
            "உங்கள் திட்ட தகுதி எப்போதும் பின்தள விதிகள் இயந்திரத்தால் நிர்ணயிக்கப்படுகிறது, AI அல்ல."
        ),
        "te": (
            "AI సహాయకుడు తాత్కాలికంగా అందుబాటులో లేడు. "
            "దయచేసి తర్వాత మళ్ళీ ప్రయత్నించండి లేదా నేరుగా ఫైనాన్షియల్ కాల్క్యులేటర్ మరియు పార్ట్నర్ లొకేటర్ ఉపయోగించండి. "
            "మీ పథక అర్హత ఎల్లప్పుడూ బ్యాకెండ్ నియమ ఇంజిన్ ద్వారా నిర్ణయించబడుతుంది, AI ద్వారా కాదు."
        ),
        "mr": (
            "AI सहाय्यक तात्पुरत्या उपलब्ध नाही. "
            "कृपया नंतर पुन्हा प्रयत्न करा किंवा थेट आर्थिक कॅल्क्युलेटर आणि पार्टनर लोकेटर वापरा. "
            "तुमच्या योजनेची पात्रता नेहमी बॅकएंड नियम इंजिनद्वारे ठरवली जाते, AI द्वारे नाही."
        ),
        "gu": (
            "AI સહાયક હાલ પ્રકારે ઉપલબ્ધ નથી. "
            "કૃપા કરીને પછીથી ફરી પ્રયાસ કરો અથવા સીધા નાણાકીય કેલ્ક્યુલેટર અને પાર્ટનર લોકેટરનો ઉપયોગ કરો. "
            "તમારી યોજનાની પાત્રતા હંમેશા બેકએન્ડ નિયમ એન્જિન દ્વારા નક્કી થાય છે, AI દ્વારા નહીં."
        ),
        "kn": (
            "AI ಸಹಾಯಕ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. "
            "ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನೇರವಾಗಿ ಹಣಕಾಸು ಕ್ಯಾಲ್ಕುಲೇಟರ್ ಮತ್ತು ಪಾರ್ಟ್ನರ್ ಲೊಕೇಟರ್ ಬಳಸಿ. "
            "ನಿಮ್ಮ ಯೋಜನೆ ಅರ್ಹತೆಯನ್ನು ಯಾವಾಗಲೂ ಬ್ಯಾಕೆಂಡ್ ನಿಯಮ ಎಂಜಿನ್ ನಿರ್ಧರಿಸುತ್ತದೆ, AI ಅಲ್ಲ."
        ),
        "ml": (
            "AI സഹായകൻ താൽക്കാലികമായി ലഭ്യമല്ല. "
            "ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ നേരിട്ട് ഫിനാൻഷ്യൽ കാൽക്കുലേറ്ററും പാർട്ണർ ലൊക്കേറ്ററും ഉപയോഗിക്കുക. "
            "നിങ്ങളുടെ സ്കീം യോഗ്യത എപ്പോഴും ബാക്കെൻഡ് റൂൾ എഞ്ചിൻ നിർണ്ണയിക്കുന്നു, AI അല്ല."
        ),
        "pa": (
            "AI ਸਹਾਇਕ ਅਸਥਾਈ ਤੌਰ 'ਤੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ. "
            "ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਸਿੱਧੇ ਤੌਰ 'ਤੇ ਵਿੱਤੀ ਕੈਲਕੁਲੇਟਰ ਅਤੇ ਪਾਰਟਨਰ ਲੋਕੇਟਰ ਦੀ ਵਰਤੋਂ ਕਰੋ. "
            "ਤੁਹਾਡੀ ਸਕੀਮ ਯੋਗਤਾ ਹਮੇਸ਼ਾ ਬੈਕਐਂਡ ਨਿਯਮ ਇੰਜਣ ਦੁਆਰਾ ਨਿਰਧਾਰਿਤ ਹੁੰਦੀ ਹੈ, AI ਦੁਆਰਾ ਨਹੀਂ."
        ),
        "or": (
            "AI ସହାୟକ ଅସ୍ଥାୟୀ ଭାବରେ ଉପଲବ୍ଧ ନାହିଁ। "
            "ଦୟାକରି ପରବର୍ତ୍ତୀ ସମୟରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ ଅଥବା ସିଧାସଳଖ ଆର୍ଥିକ କ୍ୟାଲକୁଲେଟର ଏବଂ ପାର୍ଟନର ଲୋକେଟର ବ୍ୟବହାର କରନ୍ତୁ। "
            "ଆପଣଙ୍କ ସ୍କିମ ଯୋଗ୍ୟତା ସର୍ବଦା ବ୍ୟାକଏଣ୍ଡ ନିୟମ ଇଞ୍ଜିନ ଦ୍ୱାରା ନିର୍ଧାରିତ ହୁଏ, AI ଦ୍ୱାରା ନୁହେଁ।"
        ),
        "as": (
            "AI সহায়িকা অস্থায়ীভাৱে উপলব্ধ নাই। "
            "অনুগ্ৰহ কৰি পিছত পুনৰ চেষ্টা কৰক অথবা পৰা আৰ্থিক কেলকুলেটৰ আৰু পাৰ্টনাৰ লোকেটৰ ব্যৱহাৰ কৰক। "
            "আপোনাৰ স্কিম যোগ্যতা সদায় বেকএণ্ড নিয়ম ইঞ্জিনে নিৰ্ধাৰণ কৰে, AIয়ে নহয়।"
        ),
        "ur": (
            "AI معاون عارضی طور پر دستیاب نہیں ہے۔ "
            "براہ کرم بعد میں دوبارہ کوشش کریں یا براہ راست مالی کیلکولیٹر اور پارٹنر لوکیٹر استعمال کریں۔ "
            "آپ کی سکیم کی اہلیتہ ہمیشہ بیک اینڈ انجن سے طے ہوتی ہے، AI سے نہیں۔"
        ),
        "ne": (
            "AI सहायक अस्थायी रूपमा उपलब्ध छैन। "
            "कृपया पछि फेरि प्रयास गर्नुहोस् वा प्रत्यक्ष वित्तीय क्याल्कुलेटर र पार्टनर लोकेटर प्रयोग गर्नुहोस्। "
            "तपाईंको योजना योग्यता सधैं ब्याकएन्ड नियम इन्जिनद्वारा निर्धारित हुन्छ, AI द्वारा होइन।"
        ),
        "sa": (
            "AI सहायकः अधुना उपलब्धः नास्ति। "
            "कृपया पश्चात् पुनः प्रयत्नं कुर्वन्तु अथवा प्रत्यक्षं वित्तीय कैल्कुलेटर् एवं साझेदार-लोकेटरं उपयुञ्जन्तु। "
            "भवतः योजना-अर्हता सर्वदा बैकएन्ड् नियम-इञ्जिनेन निर्धार्यते, AI-द्वारा न।"
        ),
        "mai": (
            "AI सहायक अस्थायी रूप में उपलब्ध नहीं अछि। "
            "कृपया बाद में फिनि प्रयास करू अथवा सिधा वित्तीय कैलकुलेटर आ पार्टनर लोकेटर के उपयोग करू। "
            "अहाँक योजना योग्यता हमेशा बैकएंड नियम इंजिन से निर्धारित होइल, AI से नहिं।"
        ),
        "sat": (
            "AI साहायिक चांड़ा चांड़ा आम लेबाबात बाङ आय। "
            "दया कात ताय बाद मा लाहा कोसिस आर जांका सिधा सिधा रेजिनिच् कैलकुलेटर आ साझेदार लोकेटर बेबेमोत। "
            "निमकी स्कीम योग्यता हरसा बेकएंड रेगुलेटर इंजिन ते निर्धारित होई, AI हें बाङ।"
        ),
        "sd": (
            "AI معاون عارضي طور تي دستياب ناهي۔ "
            "مهرباني ڪري پوءي ٻي هُر جاھن ڪوشش ڪريو يا سڌيَارو مالي ڪيالڪوليٽر ۽ ساتھي لوڪيٽر استعمال ڪريو۔ "
            "تهنجي اسڪيم وڌاءت هميشھ ٻيڪ اينڊ انجن ٿي ٿي، AI ٿي ٿي نه۔"
        ),
        "brx": (
            "AI सहायक अस्थायी रूपमा उपलब्ध नो। "
            "दया कराय बेलायाब्लागै फेरि प्रयास करना न'वा थायों बेबस्ताय सिधासिधा वित्तीय कैलकुलेटर आ साझेदार लोकेटर बाहाय। "
            "नों'र स्कीम योग्यता गैबेएण्ड नियम इंजिननि सावनि थों निर्धारित होयो, AI निर्सै।"
        ),
        "doi": (
            "AI सहायक अस्थायी रूप म्हां उपलब्ध नहीं अछि। "
            "कृपया बाद में फिनि प्रयास करू अथवा सिधा वित्तीय कैलकुलेटर आ पार्टनर लोकेटर के उपयोग करू। "
            "अहाँक योजना योग्यता हमेशा बैकएंड नियम इंजिन से निर्धारित होइल, AI से नहिं।"
        ),
        "ks": (
            "AI معاون عارضی طور پر دستیاب نہیں ہے۔ "
            "براہ کرم بعد میں دوبارہ کوشش کریں یا براہ راست مالی کیلکولیٹر أور پارٹنر لوکیٹراستعمال کریں۔ "
            "آپ кی سکیم कی अहलیyat ہمیشہ بیک أینڈ أینجِن سे طے ہوتی ہے، AI سे نہیں۔"
        ),
        "kok": (
            "AI सहाय्यक तात्पुरत्या उपलब्ध नाही. "
            "कृपया नंतर पुन्हा प्रयत्न करा किंवा थेट आर्थिक कॅल्क्युलेटर आणि पार्टनर लोकेटर वापरा. "
            "तुमच्या योजनेची पात्रता नेहमी बॅकएंड नियम इंजिनद्वारे ठरवली जाते, AI द्वारे नाही."
        ),
        "mni": (
            "AI ꯁ꯭ꯄꯩꯇꯔꯥꯡ ꯑꯁ꯭ꯇꯥꯌꯥꯏꯛꯅꯒꯨꯗꯤ ꯀꯩꯗꯥꯔꯁꯅꯤ ꯑꯅꯒꯨꯗꯤ. "
            "ꯃꯩꯇꯕꯒꯨꯗꯤ ꯇꯥꯡꯕꯗꯨꯀꯤ ꯁ꯭ꯄꯩꯇꯔꯥꯡ ꯋꯥꯡꯏꯛꯅꯤ ꯑꯅꯒꯨꯗꯤ ꯃꯥꯏꯁꯤꯇꯦꯡ ꯀꯥꯜꯀ꯿ꯃꯌꯦꯜꯦꯇꯔꯁꯅꯤ ꯃꯥꯌꯥꯡ ꯑꯅꯒꯨꯗꯤ. "
            "ꯑꯃꯊꯪꯕꯒꯨꯗꯤ ꯁ꯭ꯀꯩꯃꯁꯅꯤ ꯃꯥꯎꯟꯇꯥꯡ ꯃꯊꯪꯕꯒꯨꯗꯤ ꯇꯥꯡꯕꯗꯨꯀꯤ ꯊꯥꯛꯁꯅꯤꯇꯦꯡ ꯀꯥꯜꯀ꯿ꯃꯌꯦꯜꯦꯇꯔꯁꯅꯤ ꯑꯅꯒꯨꯗꯤ, AI ꯑꯅꯒꯨꯗꯤ ꯑꯅꯒꯨꯗꯤ ꯑꯅꯒꯨꯗꯤ."
        ),
    }

    context = _build_user_context(
        user_profile=user_profile,
        eligible_schemes=eligible_schemes,
        ineligible_schemes=ineligible_schemes,
        emi_output=emi_output,
        partner_output=partner_output,
        ineligibility_query=ineligibility_query,
        out_of_scope_schemes=out_of_scope_schemes,
    )

    reply = await _call_gemini(SYSTEM_PROMPT, message, context)

    if reply is None:
        # Smart domain-aware fallback if Gemini is temporarily unavailable
        reply = _build_knowledge_fallback(message, language_used)


    # Parse AI ranking before stripping markers
    structured = _extract_structured_data(
        reply=reply,
        eligible_schemes=eligible_schemes,
        emi_output=emi_output,
        partner_output=partner_output,
        ineligibility_query=ineligibility_query,
        out_of_scope_schemes=out_of_scope_schemes,
    )

    # Strip ranking markers from the user-visible reply
    clean_reply = _strip_ranking_markers(reply) if reply else reply

    return {
        "reply": clean_reply,
        "language_used": language_used,
        "language_detected": language_detected,
        **structured,
    }

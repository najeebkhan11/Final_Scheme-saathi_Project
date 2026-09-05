"""
Centralized language configuration for Scheme Saathi AI Assistant.

Covers English + all 22 Scheduled Indian Languages (Eighth Schedule).
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "en": {"code": "en", "name": "English", "native_name": "English", "script": "Latin"},
    "as": {"code": "as", "name": "Assamese", "native_name": "অসমীয়া", "script": "Bengali-Assamese"},
    "bn": {"code": "bn", "name": "Bengali", "native_name": "বাংলা", "script": "Bengali"},
    "brx": {"code": "brx", "name": "Bodo", "native_name": "बड़ो", "script": "Devanagari"},
    "doi": {"code": "doi", "name": "Dogri", "native_name": "डोगरी", "script": "Devanagari"},
    "gu": {"code": "gu", "name": "Gujarati", "native_name": "ગુજરાતી", "script": "Gujarati"},
    "hi": {"code": "hi", "name": "Hindi", "native_name": "हिन्दी", "script": "Devanagari"},
    "kn": {"code": "kn", "name": "Kannada", "native_name": "ಕನ್ನಡ", "script": "Kannada"},
    "ks": {"code": "ks", "name": "Kashmiri", "native_name": "कॉशुर", "script": "Perso-Arabic/Devanagari"},
    "kok": {"code": "kok", "name": "Konkani", "native_name": "कोंकणी", "script": "Devanagari"},
    "mai": {"code": "mai", "name": "Maithili", "native_name": "मैथिली", "script": "Devanagari"},
    "ml": {"code": "ml", "name": "Malayalam", "native_name": "മലയാളം", "script": "Malayalam"},
    "mni": {"code": "mni", "name": "Manipuri", "native_name": "মৈতৈলোন", "script": "Meitei"},
    "mr": {"code": "mr", "name": "Marathi", "native_name": "मराठी", "script": "Devanagari"},
    "ne": {"code": "ne", "name": "Nepali", "native_name": "नेपाली", "script": "Devanagari"},
    "or": {"code": "or", "name": "Odia", "native_name": "ଓଡ଼ିଆ", "script": "Odia"},
    "pa": {"code": "pa", "name": "Punjabi", "native_name": "ਪੰਜਾਬੀ", "script": "Gurmukhi"},
    "sa": {"code": "sa", "name": "Sanskrit", "native_name": "संस्कृत", "script": "Devanagari"},
    "sat": {"code": "sat", "name": "Santali", "native_name": "ᱥᱟᱱᱛᱟᱲᱤ", "script": "Ol Chiki"},
    "sd": {"code": "sd", "name": "Sindhi", "native_name": "سنڌي", "script": "Perso-Arabic/Devanagari"},
    "ta": {"code": "ta", "name": "Tamil", "native_name": "தமிழ்", "script": "Tamil"},
    "te": {"code": "te", "name": "Telugu", "native_name": "తెలుగు", "script": "Telugu"},
    "ur": {"code": "ur", "name": "Urdu", "native_name": "اردو", "script": "Perso-Arabic"},
}


def get_supported_language_codes() -> list[str]:
    return list(LANGUAGE_MAP.keys())


def is_supported_language(code: str) -> bool:
    return code.lower().strip() in LANGUAGE_MAP


def get_language_info(code: str) -> dict[str, str] | None:
    return LANGUAGE_MAP.get(code.lower().strip())


def get_language_name(code: str) -> str:
    info = get_language_info(code)
    return info["name"] if info else code


def get_native_name(code: str) -> str:
    info = get_language_info(code)
    return info["native_name"] if info else code


def build_language_selector_options() -> list[dict[str, str]]:
    """Build options for the frontend language selector."""
    options = []
    for code, info in LANGUAGE_MAP.items():
        options.append({
            "code": code,
            "name": info["name"],
            "native_name": info["native_name"],
            "display": f"{info['native_name']} ({info['name']})" if code != "en" else "English",
        })
    return options

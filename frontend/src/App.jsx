import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe2,
  LockKeyhole,
  LogIn,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

import {
  getIndiaLocations,
  getIndiaDistricts,
} from "./data/indiaLocations";

/* =========================================================
   CONFIG
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000";

/* =========================================================
   HELPERS
========================================================= */

function normalizeMatchScore(score) {
  if (
    score === null ||
    score === undefined ||
    score === ""
  ) {
    return null;
  }

  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return null;
  }

  const percentage =
    numericScore <= 1
      ? numericScore * 100
      : numericScore;

  return Math.max(
    0,
    Math.min(100, Math.round(percentage)),
  );
}

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not provided";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `₹${numericValue.toLocaleString("en-IN")}`;
}

function formatValue(value) {
  if (!value) {
    return "Not provided";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase(),
    );
}

/* =========================================================
   GENDER / SCHEME HELPERS
========================================================= */

/*
  Detect whether a scheme is women-focused.

  Backend may expose this information through:
    - women_focused
    - womenFocused
    - gender_status.message
    - gender_message
    - gender_requirement

  We check all common possibilities so the frontend
  does not accidentally recommend a women-focused scheme
  to a male applicant.
*/

/* =========================================================
   AUTH STORAGE & VERIFICATION HELPERS
========================================================= */

const USERS_STORAGE_KEY = "scheme_saathi_registered_users";
const SESSION_STORAGE_KEY = "scheme_saathi_user_session";

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Failed to save users to localStorage:", err);
  }
}

function registerUser({ name, identifier, password, type }) {
  const users = getRegisteredUsers();
  const normalizedId = identifier.toLowerCase().trim();
  const exists = users.find(
    (u) => u.identifier.toLowerCase().trim() === normalizedId
  );

  if (exists) {
    return {
      success: false,
      error: "An account with this mobile number/email already exists. Please sign in instead.",
      alreadyExists: true,
    };
  }

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    identifier: identifier.trim(),
    password: password,
    type: type,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveRegisteredUsers(users);

  return {
    success: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      identifier: newUser.identifier,
      type: newUser.type,
    },
  };
}

function authenticateUser({ identifier, password }) {
  const users = getRegisteredUsers();
  const normalizedId = identifier.toLowerCase().trim();
  const found = users.find(
    (u) => u.identifier.toLowerCase().trim() === normalizedId
  );

  if (!found) {
    return {
      success: false,
      error: "No account found with this mobile number or email. Please create an account first.",
      notFound: true,
    };
  }

  if (found.password !== password) {
    return {
      success: false,
      error: "Incorrect password. Please check your password and try again.",
      wrongPassword: true,
    };
  }

  return {
    success: true,
    user: {
      id: found.id,
      name: found.name,
      identifier: found.identifier,
      type: found.type,
    },
  };
}

function getStoredSession() {
  try {
    const raw =
      localStorage.getItem(SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(user, remember = true) {
  try {
    if (remember) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to save session:", err);
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear session:", err);
  }
}

/* =========================================================
   AUTH VALIDATION HELPERS
========================================================= */

/*
  Validates and normalizes an Indian phone number with strict anti-dummy checks.
  Must be an authentic 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
  and must not be repetitive, sequential, or dummy test numbers.
  Supports input formats:
    - 9845123456
    - +919845123456, +91 98451 23456, +91-9845123456
    - 09845123456
    - 919845123456
  Returns { isValid: true, value: "+91XXXXXXXXXX" } or { isValid: false, error: "..." }
*/
function checkValidIndianPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return {
      isValid: false,
      error: "Please enter your 10-digit Indian mobile number (+91).",
    };
  }

  const trimmed = phone.trim();

  // Reject text or letters
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Mobile number must contain digits only, without letters.",
    };
  }

  const cleaned = trimmed.replace(/[\s\-().]/g, "");

  // Match 10-digit mobile number with optional prefix (+91, 91, 0)
  const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return {
        isValid: false,
        error: "Mobile number must be a full 10-digit Indian number (+91XXXXXXXXXX).",
      };
    }
    if (digitsOnly.length > 10 && !trimmed.startsWith("+91") && !trimmed.startsWith("91") && !trimmed.startsWith("0")) {
      return {
        isValid: false,
        error: "Mobile number cannot exceed 10 digits (excluding +91 country code).",
      };
    }
    if (digitsOnly.length === 10 && !/^[6-9]/.test(digitsOnly)) {
      return {
        isValid: false,
        error: "Valid Indian mobile numbers must start with 6, 7, 8, or 9.",
      };
    }
    return {
      isValid: false,
      error: "Please enter a valid 10-digit Indian mobile number (+91XXXXXXXXXX).",
    };
  }

  const digits = match[1];

  // 1. Check all identical digits (e.g. 9999999999, 8888888888, 7777777777, 6666666666)
  if (/^(\d)\1{9}$/.test(digits)) {
    return {
      isValid: false,
      error: "Invalid number: Number cannot be all identical repeating digits.",
    };
  }

  // 2. Check 5 or more repeating consecutive digits (e.g. 9888881234, 9000000001)
  if (/(\d)\1{4,}/.test(digits)) {
    return {
      isValid: false,
      error: "Invalid number: Number contains too many repeating consecutive digits.",
    };
  }

  // 3. Unique digits diversity (real Indian mobile numbers have at least 4 distinct digits)
  const uniqueDigits = new Set(digits.split("")).size;
  if (uniqueDigits < 4) {
    return {
      isValid: false,
      error: "Invalid number: Please enter a genuine, active 10-digit Indian mobile number.",
    };
  }

  // 4. Repeated 2-digit patterns (e.g. 9898989898, 7676767676, 9191919191)
  if (/^(\d{2})\1{4}$/.test(digits)) {
    return {
      isValid: false,
      error: "Invalid number: Repetitive pattern detected.",
    };
  }

  // 5. Repeated 3-digit patterns (e.g. 9879879879)
  if (/^(\d{3})\1{2}\d$/.test(digits)) {
    return {
      isValid: false,
      error: "Invalid number: Patterned sequence is not a valid mobile number.",
    };
  }

  // 6. Check for sequential / series patterns (e.g. 12345, 1234, 123, 54321, 123450, 6789 in front, middle, or last)
  if (
    /123450|12345|1234|123|543210|54321|4321|321|6789|7890|8901|9876|8765|7654|6543|5432/.test(
      digits
    )
  ) {
    return {
      isValid: false,
      error:
        "Invalid number: Sequential series (e.g. 12345, 1234, 123, 54321) is not a valid Indian mobile number.",
    };
  }

  for (let i = 0; i <= digits.length - 3; i++) {
    const d0 = Number(digits[i]);
    const d1 = Number(digits[i + 1]);
    const d2 = Number(digits[i + 2]);

    // Ascending run (e.g. 1-2-3, 2-3-4, 6-7-8, 7-8-9, 8-9-0)
    if (
      (d1 === (d0 + 1) % 10 && d2 === (d1 + 1) % 10) ||
      (d1 === d0 + 1 && d2 === d1 + 1)
    ) {
      return {
        isValid: false,
        error:
          "Invalid number: Sequential series numbers are not valid Indian mobile numbers.",
      };
    }

    // Descending run (e.g. 3-2-1, 5-4-3, 9-8-7, 0-9-8)
    if (
      (d1 === (d0 - 1 + 10) % 10 && d2 === (d1 - 1 + 10) % 10) ||
      (d1 === d0 - 1 && d2 === d1 - 1)
    ) {
      return {
        isValid: false,
        error:
          "Invalid number: Sequential series numbers are not valid Indian mobile numbers.",
      };
    }
  }

  // 7. Known dummy and mock numbers list
  const knownDummies = [
    "9876543210", "9123456789", "9012345678", "6789012345",
    "9898989898", "9191919191", "9090909090", "8080808080",
    "7070707070", "6060606060", "9876598765", "9876500000",
    "9876512345", "9999900000", "9000000000", "8000000000",
    "7000000000", "6000000000", "9111111111", "9222222222",
    "9333333333", "9444444444", "9555555555", "9666666666",
    "9777777777", "9888888888", "9999999999"
  ];
  if (knownDummies.includes(digits)) {
    return {
      isValid: false,
      error: "Invalid number: Dummy test number detected. Please enter your real 10-digit mobile number.",
    };
  }

  return {
    isValid: true,
    value: `+91${digits}`,
  };
}

/*
  Validates either a valid 10-digit Indian phone number or an email address.
*/
function validateIdentifier(value) {
  if (!value || !value.trim()) {
    return {
      isValid: false,
      error: "Please enter your 10-digit mobile number (+91) or email address.",
    };
  }

  const trimmed = value.trim();

  // 1. Check if email format
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (isEmail) {
    return {
      isValid: true,
      type: "email",
      value: trimmed.toLowerCase(),
    };
  }

  // 2. Validate real 10-digit Indian phone number
  const phoneResult = checkValidIndianPhoneNumber(trimmed);
  if (phoneResult.isValid) {
    return {
      isValid: true,
      type: "phone",
      value: phoneResult.value,
    };
  }

  return {
    isValid: false,
    error: phoneResult.error,
  };
}

/*
  Validates password length (minimum 6 characters).
*/
function validatePassword(password) {
  if (!password) {
    return {
      isValid: false,
      error: "Please enter your password.",
    };
  }

  if (typeof password !== "string" || password.length < 6) {
    return {
      isValid: false,
      error: "Password must be at least 6 characters long.",
    };
  }

  return {
    isValid: true,
  };
}

function isWomenFocusedScheme(scheme) {
  if (!scheme) {
    return false;
  }

  if (
    scheme.women_focused === true ||
    scheme.womenFocused === true ||
    scheme.gender_status?.women_focused === true ||
    scheme.gender_status?.womenFocused === true
  ) {
    return true;
  }

  const messages = [
    scheme.gender_status?.message,
    scheme.gender_message,
    scheme.gender_requirement,
    scheme.preference_message,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value).toLowerCase(),
    )
    .join(" ");

  return (
    messages.includes("women-focused") ||
    messages.includes("women focused") ||
    messages.includes("women-focused fund") ||
    messages.includes("women focused fund") ||
    messages.includes("women only") ||
    messages.includes("for women") ||
    messages.includes("female focused") ||
    messages.includes("female-focused")
  );
}

function isFemaleApplicant(formData) {
  return (
    String(formData?.gender || "")
      .toLowerCase() === "female"
  );
}

/*
  Explicit product rule:

  A women-focused scheme must NOT be recommended
  to a non-female applicant.

  This is a recommendation-level filter.
*/
function shouldExcludeForGender(
  scheme,
  formData,
) {
  return (
    isWomenFocusedScheme(scheme) &&
    !isFemaleApplicant(formData)
  );
}

/*
  Extract a useful gender failure reason.
*/
function getGenderFailureReason(scheme) {
  if (scheme?.gender_status?.message) {
    return String(
      scheme.gender_status.message,
    );
  }

  return "This scheme has a women-focused fund allocation and is not recommended for male / non-female applicants.";
}

/* =========================================================
   FALLBACK MATCH SCORE
========================================================= */

/*
  IMPORTANT:

  This is only a temporary deterministic fallback.
  It is NOT an AI score.

  Core eligibility signals:
    Community  = 20
    Income     = 20
    Purpose    = 20
    Project    = 20
    Preference = 20

  For a women-focused scheme:
    Female applicant     -> +20 preference
    Non-female applicant -> scheme is excluded BEFORE scoring

  Therefore:
    women-focused + male => 0%
*/
  function calculateFallbackMatchScore(
  scheme,
  formData,
) {
  if (!scheme) {
    return 0;
  }

  /*
    Safety rule:
    women-focused scheme + non-female applicant = ZERO.
  */
  if (
    shouldExcludeForGender(
      scheme,
      formData,
    )
  ) {
    return 0;
  }

  const reasons = Array.isArray(
    scheme.reasons,
  )
    ? scheme.reasons
    : [];

  let score = 0;

  const hasCommunityMatch =
    reasons.some((reason) =>
      String(reason)
        .toLowerCase()
        .includes(
          "community requirement satisfied",
        ),
    );

  const hasIncomeMatch =
    reasons.some((reason) =>
      String(reason)
        .toLowerCase()
        .includes(
          "annual family income is within",
        ),
    );

  const hasPurposeMatch =
    reasons.some((reason) =>
      String(reason)
        .toLowerCase()
        .includes(
          "requirement type is compatible",
        ),
    );

  const hasProjectMatch =
    reasons.some((reason) =>
      String(reason)
        .toLowerCase()
        .includes(
          "project cost falls within",
        ),
    );

  if (hasCommunityMatch) {
    score += 20;
  }

  if (hasIncomeMatch) {
    score += 20;
  }

  if (hasPurposeMatch) {
    score += 20;
  }

  if (hasProjectMatch) {
    score += 20;
  }

  /*
    Gender-specific positive match:
    female applicant + women-focused scheme = +20.
  */
  if (
    scheme?.gender_status?.rule_type ===
      "women_target" &&
    formData?.gender === "female"
  ) {
    score += 20;
  }

  return Math.min(
    100,
    Math.round(score),
  );
}



/* =========================================================
   RESULT NORMALIZATION
========================================================= */

/*
  This is the MOST IMPORTANT FIX.

  Backend may say:
      primary.eligible = [Term Loan, UNY]

  But if the applicant is male and Term Loan is
  women-focused, we MUST NOT display Term Loan
  as a recommendation.

  So we sanitize the backend response before rendering.
*/
function normalizeSchemeResults(
  results,
  formData,
) {
  const backendPrimaryEligible =
    Array.isArray(
      results?.primary?.eligible,
    )
      ? results.primary.eligible
      : [];

  const backendPrimaryIneligible =
    Array.isArray(
      results?.primary?.ineligible,
    )
      ? results.primary.ineligible
      : [];

  const backendSecondaryEligible =
    Array.isArray(
      results?.secondary?.eligible,
    )
      ? results.secondary.eligible
      : [];

  /*
    Keep backend-eligible schemes only when
    their gender requirement is satisfied.
  */
  const allowedPrimaryEligible = [];
  const genderFilteredPrimary = [];

  backendPrimaryEligible.forEach(
    (scheme) => {
      if (
        shouldExcludeForGender(
          scheme,
          formData,
        )
      ) {
        genderFilteredPrimary.push({
          ...scheme,
          eligibility_status:
            "NOT_ELIGIBLE_GENDER",
          match_score: 0,
          failures: [
            ...(Array.isArray(
              scheme.failures,
            )
              ? scheme.failures
              : []),
            getGenderFailureReason(scheme),
          ],
        });

        return;
      }

      allowedPrimaryEligible.push(
        scheme,
      );
    },
  );

  /*
    Secondary schemes should follow the same
    gender restriction so that a women-focused
    support scheme is not recommended to a male
    applicant either.
  */
  const allowedSecondaryEligible = [];

  backendSecondaryEligible.forEach(
    (scheme) => {
      if (
        shouldExcludeForGender(
          scheme,
          formData,
        )
      ) {
        return;
      }

      allowedSecondaryEligible.push(
        scheme,
      );
    },
  );

  return {
    ...results,

    primary: {
      ...(results?.primary || {}),
      eligible:
        allowedPrimaryEligible,
      ineligible: [
        ...backendPrimaryIneligible,
        ...genderFilteredPrimary,
      ],
    },

    secondary: {
      ...(results?.secondary || {}),
      eligible:
        allowedSecondaryEligible,
    },
  };
}

/* =========================================================
   MATCH SCORE COMPONENTS
========================================================= */

function MatchScoreDisplay({
  score,
}) {
  const normalizedScore =
    normalizeMatchScore(score);

  return (
    <div className="mt-1 flex h-[58px] items-baseline justify-center">
      <span className="font-serif text-[54px] font-bold leading-none text-[#155985]">
        {normalizedScore !== null
          ? normalizedScore
          : "—"}
      </span>

      {normalizedScore !== null && (
        <span className="ml-0.5 font-serif text-[23px] font-bold leading-none text-[#155985]">
          %
        </span>
      )}
    </div>
  );
}

function MatchScoreRing({ score }) {
  const normalizedScore =
    normalizeMatchScore(score);

  const hasScore =
    normalizedScore !== null;

  const ringStyle = hasScore
    ? {
        background: `conic-gradient(#155985 ${
          normalizedScore * 3.6
        }deg, #d8e4eb 0deg)`,
      }
    : {
        background: "#d8e4eb",
      };

  return (
    <div
      className="relative mt-3 flex h-[78px] w-[78px] items-center justify-center rounded-full p-[7px]"
      style={ringStyle}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#fffef9]">
        <Sparkles
          size={20}
          className="text-[#155985]"
        />
      </div>
    </div>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [view, setView] =
    useState("home");

  const [currentUser, setCurrentUser] =
    useState(() => getStoredSession());

  const [isLoggedIn, setIsLoggedIn] =
    useState(() => Boolean(getStoredSession()));

  const openSchemeFinder = () => {
    if (isLoggedIn) {
      setView("finder");
    } else {
      setView("login");
    }
  };

  const handleLogin = (user, remember = true) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    saveStoredSession(user, remember);
    setView("finder");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    clearStoredSession();
    setView("home");
  };

  return (
    <div className="min-h-screen bg-white text-[#10213f]">
      {view === "home" && (
        <LandingPage
          onFindScheme={
            openSchemeFinder
          }
          onExplore={() =>
            setView("explore")
          }
          onLogin={() =>
            setView("login")
          }
          isLoggedIn={
            isLoggedIn
          }
          currentUser={
            currentUser
          }
          onLogout={
            handleLogout
          }
        />
      )}

      {view === "explore" && (
        <ExploreSchemes
          onBack={() =>
            setView("home")
          }
          onLogin={() =>
            setView("login")
          }
        />
      )}

      {view === "login" && (
        <AuthPage
          mode="login"
          onBack={() =>
            setView("home")
          }
          onLogin={
            handleLogin
          }
          onSignup={() =>
            setView("signup")
          }
        />
      )}

      {view === "signup" && (
        <AuthPage
          mode="signup"
          onBack={() =>
            setView("home")
          }
          onLogin={() =>
            setView("login")
          }
          onSignupSuccess={
            handleLogin
          }
        />
      )}

      {view === "finder" && (
        <SchemeFinder
          onBack={() =>
            setView("home")
          }
          isLoggedIn={
            isLoggedIn
          }
          currentUser={
            currentUser
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

function LandingPage({
  onFindScheme,
  onExplore,
  onLogin,
  isLoggedIn,
  currentUser,
  onLogout,
}) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#dce4ec] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[86px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <button
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior:
                  "smooth",
              })
            }
            className="flex items-center gap-3 text-left"
          >
            <div className="relative flex h-12 w-12 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-[10px] border-[3px] border-[#c6a56b]" />

              <Sparkles
                size={25}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <h1 className="font-serif text-[25px] font-bold leading-none tracking-wide text-[#12213c]">
                SCHEME SAATHI
              </h1>

              <p className="mt-1 text-[12px] font-medium text-[#61738d]">
                Your Government Scheme Companion
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            <button
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior:
                    "smooth",
                })
              }
              className="relative py-3 text-[14px] font-medium text-[#17243b]"
            >
              Home

              <span className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 bg-[#c6a56b]" />
            </button>

            <button
              onClick={onExplore}
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              Explore Schemes
            </button>

            <button
              onClick={() =>
                document
                  .getElementById(
                    "calculator",
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",
                  })
              }
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              Calculator
            </button>

            <button
              onClick={() =>
                alert(
                  "Partner Locator will be connected to the GIS backend in the next development phase.",
                )
              }
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              Partner Locator
            </button>

            <button
              onClick={() =>
                alert(
                  "Document Center will be connected after backend integration.",
                )
              }
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              Documents
            </button>

            <button
              onClick={() =>
                alert(
                  "Application Tracking will be connected after authentication and backend integration.",
                )
              }
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              Track Application
            </button>

            <button
              onClick={() =>
                alert(
                  "AI Assistant will be connected after the AI backend layer is implemented.",
                )
              }
              className="text-[14px] font-medium text-[#17243b] transition hover:text-[#1769a8]"
            >
              AI Assistant
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden items-center gap-2 rounded-lg border border-[#cfd8e3] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#24344e] transition hover:bg-[#f5f8fb] md:flex">
              ENGLISH
              <ChevronDown
                size={14}
              />
            </button>

            {isLoggedIn ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[#c3daf0] bg-[#eef7fc] px-3.5 py-2 text-xs font-bold text-[#145c91]">
                  <UserRound size={14} />
                  <span>{currentUser?.name || currentUser?.identifier || "Signed In"}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 rounded-lg border border-[#cfd8e3] px-3.5 py-2 text-[13px] font-semibold text-[#486581] transition hover:bg-[#f5f8fb]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center gap-2 rounded-lg border border-[#cfd8e3] px-4 py-2.5 text-[13px] font-semibold text-[#24344e] transition hover:bg-[#f5f8fb]"
              >
                <LogIn
                  size={15}
                />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#eaf5fa]">
          <div className="absolute -left-32 top-10 h-[500px] w-[500px] rounded-full bg-white/60 blur-3xl" />

          <div className="absolute right-0 top-0 h-full w-[45%] bg-gradient-to-l from-[#dceef5]/70 to-transparent" />

          <div className="relative mx-auto grid min-h-[610px] max-w-[1440px] items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_0.9fr] lg:px-20 lg:py-20">
            <div className="relative z-10">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#c9d5df] bg-white/75 px-5 py-2.5 shadow-sm">
                <Bot
                  size={18}
                  className="text-[#1769a8]"
                />

                <span className="text-[13px] font-semibold tracking-[0.12em] text-[#536275]">
                  AI-POWERED SCHEME MATCHING
                </span>
              </div>

              <h2 className="max-w-[680px] font-serif text-[52px] font-bold leading-[1.08] tracking-[-0.02em] text-[#12365d] md:text-[62px]">
                Find the right
                <br />
                government scheme
                <br />
                for your next step.
              </h2>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px w-20 bg-[#c6a56b]" />
                <div className="h-2 w-2 rotate-45 bg-[#c6a56b]" />
                <div className="h-px w-8 bg-[#c6a56b]" />
              </div>

              <p className="max-w-[650px] text-[18px] leading-8 text-[#43566f]">
                Discover suitable schemes,
                calculate loan details,
                <br className="hidden md:block" />
                and connect with the
                right partners — all in
                one place.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={
                    onFindScheme
                  }
                  className="group flex items-center gap-3 rounded-lg bg-[#145c91] px-7 py-4 text-[16px] font-semibold text-white shadow-lg shadow-[#145c91]/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#104d7b]"
                >
                  Find My Scheme

                  <ArrowRight
                    size={19}
                    className="transition group-hover:translate-x-1"
                  />
                </button>

                <button
                  onClick={
                    onExplore
                  }
                  className="group flex items-center gap-3 rounded-lg border-2 border-[#145c91] bg-white/80 px-7 py-4 text-[16px] font-semibold text-[#145c91] transition hover:bg-white"
                >
                  Explore Schemes

                  <ArrowRight
                    size={19}
                    className="transition group-hover:translate-x-1"
                  />
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
                <TrustItem
                  icon={
                    <Globe2
                      size={19}
                    />
                  }
                  text="Multilingual Support"
                />

                <TrustItem
                  icon={
                    <ShieldCheck
                      size={19}
                    />
                  }
                  text="Explainable Matching"
                />

                <TrustItem
                  icon={
                    <LockKeyhole
                      size={18}
                    />
                  }
                  text="Secure & Trusted"
                />
              </div>
            </div>

            <div className="relative z-10">
              <div className="relative rounded-[18px] border-2 border-[#31465c] bg-[#fffdf7] p-5 shadow-[0_20px_50px_rgba(38,68,94,0.15)] md:p-6">
                <div className="absolute -right-1 top-0 overflow-hidden">
                  <div className="flex h-[105px] w-[65px] flex-col items-center justify-start bg-[#175b88] px-2 pt-3 text-center text-white shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]">
                    <Sparkles
                      size={17}
                    />

                    <span className="mt-2 text-[10px] font-bold leading-3">
                      BEST
                      <br />
                      MATCH
                    </span>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-center gap-3">
                  <div className="h-px flex-1 bg-[#c8d1d9]" />

                  <span className="font-serif text-[15px] font-bold tracking-[0.08em] text-[#24384e]">
                    YOUR PERSONAL MATCH
                  </span>

                  <div className="h-px flex-1 bg-[#c8d1d9]" />
                </div>

                <div className="rounded-xl border-2 border-[#43586c] bg-[#fffef9] p-5">
                  <div className="grid grid-cols-[0.95fr_1.15fr] gap-5">
                    <div className="flex min-h-[230px] flex-col items-center justify-center border-r border-[#d4dbe1] pr-5">
                      <p className="text-[12px] font-semibold text-[#37485a]">
                        Match Score
                      </p>

                      <MatchScoreDisplay
                        score={null}
                      />

                      <MatchScoreRing
                        score={null}
                      />
                    </div>

                    <div className="space-y-4">
                      <MatchPoint
                        icon={
                          <UserRound
                            size={16}
                          />
                        }
                        title="Income Eligible"
                        subtitle="Verified by rule engine"
                      />

                      <MatchPoint
                        icon={
                          <FileText
                            size={16}
                          />
                        }
                        title="Purpose Matched"
                        subtitle="Based on requirement"
                      />

                      <MatchPoint
                        icon={
                          <Calculator
                            size={16}
                          />
                        }
                        title="Loan Requirement"
                        subtitle="Compared with scheme limits"
                      />

                      <MatchPoint
                        icon={
                          <MapPin
                            size={16}
                          />
                        }
                        title="Partner Matching"
                        subtitle="Location-aware routing"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border-2 border-[#43586c] bg-[#fffef9] p-4">
                  <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr] items-center gap-4">
                    <div>
                      <p className="text-[11px] text-[#748396]">
                        Top Recommended Scheme
                      </p>

                      <h3 className="mt-1 font-serif text-[21px] font-bold text-[#17263b]">
                        Based on your profile
                      </h3>

                      <p className="mt-1 text-[10px] text-[#65758a]">
                        Live recommendation from backend
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#748396]">
                        Max Loan
                      </p>

                      <p className="mt-1 font-bold text-[#17263b]">
                        Applicable
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#748396]">
                        Interest Rate
                      </p>

                      <p className="mt-1 font-bold text-[#17263b]">
                        Applicable
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={
                    onFindScheme
                  }
                  className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg bg-[#3ca1d0] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#288dbb]"
                >
                  View My Recommendation
                  <ArrowRight
                    size={18}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e4ddd2] bg-[#faf3e8] px-6 py-5">
          <div className="mx-auto grid max-w-[1320px] divide-y divide-[#ded5c8] md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
            <FeatureStrip
              icon={
                <Bot size={25} />
              }
              title="AI Scheme Finder"
              text="Get personalized scheme recommendations with clear reasons."
            />

            <FeatureStrip
              icon={
                <Calculator
                  size={25}
                />
              }
              title="Financial Calculator"
              text="Calculate EMI, interest and repayment before applying."
            />

            <FeatureStrip
              icon={
                <MapPin size={25} />
              }
              title="Partner Locator"
              text="Find the right channel partner near you."
            />

            <FeatureStrip
              icon={
                <FileText
                  size={25}
                />
              }
              title="Track Applications"
              text="Track status and understand your application journey."
            />
          </div>
        </section>

        <section className="bg-white px-6 py-20 lg:py-24">
          <div className="mx-auto max-w-[1300px]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16 bg-[#ccd3d9]" />

                <span className="text-[12px] font-bold tracking-[0.18em] text-[#7b858e]">
                  SIMPLE PROCESS
                </span>

                <div className="h-px w-16 bg-[#ccd3d9]" />
              </div>

              <h2 className="mt-4 font-serif text-[34px] font-bold text-[#182a42] md:text-[40px]">
                From Confusion to the Right Opportunity
              </h2>

              <div className="mx-auto mt-5 h-2 w-2 rotate-45 bg-[#c6a56b]" />
            </div>

            <div className="relative mt-16">
              <div className="absolute left-[10%] right-[10%] top-[37px] hidden border-t border-dashed border-[#ccd6dd] lg:block" />

              <div className="relative grid gap-12 md:grid-cols-3 lg:grid-cols-5">
                <ProcessStep
                  number="01"
                  icon={
                    <UserRound
                      size={26}
                    />
                  }
                  title="About You"
                  text="Tell us basic details about your income, location and background."
                  iconClass="bg-[#d9eef8] text-[#17669a]"
                />

                <ProcessStep
                  number="02"
                  icon={
                    <Bot
                      size={26}
                    />
                  }
                  title="Get AI Matching"
                  text="Our intelligent engine checks your profile against eligible schemes."
                  iconClass="bg-[#d9eef8] text-[#17669a]"
                />

                <ProcessStep
                  number="03"
                  icon={
                    <Calculator
                      size={26}
                    />
                  }
                  title="Understand Better"
                  text="Calculate loan details, EMI, interest and repayment terms."
                  iconClass="bg-[#dff0ec] text-[#397e72]"
                />

                <ProcessStep
                  number="04"
                  icon={
                    <MapPin
                      size={26}
                    />
                  }
                  title="Connect & Apply"
                  text="Find a suitable channel partner and understand how to apply."
                  iconClass="bg-[#eef0c9] text-[#7a7b2e]"
                />

                <ProcessStep
                  number="05"
                  icon={
                    <CheckCircle2
                      size={26}
                    />
                  }
                  title="Achieve Your Goal"
                  text="Track your application and move confidently toward your goal."
                  iconClass="bg-[#f1e1d4] text-[#925c38]"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="calculator"
          className="bg-[#f7fafc] px-6 py-16"
        >
          <div className="mx-auto max-w-[1200px] rounded-2xl border border-[#d7e2e9] bg-white p-8">
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                  FINANCIAL CALCULATOR
                </p>

                <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                  Understand your loan before applying.
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#708095]">
                  The scheme-specific calculator will use official loan
                  limits, rates, tenure and moratorium values from the
                  backend.
                </p>
              </div>

              <button
                onClick={() =>
                  alert(
                    "The financial calculator will be connected to the scheme rules in the next backend phase.",
                  )
                }
                className="flex shrink-0 items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b]"
              >
                Open Calculator
                <ArrowRight
                  size={18}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-[#edf7fb] px-6 py-16">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-8 rounded-2xl border border-[#d4e2e9] bg-white px-8 py-10 shadow-sm md:flex-row">
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-[#17669a]">
                READY TO GET STARTED?
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                Let Scheme Saathi find your best match.
              </h2>

              <p className="mt-2 text-[#68788a]">
                Simple. Transparent. Built around your needs.
              </p>
            </div>

            <button
              onClick={
                onFindScheme
              }
              className="flex shrink-0 items-center gap-3 rounded-lg bg-[#145c91] px-7 py-4 font-semibold text-white shadow-md transition hover:bg-[#104d7b]"
            >
              Find My Scheme
              <ArrowRight
                size={19}
              />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dce4ea] bg-white px-6 py-7">
        <div className="mx-auto flex max-w-[1300px] flex-col justify-between gap-3 text-sm text-[#718096] md:flex-row">
          <p>
            © 2026 Scheme Saathi. Your Government Scheme Companion.
          </p>

          <p>
            AI-assisted • Rule-based • Location-aware
          </p>
        </div>
      </footer>
    </>
  );
}

/* =========================================================
   EXPLORE SCHEMES DATA
========================================================= */

const PRIMARY_SCHEMES = [
  {
    code: "MFS",
    title: "Micro Finance Scheme",
    rate: "6.5% p.a.",
    limit: "Project cost up to ₹1.40 lakh",
    loan: "Loan up to ₹1.25 lakh",

    eligibility: [
      "Scheduled Caste (SC) applicant",
      "Valid caste certificate required",
      "Annual family income up to ₹5 lakh",
      "Eligible small income-generating activity",
    ],

    documents: [
      "Valid caste certificate",
      "Income proof",
      "Identity / KYC documents",
      "Address proof",
      "Activity / project-related documents",
    ],

    route: "SCAs / CAs",

    description:
      "Concessional financing for eligible small income-generating activities.",

    icon: (
      <Sparkles size={23} />
    ),
  },

  {
    code: "AMY",
    title:
      "Aajeevika Micro-Finance Yojana",
    rate: "15% p.a.",
    limit: "Project cost up to ₹1.40 lakh",
    loan: "Loan up to ₹1.25 lakh",

    eligibility: [
      "Scheduled Caste (SC) applicant",
      "Valid caste certificate required",
      "Annual family income up to ₹5 lakh",
      "Eligible small / micro business activity",
    ],

    documents: [
      "Valid caste certificate",
      "Income proof",
      "Identity / KYC documents",
      "Address proof",
      "Business / activity documents",
    ],

    route: "Selected NBFC-MFIs",

    description:
      "Micro-finance support for eligible SC applicants through participating NBFC-MFIs.",

    icon: (
      <UserRound size={23} />
    ),
  },

  {
    code: "TL",
    title: "Term Loan",
    rate: "8% p.a.",
    limit:
      "Project cost above ₹1.40 lakh up to ₹50 lakh",
    loan: "Loan up to ₹45 lakh",

    eligibility: [
      "Scheduled Caste (SC) applicant",
      "Valid caste certificate required",
      "Annual family income up to ₹5 lakh",
      "For eligible larger income-generating projects",
      "Suitable for self-employment / business expansion",
    ],

    documents: [
      "Valid caste certificate",
      "Income proof",
      "Identity / KYC documents",
      "Address proof",
      "Detailed project report / business documents",
      "Quotations / cost estimates where applicable",
    ],

    route: "SCAs / CAs",

    description:
      "Longer-term financing for larger eligible income-generating projects.",

    icon: (
      <Calculator
        size={23}
      />
    ),
  },

  {
    code: "UNY",
    title: "Udyam Nidhi Yojana",
    rate: "13%–15% p.a.",
    limit: "Project cost up to ₹5 lakh",
    loan: "Loan up to ₹4.50 lakh",

    eligibility: [
      "Scheduled Caste (SC) applicant",
      "Valid caste certificate required",
      "Annual family income up to ₹5 lakh",
      "Eligible small / micro activity",
      "Entrepreneurship-oriented financing",
    ],

    documents: [
      "Valid caste certificate",
      "Income proof",
      "Identity / KYC documents",
      "Address proof",
      "Business / activity documents",
      "Project / cost estimate",
    ],

    route:
      "Cooperative Societies / Cooperative Banks / SFBs",

    description:
      "Financing support for eligible small activities and entrepreneurship.",

    icon: <Bot size={23} />,
  },

  {
    code: "ELS",
    title: "Educational Loan Scheme",
    rate: "6.5% p.a.",
    limit: "Loan up to ₹40 lakh",
    loan:
      "Up to 90% of course fee, subject to scheme limit",

    eligibility: [
      "Scheduled Caste (SC) applicant",
      "Valid caste certificate required",
      "Annual family income up to ₹5 lakh",
      "Regular / full-time professional or technical study",
      "Recognized institution in India or abroad",
    ],

    documents: [
      "Valid caste certificate",
      "Income proof",
      "Identity / KYC documents",
      "Admission / offer letter",
      "Course fee structure",
      "Institution / course documents",
    ],

    route: "SCAs / CAs",

    description:
      "Educational financing for eligible professional and technical studies.",

    icon: (
      <FileText
        size={23}
      />
    ),
  },
];

/* =========================================================
   EXPLORE SCHEMES
========================================================= */

function ExploreSchemes({
  onBack,
  onLogin,
}) {
  return (
    <div className="min-h-screen bg-[#f5f9fc]">
      <header className="border-b border-[#dce4ec] bg-white">
        <div className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft
              size={18}
            />
            Back to Home
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />

              <Sparkles
                size={17}
              />
            </div>

            <p className="font-serif text-[18px] font-bold tracking-wide text-[#172a43]">
              SCHEME SAATHI
            </p>
          </div>

          <span className="hidden text-xs font-semibold text-[#718096] sm:block">
            Public Scheme Explorer
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
            EXPLORE SCHEMES
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold text-[#172a43] md:text-5xl">
            Explore government credit options.
          </h1>

          <p className="mt-4 text-base leading-7 text-[#66788d]">
            Browse the primary Scheme Saathi scope without creating an
            account. Personalized eligibility matching requires sign-in.
          </p>
        </div>

        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7b8998]">
                PRIMARY
              </p>

              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                PS-Core Schemes
              </h2>
            </div>

            <span className="rounded-full border border-[#d5e0e7] bg-white px-4 py-2 text-[11px] font-bold text-[#637589]">
              5 CORE SCHEMES
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRIMARY_SCHEMES.map(
              (scheme) => (
                <SchemeCard
                  key={
                    scheme.code
                  }
                  {...scheme}
                />
              ),
            )}
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-6">
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#7b8998]">
              SECONDARY
            </p>

            <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
              Related / Connected Support
            </h2>
          </div>

          <div className="rounded-2xl border border-[#d7e3ea] bg-white p-7 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf6fa] text-[#1769a8]">
                <ShieldCheck
                  size={23}
                />
              </div>

              <div>
                <h3 className="font-serif text-xl font-bold text-[#23384f]">
                  VISVAS — Connected Interest Support
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#718096]">
                  Eligible SC, OBC and Safai Karamchari individual
                  beneficiaries may receive interest subvention support,
                  subject to the separate VISVAS eligibility conditions.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">
                      Interest Support
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#145c91]">
                      Up to 5%
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">
                      Individual Loan
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#263b52]">
                      Up to ₹5 lakh
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">
                      Route
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#263b52]">
                      Lending Institutions
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[10px] leading-5 text-[#8a7b62]">
                  VISVAS is shown as connected support and is not treated
                  as one of the five primary NSFDC scheme recommendations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-[#eaf5fa] p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#1769a8]">
                WANT PERSONALIZED RESULTS?
              </p>

              <h2 className="mt-2 font-serif text-2xl font-bold text-[#1c334c]">
                Sign in to find schemes matched to your profile.
              </h2>
            </div>

            <button
              onClick={onLogin}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b]"
            >
              Sign In & Continue
              <ArrowRight
                size={18}
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

/* =========================================================
   AUTH PAGE
========================================================= */

function AuthPage({
  mode,
  onBack,
  onLogin,
  onSignup,
  onSignupSuccess,
}) {
  const [authMode, setAuthMode] = useState(mode);

  const [form, setForm] = useState({
    name: "",
    identifier: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }

    if (formError) {
      setFormError("");
    }
  };

  const validate = () => {
    const newErrors = {};

    if (authMode === "signup") {
      if (!form.name.trim()) {
        newErrors.name = "Please enter your full name.";
      }
    }

    const idValidation = validateIdentifier(form.identifier);
    if (!idValidation.isValid) {
      newErrors.identifier = idValidation.error;
    }

    const pwdValidation = validatePassword(form.password);
    if (!pwdValidation.isValid) {
      newErrors.password = pwdValidation.error;
    }

    if (authMode === "signup") {
      if (!form.confirmPassword) {
        newErrors.confirmPassword = "Please re-enter your password.";
      } else if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Password and Confirm Password do not match.";
      }
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      idValidation,
    };
  };

  const submit = (event) => {
    event.preventDefault();

    const { isValid, idValidation } = validate();

    if (!isValid) {
      setFormError("Please fix the highlighted errors before continuing.");
      return;
    }

    if (authMode === "signup") {
      const regResult = registerUser({
        name: form.name.trim(),
        // Normalized 10-digit Indian phone number in string form (+91XXXXXXXXXX) or email
        identifier: idValidation.value,
        password: form.password,
        type: idValidation.type,
      });

      if (!regResult.success) {
        setFormError(regResult.error);
        return;
      }

      onSignupSuccess(regResult.user, rememberMe);
      return;
    }

    // Login mode
    const authResult = authenticateUser({
      identifier: idValidation.value,
      password: form.password,
    });

    if (!authResult.success) {
      setFormError(authResult.error);
      return;
    }

    onLogin(authResult.user, rememberMe);
  };

  return (
    <div className="min-h-screen bg-[#edf7fb]">
      <header className="border-b border-[#dce4ea] bg-white">
        <div className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#52677d] transition hover:text-[#145c91]"
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-lg border-2 border-[#c6a56b]" />
              <Sparkles size={19} />
            </div>

            <div>
              <p className="font-serif text-[19px] font-bold tracking-wide text-[#172a43]">
                SCHEME SAATHI
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#7e8d9e]">
                Secure Access
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs font-semibold text-[#718096] sm:flex">
            <LockKeyhole size={15} />
            Secure sign-in
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-82px)] items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-[1040px] overflow-hidden rounded-3xl border border-[#d5e1e8] bg-white shadow-[0_20px_60px_rgba(46,75,98,0.12)] lg:grid-cols-2">
          <div className="relative hidden overflow-hidden bg-[#dff1f7] p-10 lg:block">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/50 blur-2xl" />

            <div className="relative">
              <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#1769a8] shadow-sm">
                <Bot size={27} />
              </div>

              <p className="text-[11px] font-bold tracking-[0.18em] text-[#1769a8]">
                PERSONALIZED GUIDANCE
              </p>

              <h1 className="mt-4 max-w-md font-serif text-4xl font-bold leading-tight text-[#173656]">
                Your journey to the right scheme starts here.
              </h1>

              <p className="mt-5 max-w-md text-sm leading-7 text-[#61748a]">
                Sign in to let Scheme Saathi securely save your profile
                and provide personalized scheme discovery and
                recommendations.
              </p>

              <div className="mt-10 space-y-4">
                <AuthBenefit
                  icon={<ShieldCheck size={18} />}
                  title="Personalized matching"
                  text="Your profile can be used for future recommendations."
                />
                <AuthBenefit
                  icon={<FileText size={18} />}
                  title="Application journey"
                  text="Your account can later connect to documents and tracking."
                />
                <AuthBenefit
                  icon={<LockKeyhole size={18} />}
                  title="Secure account"
                  text="10-digit mobile number (+91) format & secure credentials."
                />
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-10">
            <div className="max-w-md">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                {authMode === "login"
                  ? "WELCOME BACK"
                  : "CREATE ACCOUNT"}
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                {authMode === "login"
                  ? "Sign in to continue"
                  : "Create your Scheme Saathi account"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#718096]">
                {authMode === "login"
                  ? "Login is required before we collect your personal information for scheme matching."
                  : "Create an account to continue to personalized scheme matching."}
              </p>

              {formError && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#fed7d7] bg-[#fff5f5] p-4 text-xs font-semibold text-[#c53030]">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#e53e3e]" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={submit} className="mt-8 space-y-5">
                {authMode === "signup" && (
                  <TextField
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={form.name}
                    error={errors.name}
                    onChange={(value) => updateField("name", value)}
                  />
                )}

                <TextField
                  label="Email or Mobile Number"
                  placeholder="e.g. 9845123456 or user@example.com"
                  value={form.identifier}
                  error={errors.identifier}
                  onChange={(value) => updateField("identifier", value)}
                />

                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                    Password
                  </label>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      placeholder="Enter password (minimum 6 characters)"
                      className={[
                        "w-full rounded-lg border bg-white px-4 py-3.5 pr-12 text-sm text-[#21364f] outline-none transition",
                        errors.password
                          ? "border-[#e53e3e] focus:border-[#e53e3e] focus:ring-4 focus:ring-[#e53e3e]/10"
                          : "border-[#ced9e1] placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10",
                      ].join(" ")}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#768798] hover:text-[#1769a8]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {errors.password && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#e53e3e]">
                      <AlertCircle size={14} className="shrink-0" />
                      {errors.password}
                    </p>
                  )}
                </div>

                {authMode === "signup" && (
                  <div>
                    <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                      Confirm Password
                    </label>

                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        placeholder="Re-enter password"
                        className={[
                          "w-full rounded-lg border bg-white px-4 py-3.5 pr-12 text-sm text-[#21364f] outline-none transition",
                          errors.confirmPassword
                            ? "border-[#e53e3e] focus:border-[#e53e3e] focus:ring-4 focus:ring-[#e53e3e]/10"
                            : "border-[#ced9e1] placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#768798] hover:text-[#1769a8]"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {errors.confirmPassword && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#e53e3e]">
                        <AlertCircle size={14} className="shrink-0" />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                )}

                {authMode === "login" && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-[#66778a] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 accent-[#145c91]"
                      />
                      Remember me
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "If you have forgotten your password, please create a new account or contact support.",
                        )
                      }
                      className="font-semibold text-[#1769a8] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#145c91] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#104d7b]"
                >
                  {authMode === "login"
                    ? "Sign In"
                    : "Create Account"}
                  <ArrowRight size={18} />
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e3e9ee]" />
                <span className="text-[11px] font-semibold text-[#95a1ad]">
                  OR
                </span>
                <div className="h-px flex-1 bg-[#e3e9ee]" />
              </div>

              {authMode === "login" ? (
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setErrors({});
                    setFormError("");
                    onSignup();
                  }}
                  className="w-full rounded-lg border border-[#cfdbe3] px-5 py-3.5 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
                >
                  Don't have an account? Create one
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setErrors({});
                    setFormError("");
                  }}
                  className="w-full rounded-lg border border-[#cfdbe3] px-5 py-3.5 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
                >
                  Already have an account? Sign in
                </button>
              )}

              <div className="mt-7 flex gap-2 rounded-lg bg-[#f6fafc] p-3 text-[11px] leading-5 text-[#778799]">
                <LockKeyhole
                  size={15}
                  className="mt-0.5 shrink-0 text-[#1769a8]"
                />
                <span>
                  You can explore general scheme information without
                  signing in. Login is required only for personalized
                  scheme matching.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SchemeFinder({
  onBack,
  isLoggedIn,
  currentUser,
}) {
  const [step, setStep] =
    useState(1);

  const [formData, setFormData] =
    useState({
      fullName: currentUser?.name || "",
      age: "",
      gender: "",
      state: "",
      district: "",
      category: "",
      annualIncome: "",
      purpose: "",
      businessType: "",
      projectStage: "",
      projectCost: "",
      requiredLoan: "",
      course: "",
      institution: "",
      courseFee: "",
      educationLevel: "",
      ownContribution: "",
      existingLoan: "",
      outstandingAmount: "",
      overdue: "",
    });

  const [results, setResults] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [stepErrors, setStepErrors] =
    useState({});

  const isBusiness = [
    "new_business",
    "business_expansion",
    "agriculture",
  ].includes(
    formData.purpose,
  );

  const isEducation =
    formData.purpose ===
    "education";

  const updateField = (
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    if (stepErrors[field]) {
      setStepErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    if (error) {
      setError("");
    }
  };

  const validateStep = (currentStep) => {
    const errs = {};

    if (currentStep === 1) {
      if (!formData.fullName || !formData.fullName.trim()) {
        errs.fullName = "Please enter your full name.";
      }

      if (!formData.age || String(formData.age).trim() === "") {
        errs.age = "Please enter your age.";
      } else {
        const numAge = Number(formData.age);
        if (isNaN(numAge) || numAge <= 0 || numAge > 120) {
          errs.age = "Please enter a valid age between 1 and 120.";
        }
      }

      if (!formData.gender) {
        errs.gender = "Please select your gender.";
      }

      if (!formData.category) {
        errs.category = "Please select your category.";
      }

      if (!formData.state) {
        errs.state = "Please select your State or Union Territory.";
      }

      if (!formData.district) {
        errs.district = "Please select your district.";
      }

      if (
        formData.annualIncome === "" ||
        formData.annualIncome === null ||
        formData.annualIncome === undefined
      ) {
        errs.annualIncome = "Please enter your annual family income.";
      } else {
        const numIncome = Number(formData.annualIncome);
        if (isNaN(numIncome) || numIncome < 0) {
          errs.annualIncome = "Annual family income must be 0 or greater.";
        }
      }
    } else if (currentStep === 2) {
      if (!formData.purpose) {
        errs.purpose = "Please select your requirement to continue.";
      }
    } else if (currentStep === 3) {
      if (isEducation) {
        if (!formData.educationLevel) {
          errs.educationLevel = "Please select your education level.";
        }
      } else {
        if (!formData.businessType) {
          errs.businessType = "Please select your project / business type.";
        }
      }
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) {
      setError("Please fill in all required details to continue to the next step.");
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    setError("");
    setStepErrors({});
    if (step < 5) {
      setStep(
        (current) =>
          current + 1,
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const previousStep = () => {
    setError("");
    setStepErrors({});
    if (step > 1) {
      setStep(
        (current) =>
          current - 1,
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const runSchemeMatching =
    async () => {
      setLoading(true);
      setError("");
      setResults(null);

      if (!formData.category) {
        setLoading(false);
        setError(
          "Please select your category before finding schemes.",
        );
        return;
      }

      if (!formData.gender) {
        setLoading(false);
        setError(
          "Please select your gender before finding schemes.",
        );
        return;
      }

      if (!formData.annualIncome) {
        setLoading(false);
        setError(
          "Please enter your annual family income before finding schemes.",
        );
        return;
      }

      if (!formData.purpose) {
        setLoading(false);
        setError(
          "Please select your requirement before finding schemes.",
        );
        return;
      }

      const payload = {
        category:
          formData.category,

        gender:
          formData.gender ||
          null,

        annual_income:
          Number(
            formData.annualIncome ||
              0,
          ),

        purpose:
          formData.purpose ||
          null,

        project_cost:
          formData.projectCost
            ? Number(
                formData.projectCost,
              )
            : null,

        required_loan:
          formData.requiredLoan
            ? Number(
                formData.requiredLoan,
              )
            : null,

        education_level:
          formData.educationLevel ||
          null,

        state:
          formData.state ||
          null,

        district:
          formData.district ||
          null,
      };

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/schemes/match`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                payload,
              ),
            },
          );

        if (!response.ok) {
          let errorMessage =
            "Unable to get scheme recommendations.";

          try {
            const errorData =
              await response.json();

            if (
              errorData?.detail
            ) {
              errorMessage =
                Array.isArray(
                  errorData.detail,
                )
                  ? errorData.detail
                      .map(
                        (item) =>
                          item.msg ||
                          String(
                            item,
                          ),
                      )
                      .join(
                        ", ",
                      )
                  : String(
                      errorData.detail,
                    );
            }
          } catch {
            // Keep default error.
          }

          throw new Error(
            errorMessage,
          );
        }

        const data =
          await response.json();

        /*
          CRITICAL FIX:
          Sanitize backend results BEFORE
          sending them to SchemeResults.
        */
        const normalizedResults =
          normalizeSchemeResults(
            data,
            formData,
          );

        setResults(
          normalizedResults,
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to connect to the Scheme Saathi backend.",
        );
      } finally {
        setLoading(false);
      }
    };



  const stepTitles = [
    "About You",
    "Your Requirement",
    "Project / Education",
    "Financial Profile",
    "Review",
  ];

  const progress =
    (step / 5) * 100;

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8fb] px-6">
        <div className="rounded-2xl border border-[#d8e3e9] bg-white p-8 text-center shadow-sm">
          <LockKeyhole
            size={32}
            className="mx-auto text-[#1769a8]"
          />

          <h2 className="mt-4 font-serif text-2xl font-bold text-[#172a43]">
            Login required
          </h2>

          <p className="mt-2 text-sm text-[#718096]">
            Please sign in before starting personalized scheme matching.
          </p>

          <button
            onClick={onBack}
            className="mt-6 rounded-lg bg-[#145c91] px-6 py-3 text-sm font-bold text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <SchemeResults
        results={results}
        formData={formData}
        onBack={() => {
          setResults(null);
          setStep(5);
          setError("");

          window.scrollTo({
            top: 0,
            behavior:
              "smooth",
          });
        }}
        onHome={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="border-b border-[#dce4ea] bg-white">
        <div className="mx-auto flex min-h-[80px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft
              size={18}
            />
            Back to Home
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />

              <Sparkles
                size={17}
              />
            </div>

            <div>
              <p className="font-serif text-[17px] font-bold tracking-wide text-[#172a43]">
                SCHEME SAATHI
              </p>

              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#8090a0]">
                Scheme Finder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[#145c91] bg-[#eef7fc] border border-[#d1e5f5] px-3 py-1.5 rounded-lg">
            <LockKeyhole
              size={14}
            />
            <span>{currentUser?.name || currentUser?.identifier || "Signed-in profile"}</span>
          </div>
        </div>
      </header>

      <div className="border-b border-[#dfe7ed] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1769a8]">
                STEP{" "}
                {String(
                  step,
                ).padStart(
                  2,
                  "0",
                )}{" "}
                OF 05
              </p>

              <h1 className="mt-1 font-serif text-2xl font-bold text-[#172a43]">
                {
                  stepTitles[
                    step - 1
                  ]
                }
              </h1>
            </div>

            <div className="w-full md:w-[360px]">
              <div className="mb-2 flex justify-between text-[11px] font-semibold text-[#7c8998]">
                <span>
                  Your progress
                </span>

                <span>
                  {Math.round(
                    progress,
                  )}
                  %
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#e3ebf0]">
                <div
                  className="h-full rounded-full bg-[#1769a8] transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 hidden grid-cols-5 gap-3 md:grid">
            {stepTitles.map(
              (
                title,
                index,
              ) => {
                const currentStep =
                  index + 1;

                const completed =
                  currentStep <
                  step;

                const active =
                  currentStep ===
                  step;

                return (
                  <div
                    key={title}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                        completed
                          ? "bg-[#1769a8] text-white"
                          : active
                            ? "border-2 border-[#1769a8] bg-white text-[#1769a8]"
                            : "bg-[#eef3f6] text-[#8492a0]",
                      ].join(
                        " ",
                      )}
                    >
                      {completed ? (
                        <Check
                          size={
                            14
                          }
                        />
                      ) : (
                        currentStep
                      )}
                    </div>

                    <span
                      className={[
                        "text-[11px] font-semibold",
                        active
                          ? "text-[#1769a8]"
                          : "text-[#82909f]",
                      ].join(
                        " ",
                      )}
                    >
                      {title}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1000px] px-6 py-10 pb-20">
        <div className="rounded-2xl border border-[#d9e2e9] bg-white p-6 shadow-[0_12px_35px_rgba(46,75,98,0.08)] md:p-9">
          {step ===
            1 && (
            <StepOne
              formData={
                formData
              }
              updateField={
                updateField
              }
              errors={
                stepErrors
              }
            />
          )}

          {step ===
            2 && (
            <StepTwo
              formData={
                formData
              }
              updateField={
                updateField
              }
              error={
                stepErrors.purpose
              }
            />
          )}

          {step ===
            3 && (
            <StepThree
              formData={
                formData
              }
              updateField={
                updateField
              }
              isBusiness={
                isBusiness
              }
              isEducation={
                isEducation
              }
              errors={
                stepErrors
              }
            />
          )}

          {step ===
            4 && (
            <StepFour
              formData={
                formData
              }
              updateField={
                updateField
              }
            />
          )}

          {step ===
            5 && (
            <StepFive
              formData={
                formData
              }
            />
          )}

          {error && (
            <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#edc8c8] bg-[#fff5f5] p-4 text-sm text-[#a03a3a]">
              <AlertCircle
                size={19}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-bold">
                  {step === 5
                    ? "Scheme matching failed"
                    : "Required details missing"}
                </p>

                <p className="mt-1 leading-5">
                  {error}
                </p>

                {!error.includes(
                  "Please",
                ) && step === 5 && (
                  <p className="mt-2 text-xs text-[#9b6666]">
                    Make sure the FastAPI backend is running on port 8000.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#e1e7ec] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={
                previousStep
              }
              disabled={
                step ===
                1
              }
              className={[
                "flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold",
                step === 1
                  ? "cursor-not-allowed text-[#b6bec7]"
                  : "text-[#52657b] transition hover:bg-[#f3f7fa]",
              ].join(" ")}
            >
              <ArrowLeft
                size={17}
              />
              Back
            </button>

            {step <
            5 ? (
              <button
                onClick={
                  nextStep
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-[#145c91] px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#104d7b]"
              >
                Continue
                <ArrowRight
                  size={17}
                />
              </button>
            ) : (
              <button
                onClick={
                  runSchemeMatching
                }
                disabled={
                  loading
                }
                className={[
                  "flex items-center justify-center gap-2 rounded-lg px-7 py-3.5 text-sm font-bold text-white shadow-md transition",
                  loading
                    ? "cursor-not-allowed bg-[#7d9aab]"
                    : "bg-[#145c91] hover:bg-[#104d7b]",
                ].join(
                  " ",
                )}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Finding Schemes...
                  </>
                ) : (
                  <>
                    Find My Schemes
                    <Sparkles
                      size={
                        17
                      }
                    />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   SCHEME RESULTS
========================================================= */

function SchemeResults({
  results,
  formData,
  onBack,
  onHome,
}) {
  const primaryEligible =
    Array.isArray(
      results?.primary?.eligible,
    )
      ? results.primary
          .eligible
      : [];

  const primaryIneligible =
    Array.isArray(
      results?.primary?.ineligible,
    )
      ? results.primary
          .ineligible
      : [];

  const secondaryEligible =
    Array.isArray(
      results?.secondary?.eligible,
    )
      ? results.secondary
          .eligible
      : [];

  const primaryMatchCount =
    primaryEligible.length;

  const secondaryMatchCount =
    secondaryEligible.length;

  const topScheme =
    primaryEligible[0] ||
    null;

  /*
    IMPORTANT:
    The display score can NEVER recommend
    a women-focused scheme to a male applicant.

    Even if backend sends 100,
    explicit gender restriction wins.
  */
  const backendMatchScore =
    results?.match_score ??
    results?.overall_match_score ??
    topScheme?.match_score ??
    null;

  const matchScore =
    backendMatchScore !==
      null &&
    backendMatchScore !==
      undefined
      ? normalizeMatchScore(
          backendMatchScore,
        )
      : calculateFallbackMatchScore(
          topScheme,
          formData,
        );

  /*
    Top scheme score.
  */
  const topSchemeScore =
    topScheme &&
    shouldExcludeForGender(
      topScheme,
      formData,
    )
      ? 0
      : normalizeMatchScore(
          topScheme?.match_score,
        ) ??
        calculateFallbackMatchScore(
          topScheme,
          formData,
        );

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="sticky top-0 z-50 border-b border-[#dce4ea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onHome}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft
              size={18}
            />
            Home
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />

              <Sparkles
                size={17}
              />
            </div>

            <p className="font-serif text-[18px] font-bold tracking-wide text-[#172a43]">
              SCHEME SAATHI
            </p>
          </div>

          <span className="hidden text-xs font-semibold text-[#718096] sm:block">
            Matching Results
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10 pb-20">
        <div className="rounded-2xl border border-[#cee0e8] bg-[#eaf6fa] p-7">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center md:gap-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.17em] text-[#1769a8]">
                SCHEME ELIGIBILITY CHECK COMPLETE
              </p>

              <h1 className="mt-2 font-serif text-3xl font-bold text-[#17334f] md:text-4xl">
                Here are the schemes you may be eligible for.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#60758a]">
                Eligibility is determined by the backend rule engine.
                Women-focused schemes are additionally filtered by the
                applicant's gender before recommendation.
              </p>
            </div>

            <div className="flex h-[122px] w-[122px] shrink-0 flex-col items-center justify-center rounded-full border-[8px] border-white bg-[#d6eaf2] shadow-sm">
              <div className="flex h-[44px] items-baseline justify-center">
                <span className="font-serif text-[36px] font-bold leading-none text-[#145c91]">
                  {matchScore !==
                  null
                    ? matchScore
                    : "—"}
                </span>

                {matchScore !==
                  null && (
                  <span className="ml-0.5 font-serif text-[18px] font-bold leading-none text-[#145c91]">
                    %
                  </span>
                )}
              </div>

              <span className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[#6a7d8e]">
                Match Score
              </span>
            </div>
          </div>
        </div>

        {topScheme && (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles
                size={18}
                className="text-[#c19855]"
              />

              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7a6a50]">
                TOP ELIGIBLE PRIMARY SCHEME
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[#35536a] bg-white p-7 shadow-[0_14px_40px_rgba(46,75,98,0.1)]">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#e7f3f8] px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[#1769a8]">
                      {
                        topScheme.scheme_id
                      }
                    </span>

                    <span className="rounded-full bg-[#edf6ec] px-3 py-1 text-[10px] font-bold text-[#47744a]">
                      ELIGIBLE
                    </span>

                    <span className="rounded-full bg-[#eaf5fa] px-3 py-1 text-[10px] font-bold text-[#145c91]">
                      {topSchemeScore}%
                      {" "}
                      MATCH
                    </span>
                  </div>

                  <h2 className="mt-4 font-serif text-3xl font-bold text-[#1b3148]">
                    {
                      topScheme.scheme_name
                    }
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#6e7f91]">
                    This scheme passed the current backend eligibility
                    filters for your submitted profile.
                  </p>
                </div>

                <div className="rounded-xl bg-[#f7fafc] p-5 md:min-w-[260px]">
                  <p className="text-[11px] font-semibold text-[#7f8c99]">
                    Matching reasons
                  </p>

                  <div className="mt-3 space-y-3">
                    {(
                      topScheme.reasons ||
                      []
                    ).map(
                      (reason) => (
                        <ReasonRow
                          key={
                            reason
                          }
                          text={
                            reason
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>

              {topScheme.gender_status
                ?.message && (
                <div className="mt-6 rounded-xl border border-[#e3d7bf] bg-[#fbf7ee] p-4">
                  <div className="flex gap-3">
                    <Sparkles
                      size={17}
                      className="mt-0.5 shrink-0 text-[#ad8245]"
                    />

                    <p className="text-xs leading-5 text-[#756447]">
                      {
                        topScheme
                          .gender_status
                          .message
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                PRIMARY RECOMMENDATIONS
              </p>

              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                Eligible PS-Core Schemes
              </h2>
            </div>

            <span className="text-xs font-semibold text-[#7a8998]">
              {primaryMatchCount}{" "}
              eligible
            </span>
          </div>

          {primaryEligible.length ===
          0 ? (
            <EmptyState
              title="No primary scheme matched"
              text="Your submitted profile did not satisfy the current primary-scheme eligibility rules."
            />
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {primaryEligible.map(
                (scheme) => (
                  <EligibleSchemeCard
                    key={
                      scheme.scheme_id
                    }
                    scheme={scheme}
                    formData={
                      formData
                    }
                    featured={
                      scheme.scheme_id ===
                      topScheme?.scheme_id
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7a8998]">
                SECONDARY
              </p>

              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                Related / Connected Support
              </h2>
            </div>

            <span className="text-xs font-semibold text-[#7a8998]">
              {secondaryMatchCount}{" "}
              available
            </span>
          </div>

          {secondaryEligible.length ===
          0 ? (
            <EmptyState
              title="No secondary support matched"
              text="No connected support programme passed the current filters."
            />
          ) : (
            <div className="mt-5 grid gap-5">
              {secondaryEligible.map(
                (scheme) => (
                  <EligibleSchemeCard
                    key={
                      scheme.scheme_id
                    }
                    scheme={scheme}
                    formData={
                      formData
                    }
                    secondary
                  />
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#8c6e6e]">
              NOT ELIGIBLE
            </p>

            <h2 className="mt-1 font-serif text-2xl font-bold text-[#48343d]">
              Primary schemes that were filtered out
            </h2>

            <p className="mt-2 text-sm text-[#7b8087]">
              These are shown for transparency so the applicant can
              understand why a scheme was not recommended.
            </p>
          </div>

          {primaryIneligible.length ===
          0 ? (
            <div className="mt-5 rounded-xl border border-[#dfe9df] bg-white p-5 text-sm text-[#607a60]">
              No primary schemes were filtered out.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {primaryIneligible.map(
                (scheme) => (
                  <div
                    key={
                      `${scheme.scheme_id}-${scheme.eligibility_status || "ineligible"}`
                    }
                    className="rounded-xl border border-[#eadfe1] bg-white p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-[#f3f0f1] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#7f6d74]">
                            {
                              scheme.scheme_id
                            }
                          </span>

                          <span className="rounded-full bg-[#fff0f0] px-3 py-1 text-[10px] font-bold text-[#a44c4c]">
                            NOT ELIGIBLE
                          </span>

                          {scheme.match_score ===
                            0 &&
                            scheme.eligibility_status ===
                              "NOT_ELIGIBLE_GENDER" && (
                              <span className="rounded-full bg-[#fff0f0] px-3 py-1 text-[10px] font-bold text-[#a44c4c]">
                                0% MATCH
                              </span>
                            )}
                        </div>

                        <h3 className="mt-3 font-serif text-xl font-bold text-[#3b3138]">
                          {
                            scheme.scheme_name
                          }
                        </h3>
                      </div>

                      <div className="max-w-[560px] space-y-2">
                        {(
                          scheme.failures ||
                          []
                        ).length ===
                        0 ? (
                          <div className="text-xs text-[#8a747a]">
                            No detailed failure reason was returned by the
                            backend.
                          </div>
                        ) : (
                          (
                            scheme.failures ||
                            []
                          ).map(
                            (
                              failure,
                              index,
                            ) => (
                              <div
                                key={`${failure}-${index}`}
                                className="flex gap-2 text-xs leading-5 text-[#915858]"
                              >
                                <AlertCircle
                                  size={
                                    15
                                  }
                                  className="mt-0.5 shrink-0"
                                />

                                <span>
                                  {
                                    failure
                                  }
                                </span>
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-[#d7e2e8] bg-white p-7">
          <div className="flex items-start gap-3">
            <Bot
              size={21}
              className="mt-0.5 shrink-0 text-[#1769a8]"
            />

            <div>
              <h3 className="font-serif text-xl font-bold text-[#263b52]">
                What happens next?
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#6e7f91]">
                The current result is the deterministic eligibility result
                from FastAPI. Eligible schemes can then be ranked, given a
                detailed match score, explained, and connected to documents,
                financial calculations and channel-partner routing.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={
              onBack
            }
            className="flex items-center gap-2 rounded-lg border border-[#cfdbe3] bg-white px-5 py-3 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
          >
            <ArrowLeft
              size={17}
            />
            Back to Profile
          </button>

          <button
            onClick={
              onHome
            }
            className="flex items-center gap-2 rounded-lg bg-[#145c91] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#104d7b]"
          >
            Back to Home
          </button>
        </div>

        <div className="mt-8 text-xs text-[#8a97a3]">
          Submitted profile:{" "}
          {formData.fullName ||
            "Applicant"}{" "}
          • Category:{" "}
          {formData.category ||
            "Not selected"}{" "}
          •{" "}
          {formData.state
            ? formatValue(
                formData.state,
              )
            : "Location not provided"}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   STEP 1
========================================================= */

function StepOne({
  formData,
  updateField,
  errors = {},
}) {
  const indiaLocations = getIndiaLocations();

  const selectedLocation = indiaLocations.find(
    (location) =>
      (typeof location === "string" ? location : location.value) === formData.state,
  );

  const stateName = selectedLocation
    ? (typeof selectedLocation === "string" ? selectedLocation : selectedLocation.name)
    : formData.state;

  const districts = stateName ? getIndiaDistricts(stateName) : [];

  return (
    <div>
      <SectionIntro
        eyebrow="PERSONAL INFORMATION"
        title="Tell us a little about yourself"
        description="These details help Scheme Saathi identify the schemes that may apply to your profile."
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TextField
          label="Full Name"
          placeholder="Enter your full name"
          value={
            formData.fullName
          }
          error={errors.fullName}
          onChange={(value) =>
            updateField(
              "fullName",
              value,
            )
          }
        />

        <TextField
          label="Age"
          placeholder="Enter your age"
          type="number"
          value={
            formData.age
          }
          error={errors.age}
          onChange={(value) =>
            updateField(
              "age",
              value,
            )
          }
        />

        <SelectField
          label="Gender"
          value={
            formData.gender
          }
          error={errors.gender}
          onChange={(value) =>
            updateField(
              "gender",
              value,
            )
          }
          options={[
            {
              value: "female",
              label: "Female",
            },
            {
              value: "male",
              label: "Male",
            },
            {
              value: "other",
              label: "Other",
            },
            {
              value: "prefer_not",
              label:
                "Prefer not to say",
            },
          ]}
        />

        <SelectField
          label="Category"
          helper="Your category will be checked against each scheme's actual eligibility rules."
          value={
            formData.category
          }
          error={errors.category}
          onChange={(value) =>
            updateField(
              "category",
              value,
            )
          }
          options={[
            {
              value: "SC",
              label:
                "Scheduled Caste (SC)",
            },
            {
              value: "ST",
              label:
                "Scheduled Tribe (ST)",
            },
            {
              value: "OBC",
              label:
                "Other Backward Class (OBC)",
            },
            {
              value: "GENERAL",
              label: "General",
            },
            {
              value: "EWS",
              label:
                "Economically Weaker Section (EWS)",
            },
            {
              value:
                "SAFAI_KARAMCHARI",
              label:
                "Safai Karamchari",
            },
          ]}
        />

        <SelectField
          label="State / Union Territory"
          value={
            formData.state
          }
          error={errors.state}
          placeholder="Select your State / Union Territory"
          onChange={(value) => {
            updateField(
              "state",
              value,
            );

            // A district belongs to a specific State/UT.
            // Reset it whenever the State/UT changes.
            updateField(
              "district",
              "",
            );
          }}
          options={indiaLocations.map(
            (location) => ({
              value: typeof location === "string" ? location : location.value,
              label: typeof location === "string" ? location : (location.label || location.name),
            }),
          )}
        />

        <SelectField
          label="District"
          value={
            formData.district
          }
          error={errors.district}
          disabled={!formData.state}
          placeholder={
            formData.state
              ? "Select your district"
              : "First select State / Union Territory"
          }
          onChange={(value) =>
            updateField(
              "district",
              value,
            )
          }
          options={districts.map(
            (districtName) => ({
              value: districtName,
              label: districtName,
            }),
          )}
        />

        <TextField
          label="Annual Family Income"
          prefix="₹"
          type="number"
          placeholder="e.g. 320000"
          value={
            formData.annualIncome
          }
          error={errors.annualIncome}
          onChange={(value) =>
            updateField(
              "annualIncome",
              value,
            )
          }
        />
      </div>

      <InfoBox
        icon={
          <ShieldCheck
            size={18}
          />
        }
      >
        Scheme Saathi first applies rule-based scheme eligibility. AI can
        assist with ranking and explanation only after eligible schemes have
        been identified.
      </InfoBox>
    </div>
  );
}

/* =========================================================
   STEP 2
========================================================= */

function StepTwo({
  formData,
  updateField,
  error,
}) {
  const purposes = [
    {
      value: "new_business",
      icon: (
        <Sparkles size={24} />
      ),
      title:
        "Start a New Business",
      text: "I want financing to start a new income-generating activity.",
    },

    {
      value:
        "business_expansion",
      icon: (
        <ArrowRight
          size={24}
        />
      ),
      title:
        "Expand Existing Business",
      text: "I already have a business and want to grow it.",
    },

    {
      value: "agriculture",
      icon: (
        <MapPin size={24} />
      ),
      title:
        "Agriculture / Allied",
      text: "My requirement is related to agriculture or allied activities.",
    },

    {
      value: "education",
      icon: (
        <FileText
          size={24}
        />
      ),
      title: "Education",
      text: "I need financing for eligible education or professional study.",
    },

    {
      value: "skill",
      icon: <Bot size={24} />,
      title:
        "Skill / Vocational",
      text: "I need support related to skill or vocational development.",
    },
  ];

  return (
    <div>
      <SectionIntro
        eyebrow="YOUR REQUIREMENT"
        title="What do you need support for?"
        description="Choose the option that most closely matches your current financial requirement."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {purposes.map(
          (purpose) => {
            const selected =
              formData.purpose ===
              purpose.value;

            return (
              <button
                key={
                  purpose.value
                }
                type="button"
                onClick={() =>
                  updateField(
                    "purpose",
                    purpose.value,
                  )
                }
                className={[
                  "group relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition",
                  selected
                    ? "border-[#1769a8] bg-[#eef7fb] shadow-sm"
                    : "border-[#dce4ea] bg-white hover:border-[#a9c8da] hover:bg-[#f8fbfd]",
                ].join(
                  " ",
                )}
              >
                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    selected
                      ? "bg-[#1769a8] text-white"
                      : "bg-[#e8f3f8] text-[#1769a8]",
                  ].join(
                    " ",
                  )}
                >
                  {
                    purpose.icon
                  }
                </div>

                <div className="pr-7">
                  <h3 className="font-serif text-[17px] font-bold text-[#1d3048]">
                    {
                      purpose.title
                    }
                  </h3>

                  <p className="mt-1 text-[12px] leading-5 text-[#718096]">
                    {
                      purpose.text
                    }
                  </p>
                </div>

                {selected && (
                  <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-white">
                    <Check
                      size={14}
                    />
                  </div>
                )}
              </button>
            );
          },
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#edc8c8] bg-[#fff5f5] p-3 text-xs font-semibold text-[#a03a3a]">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <InfoBox
        icon={
          <Bot size={18} />
        }
      >
        Your selected purpose helps the backend identify compatible schemes.
        Final eligibility remains rule-based.
      </InfoBox>
    </div>
  );
}

/* =========================================================
   STEP 3
========================================================= */

function StepThree({
  formData,
  updateField,
  isBusiness,
  isEducation,
  errors = {},
}) {
  return (
    <div>
      <SectionIntro
        eyebrow="PROJECT / EDUCATION"
        title={
          isEducation
            ? "Tell us about your education requirement"
            : "Tell us about your project"
        }
        description={
          isEducation
            ? "These details will help identify applicable educational financing options."
            : "Provide your project details so the backend can compare them against scheme rules."
        }
      />

      {isEducation ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <SelectField
            label="Education Level"
            value={
              formData.educationLevel
            }
            error={errors.educationLevel}
            onChange={(value) =>
              updateField(
                "educationLevel",
                value,
              )
            }
            options={[
              {
                value:
                  "professional",
                label:
                  "Professional / Technical",
              },
              {
                value:
                  "undergraduate",
                label:
                  "Undergraduate",
              },
              {
                value:
                  "postgraduate",
                label:
                  "Postgraduate",
              },
              {
                value: "other",
                label: "Other",
              },
            ]}
          />

          <TextField
            label="Course"
            placeholder="e.g. B.Tech Computer Science"
            value={
              formData.course
            }
            onChange={(value) =>
              updateField(
                "course",
                value,
              )
            }
          />

          <TextField
            label="Institution"
            placeholder="Enter institution name"
            value={
              formData.institution
            }
            onChange={(value) =>
              updateField(
                "institution",
                value,
              )
            }
          />

          <TextField
            label="Course Fee"
            prefix="₹"
            type="number"
            placeholder="e.g. 800000"
            value={
              formData.courseFee
            }
            onChange={(value) =>
              updateField(
                "courseFee",
                value,
              )
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <SelectField
            label="Project / Business Type"
            value={
              formData.businessType
            }
            error={errors.businessType}
            onChange={(value) =>
              updateField(
                "businessType",
                value,
              )
            }
            options={[
              {
                value:
                  "tailoring",
                label:
                  "Tailoring / Garment",
              },
              {
                value:
                  "retail",
                label:
                  "Retail / Shop",
              },
              {
                value: "food",
                label:
                  "Food / Catering",
              },
              {
                value: "dairy",
                label:
                  "Dairy / Animal Husbandry",
              },
              {
                value:
                  "services",
                label:
                  "Service Business",
              },
              {
                value:
                  "manufacturing",
                label:
                  "Small Manufacturing",
              },
              {
                value: "other",
                label:
                  "Other",
              },
            ]}
          />

          <SelectField
            label="Project Stage"
            value={
              formData.projectStage
            }
            onChange={(value) =>
              updateField(
                "projectStage",
                value,
              )
            }
            options={[
              {
                value: "new",
                label: "New Project",
              },
              {
                value:
                  "existing",
                label:
                  "Existing Project",
              },
            ]}
          />

          <TextField
            label="Estimated Project Cost"
            prefix="₹"
            type="number"
            placeholder="e.g. 300000"
            value={
              formData.projectCost
            }
            onChange={(value) =>
              updateField(
                "projectCost",
                value,
              )
            }
          />

          <TextField
            label="Required Loan Amount"
            prefix="₹"
            type="number"
            placeholder="e.g. 250000"
            value={
              formData.requiredLoan
            }
            onChange={(value) =>
              updateField(
                "requiredLoan",
                value,
              )
            }
          />
        </div>
      )}

      {isBusiness && (
        <div className="mt-6 rounded-xl border border-[#dbe6ec] bg-[#f8fbfd] p-5">
          <div className="flex gap-3">
            <Bot
              className="mt-0.5 shrink-0 text-[#1769a8]"
              size={19}
            />

            <div>
              <p className="text-sm font-bold text-[#284159]">
                Why we ask this
              </p>

              <p className="mt-1 text-xs leading-5 text-[#6d7d8f]">
                Project type and amount are important inputs for
                scheme-level financial eligibility checks.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STEP 4
========================================================= */

function StepFour({
  formData,
  updateField,
}) {
  return (
    <div>
      <SectionIntro
        eyebrow="FINANCIAL PROFILE"
        title="A little more about your finances"
        description="This information can support scheme and channel-partner matching."
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TextField
          label="Your Own Contribution"
          prefix="₹"
          type="number"
          placeholder="e.g. 50000"
          value={
            formData.ownContribution
          }
          onChange={(value) =>
            updateField(
              "ownContribution",
              value,
            )
          }
        />

        <SelectField
          label="Do you have an existing loan?"
          value={
            formData.existingLoan
          }
          onChange={(value) =>
            updateField(
              "existingLoan",
              value,
            )
          }
          options={[
            {
              value: "no",
              label: "No",
            },
            {
              value: "yes",
              label: "Yes",
            },
          ]}
        />

        {formData.existingLoan ===
          "yes" && (
          <>
            <TextField
              label="Outstanding Loan Amount"
              prefix="₹"
              type="number"
              placeholder="e.g. 90000"
              value={
                formData.outstandingAmount
              }
              onChange={(value) =>
                updateField(
                  "outstandingAmount",
                  value,
                )
              }
            />

            <SelectField
              label="Any Existing Overdue?"
              value={
                formData.overdue
              }
              onChange={(value) =>
                updateField(
                  "overdue",
                  value,
                )
              }
              options={[
                {
                  value: "no",
                  label: "No",
                },
                {
                  value: "yes",
                  label: "Yes",
                },
                {
                  value:
                    "not_sure",
                  label:
                    "Not sure",
                },
              ]}
            />
          </>
        )}
      </div>

      <InfoBox
        icon={
          <ShieldCheck
            size={18}
          />
        }
      >
        Financial information supports eligibility and partner-routing
        decisions. It does not itself guarantee loan approval.
      </InfoBox>
    </div>
  );
}

/* =========================================================
   STEP 5
========================================================= */

function StepFive({
  formData,
}) {
  const purposeLabels = {
    new_business:
      "Start a New Business",

    business_expansion:
      "Expand Existing Business",

    agriculture:
      "Agriculture / Allied",

    education:
      "Education",

    skill:
      "Skill / Vocational",
  };

  const genderLabels = {
    female: "Female",
    male: "Male",
    other: "Other",
    prefer_not:
      "Prefer not to say",
  };

  const categoryLabels = {
    SC:
      "Scheduled Caste (SC)",

    ST:
      "Scheduled Tribe (ST)",

    OBC:
      "Other Backward Class (OBC)",

    GENERAL:
      "General",

    EWS:
      "Economically Weaker Section (EWS)",

    SAFAI_KARAMCHARI:
      "Safai Karamchari",
  };

  return (
    <div>
      <SectionIntro
        eyebrow="FINAL REVIEW"
        title="Review your information"
        description="Please check your details before sending your profile to the scheme-matching backend."
      />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <ReviewCard
          title="Personal Information"
          icon={
            <UserRound
              size={20}
            />
          }
          rows={[
            [
              "Name",
              formData.fullName ||
                "Not provided",
            ],

            [
              "Age",
              formData.age ||
                "Not provided",
            ],

            [
              "Gender",
              genderLabels[
                formData.gender
              ] ||
                "Not selected",
            ],

            [
              "Category",
              categoryLabels[
                formData.category
              ] ||
                "Not selected",
            ],

            [
              "State",
              formatValue(
                formData.state,
              ),
            ],

            [
              "District",
              formData.district ||
                "Not provided",
            ],

            [
              "Annual Family Income",
              formData.annualIncome
                ? formatCurrency(
                    formData.annualIncome,
                  )
                : "Not provided",
            ],
          ]}
        />

        <ReviewCard
          title="Requirement"
          icon={
            <Sparkles
              size={20}
            />
          }
          rows={[
            [
              "Purpose",
              purposeLabels[
                formData.purpose
              ] ||
                "Not selected",
            ],

            [
              "Business Type",
              formatValue(
                formData.businessType,
              ),
            ],

            [
              "Project Stage",
              formatValue(
                formData.projectStage,
              ),
            ],

            [
              "Project Cost",
              formData.projectCost
                ? formatCurrency(
                    formData.projectCost,
                  )
                : "Not provided",
            ],

            [
              "Required Loan",
              formData.requiredLoan
                ? formatCurrency(
                    formData.requiredLoan,
                  )
                : "Not provided",
            ],
          ]}
        />

        <ReviewCard
          title="Education"
          icon={
            <FileText
              size={20}
            />
          }
          rows={[
            [
              "Level",
              formatValue(
                formData.educationLevel,
              ),
            ],

            [
              "Course",
              formData.course ||
                "Not applicable",
            ],

            [
              "Institution",
              formData.institution ||
                "Not applicable",
            ],

            [
              "Course Fee",
              formData.courseFee
                ? formatCurrency(
                    formData.courseFee,
                  )
                : "Not applicable",
            ],
          ]}
        />

        <ReviewCard
          title="Financial Profile"
          icon={
            <Calculator
              size={20}
            />
          }
          rows={[
            [
              "Own Contribution",
              formData.ownContribution
                ? formatCurrency(
                    formData.ownContribution,
                  )
                : "Not provided",
            ],

            [
              "Existing Loan",
              formData.existingLoan ===
              "yes"
                ? "Yes"
                : formData.existingLoan ===
                    "no"
                  ? "No"
                  : "Not selected",
            ],

            [
              "Outstanding",
              formData.outstandingAmount
                ? formatCurrency(
                    formData.outstandingAmount,
                  )
                : "Not applicable",
            ],

            [
              "Overdue",
              formData.overdue
                ? formatValue(
                    formData.overdue,
                  )
                : "Not applicable",
            ],
          ]}
        />
      </div>

      <div className="mt-7 rounded-xl border border-[#cfe0ea] bg-[#edf7fb] p-5">
        <div className="flex gap-3">
          <Bot
            className="mt-0.5 shrink-0 text-[#1769a8]"
            size={20}
          />

          <div>
            <p className="font-bold text-[#244058]">
              What happens after you submit?
            </p>

            <p className="mt-1 text-xs leading-6 text-[#62768a]">
              Scheme Saathi sends these details to FastAPI. The backend
              applies rule-based eligibility first. Eligible schemes are
              then returned for recommendation and ranking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SHARED COMPONENTS
========================================================= */

function SectionIntro({
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
        {eyebrow}
      </p>

      <h2 className="mt-2 max-w-[700px] font-serif text-[32px] font-bold leading-tight text-[#172a43]">
        {title}
      </h2>

      <p className="mt-3 max-w-[700px] text-[14px] leading-6 text-[#6d7d8f]">
        {description}
      </p>
    </div>
  );
}

function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  prefix,
  error,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#2c4058]">
        {label}
      </span>

      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7a8999]">
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={[
            "w-full rounded-lg border bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition",
            error
              ? "border-[#e53e3e] focus:border-[#e53e3e] focus:ring-4 focus:ring-[#e53e3e]/10"
              : "border-[#ced9e1] placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10",
            prefix
              ? "pl-9"
              : "",
          ].join(" ")}
        />
      </div>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#e53e3e]">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </label>
  );
}

function SelectField({
  label,
  helper,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select an option",
  error,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#2c4058]">
        {label}
      </span>

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={[
            "w-full appearance-none rounded-lg border px-4 py-3.5 pr-10 text-sm outline-none transition",
            disabled
              ? "cursor-not-allowed border-[#ced9e1] bg-[#f1f4f6] text-[#9aa6b2]"
              : error
                ? "border-[#e53e3e] bg-white text-[#21364f] focus:border-[#e53e3e] focus:ring-4 focus:ring-[#e53e3e]/10"
                : "border-[#ced9e1] bg-white text-[#21364f] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10",
          ].join(" ")}
        >
          <option value="">
            {placeholder}
          </option>

          {options.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <ChevronDown
          size={17}
          className={[
            "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2",
            disabled
              ? "text-[#aeb8c1]"
              : "text-[#718096]",
          ].join(" ")}
        />
      </div>

      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#e53e3e]">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </p>
      ) : helper ? (
        <span className="mt-1.5 block text-[10px] text-[#8a97a4]">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function InfoBox({
  icon,
  children,
}) {
  return (
    <div className="mt-8 flex gap-3 rounded-xl border border-[#d8e6ed] bg-[#f4fafc] p-4">
      <div className="mt-0.5 shrink-0 text-[#1769a8]">
        {icon}
      </div>

      <p className="text-xs leading-5 text-[#60758a]">
        {children}
      </p>
    </div>
  );
}

function ReviewCard({
  title,
  icon,
  rows,
}) {
  return (
    <div className="rounded-xl border border-[#dbe3e9] bg-[#fbfcfd] p-5">
      <div className="flex items-center gap-3 border-b border-[#e5eaee] pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5f2f8] text-[#1769a8]">
          {icon}
        </div>

        <h3 className="font-serif text-[17px] font-bold text-[#263a52]">
          {title}
        </h3>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map(
          ([label, value]) => (
            <div
              key={
                label
              }
              className="flex items-start justify-between gap-5 text-xs"
            >
              <span className="text-[#7a8998]">
                {label}
              </span>

              <span className="max-w-[60%] text-right font-semibold text-[#2b4058]">
                {value}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function TrustItem({
  icon,
  text,
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-[#34475d]">
      <span className="text-[#17669a]">
        {icon}
      </span>

      {text}
    </div>
  );
}

function MatchPoint({
  icon,
  title,
  subtitle,
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#dcecf4] text-[#1769a8]">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold leading-4 text-[#25374c]">
          {title}
        </p>

        <p className="text-[10px] leading-4 text-[#718196]">
          {subtitle}
        </p>
      </div>

      <CheckCircle2
        size={15}
        className="mt-1 shrink-0 text-[#3d9a87]"
      />
    </div>
  );
}

function FeatureStrip({
  icon,
  title,
  text,
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-5 lg:px-7">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#17669a] shadow-sm ring-1 ring-[#e5ded3]">
        {icon}
      </div>

      <div>
        <h3 className="font-serif text-[16px] font-bold text-[#1d2d42]">
          {title}
        </h3>

        <p className="mt-1 text-[11px] leading-5 text-[#657487]">
          {text}
        </p>
      </div>
    </div>
  );
}

function ProcessStep({
  number,
  icon,
  title,
  text,
  iconClass,
}) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div
        className={`flex h-[76px] w-[76px] items-center justify-center rounded-full shadow-sm ring-4 ring-white ${iconClass}`}
      >
        {icon}
      </div>

      <p className="mt-5 text-[11px] font-semibold text-[#8a9198]">
        {number}.
      </p>

      <h3 className="mt-1 font-serif text-[17px] font-bold text-[#25364a]">
        {title}
      </h3>

      <p className="mt-2 max-w-[210px] text-[12px] leading-5 text-[#718096]">
        {text}
      </p>
    </div>
  );
}

/* =========================================================
   EXPLORE CARD
========================================================= */

function SchemeCard({
  code,
  title,
  description,
  rate,
  limit,
  loan,
  eligibility,
  documents,
  route,
  icon,
}) {
  return (
    <div className="group rounded-2xl border border-[#d8e3e9] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f9] text-[#1769a8]">
          {icon}
        </div>

        <span className="rounded-full bg-[#f1f5f8] px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[#768797]">
          {code}
        </span>
      </div>

      <h3 className="mt-6 font-serif text-xl font-bold text-[#1d3048]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#718096]">
        {description}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#f7fafc] p-3">
          <p className="text-[10px] text-[#84919d]">
            Interest Rate
          </p>

          <p className="mt-1 text-sm font-bold text-[#145c91]">
            {rate}
          </p>
        </div>

        <div className="rounded-lg bg-[#f7fafc] p-3">
          <p className="text-[10px] text-[#84919d]">
            Maximum Loan
          </p>

          <p className="mt-1 text-sm font-bold text-[#263b52]">
            {loan}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#e1e8ed] p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8995a0]">
          Financial Range
        </p>

        <p className="mt-1 text-xs leading-5 text-[#60758a]">
          {limit}
        </p>
      </div>

      <div className="mt-4 rounded-xl bg-[#f8fbfd] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#1769a8]">
          Eligibility
        </p>

        <div className="mt-3 space-y-2">
          {eligibility.map(
            (item) => (
              <div
                key={
                  item
                }
                className="flex items-start gap-2 text-xs leading-5 text-[#60758a]"
              >
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-[#3d9a87]"
                />

                <span>
                  {item}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#fbf7ee] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a7047]">
          Indicative Documents
        </p>

        <div className="mt-3 space-y-2">
          {documents.map(
            (document) => (
              <div
                key={
                  document
                }
                className="flex items-start gap-2 text-xs leading-5 text-[#756447]"
              >
                <FileText
                  size={14}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {document}
                </span>
              </div>
            ),
          )}
        </div>

        <p className="mt-3 text-[10px] leading-4 text-[#8a7b62]">
          Final document requirements may vary by the concerned
          channelizing / lending agency.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs font-semibold text-[#1769a8]">
        <MapPin
          size={15}
          className="mt-0.5 shrink-0"
        />

        <span>
          Application route:{" "}
          {route}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   ELIGIBLE RESULT CARD
========================================================= */

function EligibleSchemeCard({
  scheme,
  formData,
  featured = false,
  secondary = false,
}) {
  /*
    Absolute safety:
    even if this component accidentally receives
    a women-focused/non-female scheme,
    its displayed score becomes 0.
  */
  const schemeMatchScore =
    shouldExcludeForGender(
      scheme,
      formData,
    )
      ? 0
      : normalizeMatchScore(
          scheme?.match_score,
        ) ??
        calculateFallbackMatchScore(
          scheme,
          formData,
        );

  const reasons =
    Array.isArray(
      scheme?.reasons,
    )
      ? scheme.reasons
      : [];

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-6 shadow-sm",
        featured
          ? "border-2 border-[#35536a]"
          : "border-[#d8e3e9]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e7f3f8] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#1769a8]">
              {
                scheme.scheme_id
              }
            </span>

            <span
              className={[
                "rounded-full px-3 py-1 text-[10px] font-bold",
                secondary
                  ? "bg-[#f1eef9] text-[#675685]"
                  : "bg-[#edf6ec] text-[#47744a]",
              ].join(
                " ",
              )}
            >
              {secondary
                ? "CONNECTED SUPPORT"
                : "ELIGIBLE"}
            </span>

            <span className="rounded-full bg-[#eaf5fa] px-3 py-1 text-[10px] font-bold text-[#145c91]">
              {
                schemeMatchScore
              }
              % MATCH
            </span>
          </div>

          <h3 className="mt-4 font-serif text-xl font-bold text-[#20344b]">
            {
              scheme.scheme_name
            }
          </h3>
        </div>

        <CheckCircle2
          size={21}
          className="shrink-0 text-[#3d9a87]"
        />
      </div>

      <div className="mt-5 rounded-xl bg-[#f7fafc] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8995a0]">
          Why it matched
        </p>

        {reasons.length ===
        0 ? (
          <p className="mt-3 text-xs text-[#718096]">
            Eligibility criteria were satisfied according to the backend
            rule engine.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {reasons.map(
              (reason) => (
                <ReasonRow
                  key={
                    reason
                  }
                  text={
                    reason
                  }
                />
              ),
            )}
          </div>
        )}
      </div>

      {scheme.gender_status
        ?.message && (
        <div className="mt-4 rounded-lg bg-[#fbf7ee] p-3 text-xs leading-5 text-[#756447]">
          {
            scheme
              .gender_status
              .message
          }
        </div>
      )}
    </div>
  );
}

/* =========================================================
   REASON ROW
========================================================= */

function ReasonRow({
  text,
}) {
  return (
    <div className="flex items-start gap-2 text-xs leading-5 text-[#60758a]">
      <CheckCircle2
        size={14}
        className="mt-0.5 shrink-0 text-[#3d9a87]"
      />

      <span>
        {text}
      </span>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[#d4dfe6] bg-white p-7 text-center">
      <AlertCircle
        size={24}
        className="mx-auto text-[#8b98a5]"
      />

      <h3 className="mt-3 font-serif text-lg font-bold text-[#3a4c60]">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-[#7b8998]">
        {text}
      </p>
    </div>
  );
}

/* =========================================================
   AUTH BENEFIT
========================================================= */

function AuthBenefit({
  icon,
  title,
  text,
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1769a8] shadow-sm">
        {icon}
      </div>

      <div>
        <p className="text-sm font-bold text-[#29445d]">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-[#6d7f92]">
          {text}
        </p>
      </div>
    </div>
  );
}

export default App;
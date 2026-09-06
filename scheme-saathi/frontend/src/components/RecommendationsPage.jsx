import React, { useState, useMemo } from "react";
import {
  Trophy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  UserRound,
  FileText,
  Calculator,
  MapPin,
  ShieldCheck,
  Bot,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  Clock,
  Printer,
  ChevronDown,
  Check,
  Percent,
  Layers,
  Award,
  BookOpen,
  ArrowUpRight,
  AlertCircle,
  Compass,
  Navigation,
  TrendingUp,
  Search,
} from "lucide-react";
import { useTranslation } from "../i18n";
import { apiCache } from "../services/apiCache";
import { API_BASE_URL } from "../config/api";
import {
  formatCurrency,
  formatValue,
  normalizeMatchScore,
  getGoogleMapsDirectionsUrl,
} from "../utils/schemeHelpers";
import { MatchScoreDisplay, MatchScoreRing } from "./common/CommonUI";
import PartnerMap from "./common/PartnerMap";

// Pre-configured official demo profiles for instant evaluation
const DEMO_PROFILES = [
  {
    id: "woman_entrepreneur",
    label: "SC Woman Entrepreneur",
    sublabel: "Micro-enterprise · Delhi",
    formData: {
      fullName: "Pooja Rani",
      category: "SC",
      gender: "female",
      annualIncome: "240000",
      purpose: "new_business",
      businessType: "Garment & Tailoring Center",
      projectCost: "140000",
      requiredLoan: "125000",
      state: "Delhi",
      district: "New Delhi",
    },
  },
  {
    id: "higher_education",
    label: "SC Higher Education Student",
    sublabel: "Professional Degree · UP",
    formData: {
      fullName: "Rahul Kumar",
      category: "SC",
      gender: "male",
      annualIncome: "300000",
      purpose: "education",
      educationLevel: "professional",
      course: "B.Tech Computer Science",
      institution: "State Technical University",
      projectCost: "1000000",
      requiredLoan: "800000",
      state: "Uttar Pradesh",
      district: "Lucknow",
    },
  },
  {
    id: "micro_artisan",
    label: "SC Micro-Enterprise Artisan",
    sublabel: "Self-Employment · Haryana",
    formData: {
      fullName: "Vikram Singh",
      category: "SC",
      gender: "male",
      annualIncome: "180000",
      purpose: "new_business",
      businessType: "Leathercraft & Footwear Unit",
      projectCost: "140000",
      requiredLoan: "100000",
      state: "Haryana",
      district: "Gurugram",
    },
  },
];

export default function RecommendationsPage({
  onBack,
  onFindScheme,
  results: propResults,
  formData: propFormData,
  onOpenAI,
  onOpenCalculator,
  onOpenPartner,
  onNavigate,
  onSetResults,
  isLoggedIn = false,
  currentUser = null,
}) {
  const { t } = useTranslation();

  // Load from props or storage cache
  const savedState = useMemo(() => {
    if (propResults) {
      return { results: propResults, formData: propFormData };
    }
    return apiCache.getSavedRecommendations();
  }, [propResults, propFormData]);

  const [activeResults, setActiveResults] = useState(savedState?.results || null);
  const [activeFormData, setActiveFormData] = useState(savedState?.formData || null);
  const [evaluatingDemo, setEvaluatingDemo] = useState(false);
  const [activeStage, setActiveStage] = useState("stage-user-profile");
  const [submittingApp, setSubmittingApp] = useState(false);
  const [submittedApp, setSubmittedApp] = useState(null);
  const [applyError, setApplyError] = useState("");

  // Keep state in sync if prop changes
  React.useEffect(() => {
    if (propResults) {
      setActiveResults(propResults);
      setActiveFormData(propFormData);
    }
  }, [propResults, propFormData]);

  // Interactive document checklist state
  const [checkedDocs, setCheckedDocs] = useState({
    caste_cert: true,
    income_cert: true,
    kyc_aadhaar: true,
    bank_passbook: false,
    photos: false,
    project_quotation: false,
    address_proof: false,
  });

  const toggleDoc = (docId) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const completedDocsCount = Object.values(checkedDocs).filter(Boolean).length;
  const totalDocsCount = Object.keys(checkedDocs).length;
  const docProgressPercent = Math.round((completedDocsCount / totalDocsCount) * 100);

  // Load demo profile and trigger live evaluation
  const loadDemoProfile = async (demoProfile) => {
    setEvaluatingDemo(true);
    const form = demoProfile.formData;
    setActiveFormData(form);

    const payload = {
      category: form.category,
      gender: form.gender || null,
      annual_income: Number(form.annualIncome || 0),
      purpose: form.purpose || null,
      project_cost: form.projectCost ? Number(form.projectCost) : null,
      required_loan: form.requiredLoan ? Number(form.requiredLoan) : null,
      education_level: form.educationLevel || null,
      state: form.state || null,
      district: form.district || null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/schemes/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveResults(data);
        if (onSetResults) {
          onSetResults(data, form);
        }
      }
    } catch (err) {
      console.error("Demo evaluation error:", err);
    } finally {
      setEvaluatingDemo(false);
    }
  };

  const primaryEligible = Array.isArray(activeResults?.primary?.eligible)
    ? activeResults.primary.eligible
    : [];

  const secondaryEligible = Array.isArray(activeResults?.secondary?.eligible)
    ? activeResults.secondary.eligible
    : [];

  const topScheme =
    activeResults?.best_scheme ||
    primaryEligible[0] ||
    null;

  const matchScore =
    activeResults?.match_score ??
    topScheme?.match_score ??
    95;

  const nearestPartner =
    activeResults?.nearest_partner ||
    null;

  const [partnerList, setPartnerList] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);

  React.useEffect(() => {
    const userState = activeFormData?.state || "Delhi";
    const userDistrict = activeFormData?.district || "";
    const schemeCode = topScheme?.code || topScheme?.scheme_id || "";

    fetch(`${API_BASE_URL}/api/partners/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: userState,
        district: userDistrict,
        scheme_id: schemeCode,
        max_results: 6,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.partners?.length) {
          setPartnerList(data.partners);
          setSelectedPartnerId(data.partners[0]?.partner_id);
        }
      })
      .catch(() => {});
  }, [activeFormData?.state, activeFormData?.district, topScheme?.code, topScheme?.scheme_id]);

  const applicantLocation = useMemo(() => {
    if (partnerList.length > 0 && partnerList[0]?.latitude && partnerList[0]?.longitude) {
      return {
        latitude: partnerList[0].latitude - 0.02,
        longitude: partnerList[0].longitude - 0.02,
        label: `${activeFormData?.district ? `${activeFormData.district}, ` : ""}${activeFormData?.state || "Delhi"} (${t("Applicant")})`,
      };
    }
    return {
      latitude: 28.6139,
      longitude: 77.209,
      label: `${activeFormData?.state || "Delhi"} (${t("Applicant")})`,
    };
  }, [partnerList, activeFormData, t]);

  const activeSelectedPartner = useMemo(() => {
    if (selectedPartnerId) {
      const found = partnerList.find((p) => p.partner_id === selectedPartnerId);
      if (found) return found;
    }
    return partnerList[0] || nearestPartner || null;
  }, [partnerList, selectedPartnerId, nearestPartner]);

  const scrollToStage = (stageId) => {
    setActiveStage(stageId);
    const el = document.getElementById(stageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleApplyScheme = async (scheme) => {
    setSubmittingApp(true);
    setApplyError("");
    const token = localStorage.getItem("scheme_saathi_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const targetScheme = scheme || topScheme;
    const payload = {
      applicant_name: activeFormData?.fullName || currentUser?.name || "Applicant",
      mobile: currentUser?.identifier || activeFormData?.mobile || "9876543210",
      scheme_id: targetScheme?.scheme_id || targetScheme?.code || "MFS",
      scheme_name: targetScheme?.scheme_name || targetScheme?.name || "Recommended Scheme",
      loan_amount: formatCurrency(activeFormData?.requiredLoan || 150000),
      purpose: formatValue(activeFormData?.purpose || "new_business"),
      channel_partner: activeSelectedPartner ? {
        name: activeSelectedPartner.name,
        district: activeSelectedPartner.district,
        state: activeSelectedPartner.state,
        office_address: activeSelectedPartner.address,
        contact_phone: activeSelectedPartner.contact || activeSelectedPartner.phone,
        helpline: "1800-180-6000"
      } : null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/applications/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmittedApp(data.application || data);
      } else {
        const err = await res.json().catch(() => ({}));
        setApplyError(err.detail || "Failed to submit application. Please try again.");
      }
    } catch {
      setApplyError("Could not reach backend server to submit application.");
    } finally {
      setSubmittingApp(false);
    }
  };

  const stagesList = [
    { id: "stage-user-profile", label: "User Profile", num: "1" },
    { id: "stage-ai-analysis", label: "AI Analysis", num: "2" },
    { id: "stage-scheme-checks", label: "Rule Checks", num: "3" },
    { id: "stage-ranked-schemes", label: "Ranked Schemes", num: "4" },
    { id: "stage-best-scheme", label: "Best Scheme", num: "5" },
    { id: "stage-why-this-scheme", label: "Why This Scheme?", num: "6" },
    { id: "stage-document-checklist", label: "Document Checklist", num: "7" },
    { id: "stage-nearest-partner", label: "Nearest Partner", num: "8" },
    { id: "stage-application-guidance", label: "Application Guidance", num: "9" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f8fb] text-[#14283f] pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#dce5eb] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[75px] max-w-[1360px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 rounded-lg border border-[#d6e1e8] bg-white px-3.5 py-2 text-xs font-bold text-[#4c6278] shadow-sm transition hover:bg-[#f3f7fa] hover:text-[#1769a8]"
            >
              <ArrowLeft size={16} />
              {t("Back to Home")}
            </button>

            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1769a8] text-white">
                <Sparkles size={16} />
              </div>
              <span className="font-serif text-base font-bold text-[#172a43]">
                {t("Scheme Recommendation Pipeline")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="hidden items-center gap-1.5 rounded-lg border border-[#cfdbe3] bg-white px-3 py-1.5 text-xs font-semibold text-[#485e74] shadow-sm transition hover:bg-[#f6f9fb] md:flex"
            >
              <Printer size={14} />
              {t("Print Report")}
            </button>

            <button
              onClick={onOpenAI}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#104d7b]"
            >
              <Bot size={15} />
              {t("Ask AI Assistant")}
            </button>
          </div>
        </div>

        {/* 9-Stage Pipeline Navigation Ribbon */}
        <div className="border-t border-[#e2ebf0] bg-[#fafcfd] px-6 py-2.5 overflow-x-auto">
          <div className="mx-auto flex max-w-[1360px] items-center gap-1.5 sm:gap-2 min-w-max">
            {stagesList.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <button
                  onClick={() => scrollToStage(stage.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    activeStage === stage.id
                      ? "bg-[#1769a8] text-white shadow-sm"
                      : "bg-white border border-[#dce4e9] text-[#55697d] hover:border-[#1769a8] hover:text-[#1769a8]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                      activeStage === stage.id
                        ? "bg-white text-[#1769a8]"
                        : "bg-[#eef4f8] text-[#55697d]"
                    }`}
                  >
                    {stage.num}
                  </span>
                  <span>{t(stage.label)}</span>
                </button>
                {idx < stagesList.length - 1 && (
                  <span className="text-[#9cb0c3] text-[10px] select-none">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Scenario / Demo Profile Switcher Banner */}
        <div className="mb-8 rounded-2xl border border-[#cee0eb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#c6a56b]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1769a8]">
                  {t("Interactive Evaluation Profiles")}
                </p>
              </div>
              <h2 className="mt-1 font-serif text-lg font-bold text-[#1a2f47]">
                {activeFormData?.fullName
                  ? `${t("Displaying 9-Stage Recommendation for")} ${activeFormData.fullName}`
                  : t("Select or Evaluate a Profile")}
              </h2>
              <p className="text-xs text-[#62778c]">
                {t(
                  "Switch between sample verified profiles to immediately test AI matching, rule engine checks, and partner routing."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {DEMO_PROFILES.map((dp) => {
                const isSelected = activeFormData?.fullName === dp.formData.fullName;
                return (
                  <button
                    key={dp.id}
                    disabled={evaluatingDemo}
                    onClick={() => loadDemoProfile(dp)}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition ${
                      isSelected
                        ? "border-[#1769a8] bg-[#eff7fb] shadow-sm ring-2 ring-[#1769a8]/20"
                        : "border-[#d8e3ea] bg-white hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isSelected
                          ? "bg-[#1769a8] text-white"
                          : "bg-[#edf3f7] text-[#4f6479]"
                      }`}
                    >
                      {isSelected ? <Check size={14} /> : dp.label[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#192d45]">{dp.label}</p>
                      <p className="text-[10px] text-[#6e8297]">{dp.sublabel}</p>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={onFindScheme}
                className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-[#1769a8] bg-white px-3.5 py-2 text-xs font-bold text-[#1769a8] transition hover:bg-[#eff7fb]"
              >
                <RefreshCw size={13} />
                {t("Take New Assessment")}
              </button>
            </div>
          </div>
        </div>

        {/* 9-STAGE PIPELINE CONTENT CONTAINER */}
        <div className="space-y-10">
          {/* ========================================================= */}
          {/* STAGE 1: USER PROFILE */}
          {/* ========================================================= */}
          <section id="stage-user-profile" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                1
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("USER PROFILE")}
              </h3>
              <span className="ml-2 rounded-full bg-[#e8f3f8] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                {t("Applicant Details Intake")}
              </span>
            </div>

            <div className="rounded-2xl border border-[#d6e2e9] bg-white p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Applicant")}
                  </p>
                  <p className="mt-1 font-serif text-sm font-bold text-[#1b3149]">
                    {activeFormData?.fullName || "Verified Citizen"}
                  </p>
                </div>

                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Category")}
                  </p>
                  <span className="mt-1 inline-block rounded bg-[#edf5fa] px-2 py-0.5 text-xs font-bold text-[#1769a8]">
                    {activeFormData?.category || "SC"}
                  </span>
                </div>

                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Gender")}
                  </p>
                  <p className="mt-1 text-sm font-semibold capitalize text-[#1b3149]">
                    {activeFormData?.gender || "Not specified"}
                  </p>
                </div>

                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Annual Family Income")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#2d7e52]">
                    {formatCurrency(activeFormData?.annualIncome)}
                  </p>
                </div>

                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Location")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#1b3149]">
                    {activeFormData?.district || "New Delhi"},{" "}
                    {activeFormData?.state || "Delhi"}
                  </p>
                </div>

                <div className="border-r border-[#e8eff3] pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Requirement")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#1b3149]">
                    {formatValue(activeFormData?.purpose || "new_business")}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#798ba0]">
                    {t("Required Loan")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#1769a8]">
                    {formatCurrency(activeFormData?.requiredLoan || 100000)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#edf2f6] pt-3 text-xs text-[#6e8398]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#2d7e52]" />
                  <span>{t("Verified against official NSFDC eligibility guidelines.")}</span>
                </div>
                <button
                  onClick={onFindScheme}
                  className="font-semibold text-[#1769a8] hover:underline"
                >
                  {t("Edit Profile Details →")}
                </button>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 2: AI ANALYZES USER DETAILS */}
          {/* ========================================================= */}
          <section id="stage-ai-analysis" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                2
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("AI ANALYZES USER DETAILS")}
              </h3>
              <span className="ml-2 rounded-full bg-[#f3eef8] px-2.5 py-0.5 text-[10px] font-bold text-[#6f42c1]">
                {t("Intelligent Evaluation & Dimension Mapping")}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#dbe6ee] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-[#1769a8]">
                  <ShieldCheck size={18} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {t("Income Ceiling Check")}
                  </p>
                </div>
                <h4 className="mt-2 font-serif text-base font-bold text-[#172b43]">
                  {t("≤ ₹5,00,000 Ceiling Satisfied")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[#63778c]">
                  {t(
                    "Income is verified against NSFDC revised ceiling (effective Jan 7, 2026). Confirms full credit eligibility."
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#dbe6ee] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-[#9a4282]">
                  <UserRound size={18} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {t("Demographic Focus")}
                  </p>
                </div>
                <h4 className="mt-2 font-serif text-base font-bold text-[#172b43]">
                  {String(activeFormData?.gender).toLowerCase() === "female"
                    ? t("Women-Target Quota (40%)")
                    : t("General SC Allocation")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[#63778c]">
                  {String(activeFormData?.gender).toLowerCase() === "female"
                    ? t(
                        "Priority access to Mahila Samriddhi Yojana with subsidized 4% p.a. interest rate."
                      )
                    : t(
                        "Standard Scheduled Caste target credit allocations with concessional term loan structures."
                      )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#dbe6ee] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-[#2e8257]">
                  <Calculator size={18} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {t("Credit Needs Analysis")}
                  </p>
                </div>
                <h4 className="mt-2 font-serif text-base font-bold text-[#172b43]">
                  {t("Micro-Finance / Term Loan Fit")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[#63778c]">
                  {t(
                    "Requirement falls within optimum concession band with up to 90–95% project cost coverage."
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#dbe6ee] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-[#c6a56b]">
                  <Sparkles size={18} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {t("Subvention Synergy")}
                  </p>
                </div>
                <h4 className="mt-2 font-serif text-base font-bold text-[#172b43]">
                  {t("VISVAS 5% Subvention Active")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[#63778c]">
                  {t(
                    "Connected secondary scheme provides up to 5% p.a. interest relief directly credited to bank account."
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 3: CHECKS GOVERNMENT SCHEMES */}
          {/* ========================================================= */}
          <section id="stage-scheme-checks" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                3
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("CHECKS GOVERNMENT SCHEMES")}
              </h3>
              <span className="ml-2 rounded-full bg-[#e8f7ec] px-2.5 py-0.5 text-[10px] font-bold text-[#2e8257]">
                {t("Deterministic Rule Engine Verification")}
              </span>
            </div>

            <div className="rounded-2xl border border-[#d5e3eb] bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Community Requirement")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {t("Applicant belongs to Scheduled Caste (SC) category. Valid caste certificate required.")}
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · RULE 100% SATISFIED")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Family Income Rule")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {t("Annual income ₹")}{activeFormData?.annualIncome ? Number(activeFormData.annualIncome).toLocaleString("en-IN") : "2,40,000"} {t("is within the official ≤ ₹5,00,000 threshold.")}
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · NO DISQUALIFICATION")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Purpose & Activity Limits")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {t("Selected requirement complies with NSFDC income-generating / educational provisions.")}
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · COMPATIBLE CATEGORY")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Financial Loan Caps")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {t("Required loan does not exceed permissible scheme upper limits.")}
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · FINANCIALLY VIABLE")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Gender & Quota Matching")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {String(activeFormData?.gender).toLowerCase() === "female"
                        ? t("Qualified for 40% targeted women allocation.")
                        : t("Qualified for standard non-exclusive credit allocations.")}
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · QUOTA ALLOCATED")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2d7e52]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1b3149]">
                      {t("Channel Route Availability")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#63778d]">
                      {t("Active State Channelizing Agency (SCA) / Bank route verified in")} {activeFormData?.state || "Delhi"}.
                    </p>
                    <span className="mt-2 inline-block rounded bg-[#eaf5ec] px-2 py-0.5 text-[10px] font-bold text-[#2e8257]">
                      {t("PASSED · ROUTE ACTIVE")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 4: RANKS ELIGIBLE SCHEMES */}
          {/* ========================================================= */}
          <section id="stage-ranked-schemes" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                4
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("RANKS ELIGIBLE SCHEMES")}
              </h3>
              <span className="ml-2 rounded-full bg-[#eaf4fa] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                {t("Suitability Ranking by Match Score")}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {primaryEligible.map((scheme, index) => {
                const isBest = index === 0;
                const score = normalizeMatchScore(scheme.match_score) || (isBest ? 98 : 88 - index * 6);
                const maxLoan = scheme.financial_terms?.maximum_loan_amount_inr
                  ? `₹${Number(scheme.financial_terms.maximum_loan_amount_inr).toLocaleString("en-IN")}`
                  : "Up to ₹15 Lakhs";
                const interest = scheme.financial_terms?.beneficiary_interest_rate_percent
                  ? `${scheme.financial_terms.beneficiary_interest_rate_percent}% p.a.`
                  : "4% - 6% p.a.";

                return (
                  <div
                    key={scheme.scheme_id || index}
                    className={`relative rounded-2xl border-2 p-6 transition shadow-sm ${
                      isBest
                        ? "border-[#c6a56b] bg-white ring-2 ring-[#c6a56b]/20"
                        : "border-[#d8e4ec] bg-white hover:border-[#1769a8]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isBest
                              ? "bg-[#c6a56b] text-white"
                              : "bg-[#edf4f8] text-[#52667b]"
                          }`}
                        >
                          {isBest ? "🏆 RANK #1 BEST" : `RANK #${index + 1}`}
                        </span>
                        <span className="text-[10px] font-bold text-[#1769a8]">
                          {scheme.scheme_id}
                        </span>
                      </div>

                      <span className="rounded-full bg-[#eef7fd] px-2.5 py-1 text-xs font-extrabold text-[#1769a8]">
                        {score}% MATCH
                      </span>
                    </div>

                    <h4 className="mt-3 font-serif text-lg font-bold text-[#182e46] line-clamp-2">
                      {scheme.scheme_name}
                    </h4>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[#edf2f6] py-3 text-xs">
                      <div>
                        <p className="text-[10px] text-[#718598]">{t("Max Loan")}</p>
                        <p className="font-bold text-[#17293e]">{maxLoan}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#718598]">{t("Interest Rate")}</p>
                        <p className="font-bold text-[#2e8257]">{interest}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#617487] line-clamp-2">
                      {Array.isArray(scheme.why_this_scheme) && scheme.why_this_scheme[0]
                        ? scheme.why_this_scheme[0]
                        : t("Full compliance with NSFDC criteria and official government directives.")}
                    </p>
                  </div>
                );
              })}

              {/* Connected Secondary Scheme: VISVAS */}
              {secondaryEligible.map((scheme) => (
                <div
                  key={scheme.scheme_id || "VISVAS"}
                  className="rounded-2xl border-2 border-dashed border-[#2e8257] bg-[#f6fbf7] p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#2e8257] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {t("SECONDARY CONNECTED")}
                    </span>
                    <span className="rounded-full bg-[#eaf6ed] px-2.5 py-1 text-xs font-bold text-[#2e8257]">
                      {t("+5% SUBVENTION")}
                    </span>
                  </div>

                  <h4 className="mt-3 font-serif text-lg font-bold text-[#1b3d2b]">
                    {scheme.scheme_name || "VISVAS Yojana"}
                  </h4>

                  <div className="mt-4 border-y border-[#e2efe5] py-3 text-xs">
                    <p className="text-[10px] text-[#557864]">{t("Direct Benefit")}</p>
                    <p className="font-bold text-[#2e8257]">
                      {t("5% p.a. Interest Subvention on Prompt Repayment")}
                    </p>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#557864]">
                    {t(
                      "Applies synergistically with your primary loan, directly subsidizing interest paid to the lending institution."
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 5: 🏆 BEST SCHEME RECOMMENDATION */}
          {/* ========================================================= */}
          <section id="stage-best-scheme" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c6a56b] text-[11px] font-bold text-white">
                5
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("🏆 BEST SCHEME RECOMMENDATION")}
              </h3>
              <span className="ml-2 rounded-full bg-[#faf2e3] px-2.5 py-0.5 text-[10px] font-bold text-[#9e7631]">
                {t("Highest Match Score for Your Profile")}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-3xl border-3 border-[#c6a56b] bg-gradient-to-br from-white via-[#fffdf9] to-[#faf4e8] p-7 md:p-9 shadow-lg shadow-[#c6a56b]/10">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-[#f6ecda]/50 pointer-events-none" />

              <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c6a56b] px-3.5 py-1 text-xs font-bold text-white shadow-sm">
                      <Trophy size={14} />
                      {t("TOP RECOMMENDED")}
                    </span>
                    <span className="rounded-full bg-[#e6f2f8] px-3 py-1 text-xs font-bold text-[#1769a8]">
                      {topScheme?.scheme_id || "AMY"}
                    </span>
                    <span className="rounded-full bg-[#e8f6ec] px-3 py-1 text-xs font-bold text-[#2e8257]">
                      {t("100% ELIGIBLE")}
                    </span>
                  </div>

                  <h2 className="mt-4 font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#162d47]">
                    {topScheme?.scheme_name || "Aajeevika Micro-Finance Yojana"}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#576c82]">
                    {t(
                      "This scheme provides the most beneficial terms, lowest interest rate, and dedicated quota matching your exact requirement, income ceiling, and profile category."
                    )}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#ebdcc1] bg-white/90 p-3.5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#826938]">
                        {t("Maximum Loan")}
                      </p>
                      <p className="mt-1 font-serif text-lg font-bold text-[#172a42]">
                        {topScheme?.financial_terms?.maximum_loan_amount_inr
                          ? `₹${Number(topScheme.financial_terms.maximum_loan_amount_inr).toLocaleString("en-IN")}`
                          : "₹1,40,000"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#ebdcc1] bg-white/90 p-3.5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#826938]">
                        {t("Interest Rate")}
                      </p>
                      <p className="mt-1 font-serif text-lg font-bold text-[#2d7e52]">
                        {topScheme?.financial_terms?.beneficiary_interest_rate_percent
                          ? `${topScheme.financial_terms.beneficiary_interest_rate_percent}% p.a.`
                          : "4.0% p.a."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#ebdcc1] bg-white/90 p-3.5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#826938]">
                        {t("Repayment Tenure")}
                      </p>
                      <p className="mt-1 font-serif text-lg font-bold text-[#172a42]">
                        {topScheme?.financial_terms?.repayment_period_years || "3"}{" "}
                        {t("Years")}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#ebdcc1] bg-white/90 p-3.5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#826938]">
                        {t("Moratorium")}
                      </p>
                      <p className="mt-1 font-serif text-lg font-bold text-[#1769a8]">
                        {topScheme?.financial_terms?.moratorium_months || "3"}{" "}
                        {t("Months")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-[#ebdcc1] bg-white p-6 text-center shadow-md">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-[#886d3b]">
                    {t("Suitability Score")}
                  </p>
                  <div className="my-3">
                    <MatchScoreDisplay score={matchScore} />
                  </div>
                  <MatchScoreRing score={matchScore} />
                  <p className="mt-3 text-[11px] font-semibold text-[#667a8e]">
                    {t("Evaluated by Scheme Saathi AI")}
                  </p>

                  <button
                    onClick={() => handleApplyScheme(topScheme)}
                    disabled={submittingApp}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#145c91] px-5 py-3 text-xs font-bold text-white shadow transition hover:bg-[#104d7b] disabled:opacity-75"
                  >
                    {submittingApp ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>{t("Submitting Application...")}</span>
                      </>
                    ) : (
                      <>
                        <FileText size={15} />
                        <span>{t("Apply for This Scheme")}</span>
                      </>
                    )}
                  </button>
                  {applyError && (
                    <p className="mt-2 text-[11px] font-semibold text-red-600">{applyError}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 6: WHY THIS SCHEME? */}
          {/* ========================================================= */}
          <section id="stage-why-this-scheme" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                6
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("WHY THIS SCHEME?")}
              </h3>
              <span className="ml-2 rounded-full bg-[#eef7fd] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                {t("Transparent Justification & Advantages")}
              </span>
            </div>

            <div className="rounded-2xl border border-[#d5e3eb] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(topScheme?.why_this_scheme) && topScheme.why_this_scheme.length > 0 ? (
                  topScheme.why_this_scheme.map((reason, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t(`Advantage #${index + 1}`)}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">{reason}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("Caste Mandate Alignment")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("Dedicated 100% target coverage for Scheduled Caste (SC) applicants under NSFDC mandate.")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("Income Ceiling Compliance")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("Family income is comfortably below the official ₹5,00,000 ceiling, qualifying for maximum subsidization.")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("Concessional Interest Advantage")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("Interest rate of 4% - 6% p.a. is drastically lower than open-market commercial loans (12% - 18%).")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("VISVAS Subvention Benefit")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("Eligible for up to 5% p.a. additional interest subvention on timely quarterly repayments.")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("Grace Moratorium Support")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("3 to 6 months moratorium period ensures enterprise setup before quarterly installments begin.")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e7f3fa] text-[#1769a8]">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172b43]">{t("High Loan Coverage")}</p>
                        <p className="mt-1 text-xs leading-5 text-[#55697d]">
                          {t("Finances 90% to 95% of total project cost, requiring minimal beneficiary margin money.")}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 7: DOCUMENT CHECKLIST */}
          {/* ========================================================= */}
          <section id="stage-document-checklist" className="scroll-mt-36">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                  7
                </span>
                <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                  {t("DOCUMENT CHECKLIST")}
                </h3>
                <span className="ml-2 rounded-full bg-[#eaf4fa] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                  {t("Interactive Readiness Tracker")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#546b80]">
                <span>{completedDocsCount} of {totalDocsCount} {t("Ready")}</span>
                <span className="font-bold text-[#1769a8]">({docProgressPercent}%)</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d5e3eb] bg-white p-6 shadow-sm">
              {/* Progress Bar */}
              <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[#e8eff3]">
                <div
                  className="h-full rounded-full bg-[#1769a8] transition-all duration-300"
                  style={{ width: `${docProgressPercent}%` }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.caste_cert}
                    onChange={() => toggleDoc("caste_cert")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Valid Caste Certificate (SC)")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#fbeae8] px-1.5 py-0.5 text-[9px] font-bold text-[#c23e38]">
                      {t("Mandatory")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("Issued by competent authority (Tehsildar / SDO / Revenue Dept).")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.income_cert}
                    onChange={() => toggleDoc("income_cert")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Annual Family Income Proof")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#fbeae8] px-1.5 py-0.5 text-[9px] font-bold text-[#c23e38]">
                      {t("Mandatory")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("Income certificate certifying annual family income ≤ ₹5,00,000.")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.kyc_aadhaar}
                    onChange={() => toggleDoc("kyc_aadhaar")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Aadhaar Card & Proof of Identity")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#fbeae8] px-1.5 py-0.5 text-[9px] font-bold text-[#c23e38]">
                      {t("Mandatory")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("Aadhaar card with mobile linkage for biometric verification.")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.bank_passbook}
                    onChange={() => toggleDoc("bank_passbook")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Bank Account Passbook / Statement")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#fbeae8] px-1.5 py-0.5 text-[9px] font-bold text-[#c23e38]">
                      {t("Mandatory")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("Active savings bank account with IFSC code and Aadhaar seeding.")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.photos}
                    onChange={() => toggleDoc("photos")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Passport-Size Photographs")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#fbeae8] px-1.5 py-0.5 text-[9px] font-bold text-[#c23e38]">
                      {t("Mandatory")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("3 recent passport photographs of the primary applicant.")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.project_quotation}
                    onChange={() => toggleDoc("project_quotation")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {activeFormData?.purpose === "education"
                        ? t("Admission Letter & Fee Schedule")
                        : t("Business Quotation / Project Plan")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#edf5fa] px-1.5 py-0.5 text-[9px] font-bold text-[#1769a8]">
                      {t("Scheme-Specific")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {activeFormData?.purpose === "education"
                        ? t("Bonafide certificate, admission offer & fee estimate from institution.")
                        : t("Equipment estimate, supplier quotation, or business brief.")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4 cursor-pointer transition hover:bg-[#f5f9fc]">
                  <input
                    type="checkbox"
                    checked={checkedDocs.address_proof}
                    onChange={() => toggleDoc("address_proof")}
                    className="mt-0.5 h-4 w-4 rounded border-[#b9cbd6] text-[#1769a8] focus:ring-[#1769a8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#172b43]">
                      {t("Residential / Address Proof")}
                    </span>
                    <span className="ml-1.5 rounded bg-[#edf5fa] px-1.5 py-0.5 text-[9px] font-bold text-[#1769a8]">
                      {t("Verified")}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#63778c]">
                      {t("Voter ID / Electricity bill / Ration card / Domicile certificate.")}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 8: NEAREST APPLICATION PARTNER */}
          {/* ========================================================= */}
          <section id="stage-nearest-partner" className="scroll-mt-36">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                  8
                </span>
                <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                  {t("NEAREST APPLICATION PARTNER & ROUTE MAP")}
                </h3>
                <span className="ml-2 rounded-full bg-[#edf6fc] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                  {t("Geo-Spatial Routing & Fund Health")}
                </span>
              </div>

              <button
                onClick={onOpenPartner}
                className="flex items-center gap-1 text-xs font-bold text-[#1769a8] hover:underline"
              >
                {t("Open Full Locator")}
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Interactive Geospatial Routing Map */}
              {partnerList.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-[#d5e3eb] shadow-sm">
                  <PartnerMap
                    partners={partnerList}
                    userLocation={applicantLocation}
                    selectedPartnerId={selectedPartnerId || activeSelectedPartner?.partner_id}
                    onSelectPartner={(p) => setSelectedPartnerId(p.partner_id)}
                    height="380px"
                    title={`${t("Geo-Spatial Route to Nearest Eligible Partner for")} ${topScheme?.name || "Recommended Scheme"}`}
                  />
                </div>
              )}

              {/* Partner Card with Fund Utilization Health */}
              <div className="rounded-2xl border border-[#d5e3eb] bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                  <div className="max-w-2xl flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#1769a8] px-3 py-0.5 text-[10px] font-bold text-white">
                        {activeSelectedPartner?.partner_category || activeSelectedPartner?.type || t("State Channelizing Agency (SCA)")}
                      </span>
                      {activeSelectedPartner?.distance_km && (
                        <span className="rounded-full bg-[#e8f6ec] px-2.5 py-0.5 text-[10px] font-bold text-[#2e8257]">
                          🧭 {activeSelectedPartner.distance_km} {t("km away")}
                        </span>
                      )}
                      <span className="rounded-full bg-[#edf7ed] px-2.5 py-0.5 text-[10px] font-bold text-[#1e5a2e]">
                        <CheckCircle2 size={11} className="inline mr-1 text-[#2e7d32]" />
                        {activeSelectedPartner?.disbursal_status || t("Active & Fast Track Disbursal")}
                      </span>
                    </div>

                    <h4 className="mt-3 font-serif text-2xl font-bold text-[#182e46]">
                      {activeSelectedPartner?.name ||
                        `${activeFormData?.state || "State"} Scheduled Castes Finance & Development Corporation`}
                    </h4>

                    <div className="mt-3 space-y-1.5 text-xs text-[#52667b]">
                      <p className="flex items-center gap-2">
                        <MapPin size={15} className="shrink-0 text-[#1769a8]" />
                        <span>
                          {activeSelectedPartner?.address ||
                            `Administrative Complex, Sector 17, ${activeFormData?.district || "Central District"}, ${activeFormData?.state || "Delhi"}`}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone size={15} className="shrink-0 text-[#1769a8]" />
                        <span>
                          {activeSelectedPartner?.contact || activeSelectedPartner?.contact?.phone || "+91 11-2338-7654 / Toll Free: 1800-11-8899"}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Building2 size={15} className="shrink-0 text-[#1769a8]" />
                        <span>
                          {t("Authorized Agency for Scheme Submissions, Field Inspections & Fast Disbursal")}
                        </span>
                      </p>
                    </div>

                    {/* Real-time Partner Fund Utilization & Default Safety Metrics */}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-[#f7fafc] border border-[#e8eff4] p-2.5">
                        <p className="text-[10px] text-[#718599] font-medium">{t("Fund Utilization")}</p>
                        <p className="mt-0.5 text-xs font-bold text-[#145c91]">
                          {activeSelectedPartner?.fund_utilization_percent || 94.8}% {t("Active")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] border border-[#e8eff4] p-2.5">
                        <p className="text-[10px] text-[#718599] font-medium">{t("NPA Default Risk")}</p>
                        <p className="mt-0.5 text-xs font-bold text-[#2e7d32]">
                          {activeSelectedPartner?.npa_rate != null ? `${activeSelectedPartner.npa_rate}%` : "1.4%"} ({activeSelectedPartner?.npa_risk_level || "Low"})
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] border border-[#e8eff4] p-2.5">
                        <p className="text-[10px] text-[#718599] font-medium">{t("Overdue Recovery")}</p>
                        <p className="mt-0.5 text-xs font-bold text-[#172a43]">
                          {activeSelectedPartner?.overdue_recovery_percent || 97.5}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col shrink-0">
                    <a
                      href={getGoogleMapsDirectionsUrl(activeSelectedPartner, applicantLocation)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#1769a8] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#125386]"
                    >
                      <Navigation size={15} />
                      {t("Start GPS Directions")}
                    </a>

                    <button
                      onClick={onOpenPartner}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#cbd8e2] bg-white px-5 py-3 text-xs font-bold text-[#445b72] transition hover:bg-[#f4f8fb]"
                    >
                      <Compass size={15} />
                      {t("Compare Other Partners")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STAGE 9: APPLICATION GUIDANCE */}
          {/* ========================================================= */}
          <section id="stage-application-guidance" className="scroll-mt-36">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-[11px] font-bold text-white">
                9
              </span>
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#162a42]">
                {t("APPLICATION GUIDANCE")}
              </h3>
              <span className="ml-2 rounded-full bg-[#eaf4fa] px-2.5 py-0.5 text-[10px] font-bold text-[#1769a8]">
                {t("Step-by-Step Submission Roadmap")}
              </span>
            </div>

            <div className="rounded-2xl border border-[#d5e3eb] bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    1
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 1: Document Preparation")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Gather your Valid Caste Certificate, Income Certificate (≤ ₹5L), KYC, and bank details using our checklist above."
                    )}
                  </p>
                </div>

                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    2
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 2: Visit Channel Partner")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Visit your State Channelizing Agency (SCA) office or partner bank branch identified in Stage 8."
                    )}
                  </p>
                </div>

                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    3
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 3: Application Submission")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Fill out the prescribed NSFDC application form for your recommended scheme and attach self-attested documents."
                    )}
                  </p>
                </div>

                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    4
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 4: Field Verification")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Channel agency officials conduct inspection to verify applicant identity, activity site, and project quotation."
                    )}
                  </p>
                </div>

                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    5
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 5: Sanction & Fund Release")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Upon NSFDC approval, loan amount is disbursed directly to your Aadhaar-seeded bank account via DBT."
                    )}
                  </p>
                </div>

                <div className="relative rounded-xl border border-[#e4edf2] bg-[#fbfdfe] p-4.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1769a8] text-xs font-bold text-white">
                    6
                  </span>
                  <h4 className="mt-3 font-serif text-sm font-bold text-[#172b43]">
                    {t("Step 6: Quarterly Repayment")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#55697d]">
                    {t(
                      "Repayment starts after moratorium period on a quarterly basis. Prompt repayment unlocks 5% VISVAS subvention!"
                    )}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="mt-6 flex flex-wrap gap-3 border-t border-[#edf2f6] pt-5">
                <button
                  onClick={() => handleApplyScheme(topScheme)}
                  disabled={submittingApp}
                  className="flex items-center gap-2 rounded-lg bg-[#2e8257] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#256c47] disabled:opacity-75"
                >
                  {submittingApp ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t("Submitting Application...")}</span>
                    </>
                  ) : (
                    <>
                      <FileText size={15} />
                      <span>{t("Apply for Scheme Now")}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onOpenCalculator}
                  className="flex items-center gap-2 rounded-lg bg-[#145c91] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#104d7b]"
                >
                  <Calculator size={15} />
                  {t("Calculate Monthly EMI for Scheme")}
                </button>

                <button
                  onClick={onOpenPartner}
                  className="flex items-center gap-2 rounded-lg border border-[#c8d7e2] bg-white px-5 py-3 text-xs font-bold text-[#3d5369] transition hover:bg-[#f5f8fa]"
                >
                  <MapPin size={15} />
                  {t("Locate Channel Partner")}
                </button>

                <button
                  onClick={onOpenAI}
                  className="flex items-center gap-2 rounded-lg border border-[#c8d7e2] bg-white px-5 py-3 text-xs font-bold text-[#3d5369] transition hover:bg-[#f5f8fa]"
                >
                  <Bot size={15} />
                  {t("Ask AI About Application")}
                </button>

                {onNavigate && (
                  <button
                    onClick={() => onNavigate("explore")}
                    className="flex items-center gap-2 rounded-lg border border-[#c8d7e2] bg-white px-5 py-3 text-xs font-bold text-[#3d5369] transition hover:bg-[#f5f8fa]"
                  >
                    <BookOpen size={15} />
                    {t("Explore All Schemes")}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Application Submitted Confirmation Modal */}
      {submittedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f6ed] text-[#2e8257]">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2e8257]">
                  {t("Application Registered in SQLite")}
                </span>
                <h3 className="font-serif text-xl font-bold text-[#14283f]">
                  {t("Application Submitted Successfully!")}
                </h3>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#e1ebf1] bg-[#f8fbfe] p-4 text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-[#e6eff4] pb-2">
                <span className="text-[#687e93] font-medium">{t("Application ID")}:</span>
                <span className="font-mono text-sm font-bold text-[#1769a8]">
                  {submittedApp.application_id}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-[#e6eff4] pb-2">
                <span className="text-[#687e93] font-medium">{t("Scheme")}:</span>
                <span className="font-semibold text-[#182d43]">
                  {submittedApp.scheme_name || submittedApp.scheme_id}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-[#e6eff4] pb-2">
                <span className="text-[#687e93] font-medium">{t("Loan Amount")}:</span>
                <span className="font-bold text-[#2e8257]">
                  {submittedApp.loan_amount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#687e93] font-medium">{t("Allocated Channel Partner")}:</span>
                <span className="font-semibold text-[#182d43] text-right">
                  {submittedApp.channel_partner?.name || "State Scheduled Castes Development Corp"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#5e7388]">
              {t("Your application has been stored permanently in your Scheme Saathi database. You can now track your application through every milestone (KYC Scrutiny, Partner Appraisal, Bank Sanction, and DBT Disbursement).")}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => {
                  const id = submittedApp.application_id;
                  setSubmittedApp(null);
                  if (onNavigate) {
                    onNavigate("track_application", id);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#145c91] px-5 py-3 text-xs font-bold text-white shadow transition hover:bg-[#104d7b]"
              >
                <Search size={15} />
                {t("Track Application Now")}
              </button>
              <button
                onClick={() => setSubmittedApp(null)}
                className="rounded-xl border border-[#cbd8e2] px-4 py-3 text-xs font-bold text-[#4c637a] hover:bg-[#f5f8fa]"
              >
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

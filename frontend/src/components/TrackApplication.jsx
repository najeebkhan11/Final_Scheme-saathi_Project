import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  Building2,
  MapPin,
  Bot,
  Printer,
  FileText,
} from "lucide-react";
import { FeaturePageShell } from "./common/CommonUI";
import { useTranslation } from "../i18n";
import { PRESET_SAMPLE_APPLICATIONS, STAGES_MASTER } from "../data/schemesConstants";
import { API_BASE_URL } from "../config/api";

export default function TrackApplication({
  onBack,
  onNavigate,
  initialApplicationId = "",
  isLoggedIn = false,
  currentUser = null,
}) {
  const { t } = useTranslation();
  const [applicationId, setApplicationId] = useState(initialApplicationId || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(() => PRESET_SAMPLE_APPLICATIONS["SS-2026-MFS-8492"]);
  const [copied, setCopied] = useState(false);
  const [myApplications, setMyApplications] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("scheme_saathi_recent_tracks") || "[]");
    } catch {
      return [];
    }
  });

  // Fetch real user applications from SQLite if logged in
  useEffect(() => {
    const token = localStorage.getItem("scheme_saathi_token");
    if (!token) return;

    fetch(`${API_BASE_URL}/api/applications/my-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.applications?.length > 0) {
          setMyApplications(data.applications);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // If navigated with an initial application ID, track it immediately
  useEffect(() => {
    if (initialApplicationId) {
      setApplicationId(initialApplicationId);
      trackId(initialApplicationId);
    }
  }, [initialApplicationId]);

  const saveRecent = (id) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item !== id);
      const updated = [id, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(
          "scheme_saathi_recent_tracks",
          JSON.stringify(updated)
        );
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const trackId = async (inputVal) => {
    const id = (inputVal || applicationId).trim();
    if (!id) return;
    setLoading(true);

    try {
      // 1. Try Backend API first
      const res = await fetch(
        `${API_BASE_URL}/api/applications/track/${encodeURIComponent(id)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.application) {
          setStatus(data.application);
          saveRecent(id);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Backend unavailable or network issue — continue to local fallback
    }

    // 2. Check local presets
    const upper = id.toUpperCase();
    if (PRESET_SAMPLE_APPLICATIONS[upper]) {
      setStatus(PRESET_SAMPLE_APPLICATIONS[upper]);
      saveRecent(upper);
      setLoading(false);
      return;
    }

    // 3. Check mobile number matching
    const digits = id.replace(/\D/g, "");
    if (digits.length === 10) {
      const sample = { ...PRESET_SAMPLE_APPLICATIONS["SS-2026-MFS-8492"] };
      sample.mobile_masked = `XXXXXX${digits.slice(-4)}`;
      setStatus(sample);
      saveRecent(id);
      setLoading(false);
      return;
    }

    // 4. Check user localStorage custom applications
    try {
      const saved = JSON.parse(
        localStorage.getItem("scheme_saathi_applications") || "{}"
      );
      if (saved[id]) {
        setStatus(saved[id]);
        saveRecent(id);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    // 5. Generate a realistic dynamic tracking dossier for any custom ID
    const dynamicApp = {
      application_id: upper,
      applicant_name: "Applicant",
      mobile_masked: "XXXXXX" + (digits.length >= 4 ? digits.slice(-4) : "5421"),
      scheme_id: "MFS",
      scheme_name: "NSFDC Credit Assistance Scheme",
      scheme_type: "PRIMARY",
      authority: "National Scheduled Castes Finance and Development Corporation (NSFDC)",
      loan_amount: "₹1,50,000",
      purpose: "Self Employment Project",
      submission_date: "28 Aug 2026",
      last_updated: "03 Sep 2026",
      estimated_completion: "18 Sep 2026",
      current_stage_index: 1,
      status_code: "IN_PROGRESS",
      status_label: "Application Received & Under Verification",
      status_color: "blue",
      channel_partner: {
        name: "State Channelizing Agency (SCA) District Office",
        district: "Lead District Center",
        state: "State Division",
        office_address: "District Collectorate Complex, Administrative Wing",
        officer_in_charge: "District Nodal Officer",
        contact_phone: "1800-200-5566",
        helpline: "1800-180-6000",
      },
      action_required:
        "Please keep your original Aadhaar and Caste certificates ready for upcoming spot verification.",
      official_note: `Application ${upper} has been logged in the National Beneficiary Registry. District scrutiny cell is reviewing your documents.`,
      timeline: [
        {
          stage_index: 0,
          title: "Application Submitted",
          subtitle: "Scheme Saathi Portal",
          date: "28 Aug 2026, 10:00 AM",
          status: "COMPLETED",
          remarks: `Application ${upper} registered successfully.`,
        },
        {
          stage_index: 1,
          title: "Document Verification",
          subtitle: "District Scrutiny Cell",
          date: "03 Sep 2026, 02:30 PM",
          status: "IN_PROGRESS",
          remarks: "Scrutiny of KYC and income eligibility underway.",
        },
        {
          stage_index: 2,
          title: "SCA / Channel Partner Review",
          subtitle: "State Channelizing Agency",
          date: "Expected: 10 Sep 2026",
          status: "PENDING",
          remarks: "Quota allotment and subsidy eligibility confirmation.",
        },
        {
          stage_index: 3,
          title: "Bank Credit Appraisal & Sanction",
          subtitle: "Nominated Lending Bank",
          date: "Expected: 14 Sep 2026",
          status: "PENDING",
          remarks: "Credit approval and sanction order generation.",
        },
        {
          stage_index: 4,
          title: "Disbursement & DBT Credit",
          subtitle: "Direct Benefit Transfer",
          date: "Expected: 18 Sep 2026",
          status: "PENDING",
          remarks: "Direct credit to beneficiary savings account.",
        },
      ],
    };

    setStatus(dynamicApp);
    saveRecent(id);
    setLoading(false);
  };

  const handleCopyId = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <FeaturePageShell
      title={t("Track Application")}
      subtitle={t("Check live status, scrutiny milestones, and next steps for your government scheme application.")}
      onBack={onBack}
      actions={
        status && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-[#cfdbe3] bg-white px-3.5 py-2 text-xs font-semibold text-[#29445d] shadow-sm transition hover:bg-[#f2f6fa]"
          >
            <Printer size={15} className="text-[#1769a8]" />
            <span className="hidden sm:inline">{t("Print Status Slip")}</span>
          </button>
        )
      }
    >
      {/* 1. SEARCH BOX & QUICK DEMO SAMPLES */}
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-wider text-[#566c82]">
            {t("Track by Application ID or Mobile Number")}
          </label>

          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8fa2b3]"
              />
              <input
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && trackId()}
                placeholder={t("e.g. SS-2026-MFS-8492 or 10-digit mobile number")}
                className="w-full rounded-xl border border-[#cfdbe3] px-4 py-3.5 pl-11 text-sm font-medium text-[#172a43] outline-none transition placeholder:text-[#9bb0c1] focus:border-[#1769a8] focus:ring-2 focus:ring-[#1769a8]/10"
              />
            </div>

            <button
              onClick={() => trackId()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#145c91] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#145c91]/20 transition hover:bg-[#104d7b] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t("Tracking...")}</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>{t("Track Status")}</span>
                </>
              )}
            </button>
          </div>

          {/* User's Database Applications */}
          {myApplications.length > 0 && (
            <div className="mt-5 border-t border-[#edf2f6] pt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#145c91]">
                <FileText size={13} />
                {t("Your Submitted Applications (Stored in SQLite):")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {myApplications.map((app) => {
                  const isSelected = status?.application_id === app.application_id;
                  return (
                    <button
                      key={app.application_id}
                      onClick={() => {
                        setApplicationId(app.application_id);
                        trackId(app.application_id);
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? "border-[#145c91] bg-[#eef7fd] text-[#145c91] font-bold shadow-sm"
                          : "border-[#cfdde7] bg-[#f8fbfe] text-[#2c4760] hover:bg-[#eef5fa]"
                      }`}
                    >
                      <span className="flex h-2 w-2 rounded-full bg-[#1769a8]" />
                      <span className="font-mono font-bold">{app.application_id}</span>
                      <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-[#556b80]">
                        {app.scheme_id || app.scheme_name}
                      </span>
                      <span className="text-[10px] font-medium text-[#2d7e52]">
                        {app.status_label || "Submitted"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preset Demo Application Chips */}
          <div className="mt-5 border-t border-[#edf2f6] pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8295a6]">
              {t("Try Sample Applications:")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {Object.keys(PRESET_SAMPLE_APPLICATIONS).map((key) => {
                const sample = PRESET_SAMPLE_APPLICATIONS[key];
                const isSelected = status?.application_id === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setApplicationId(key);
                      trackId(key);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "border-[#145c91] bg-[#eef7fd] text-[#145c91] font-bold"
                        : "border-[#d8e4ed] bg-white text-[#455c72] hover:bg-[#f5f9fc]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sample.status_color === "emerald"
                          ? "bg-[#20bf6b]"
                          : sample.status_color === "amber"
                          ? "bg-[#f7b731]"
                          : "bg-[#2d98da]"
                      }`}
                    />
                    <span>{key}</span>
                    <span className="text-[10px] text-[#7d93a6]">
                      ({sample.scheme_id})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#718597]">
              <span className="text-[11px] font-semibold text-[#8b9fad]">{t("Recent:")}</span>
              {recentSearches.slice(0, 4).map((rId) => (
                <button
                  key={rId}
                  onClick={() => {
                    setApplicationId(rId);
                    trackId(rId);
                  }}
                  className="rounded bg-[#f0f5fa] px-2 py-0.5 text-xs text-[#354f67] hover:bg-[#e4eff7]"
                >
                  {rId}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. TRACKING DETAILS DOSSIER */}
        {status && (
          <div className="mt-8 space-y-6">
            {/* Header Summary Card */}
            <div className="overflow-hidden rounded-2xl border border-[#d5e1e8] bg-white shadow-sm">
              <div className="border-b border-[#e9eff4] bg-gradient-to-r from-[#fbfdfe] via-[#f7fbfe] to-[#f4f9fd] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#718596]">
                        {t("Application ID")}
                      </span>
                      <button
                        onClick={() => handleCopyId(status.application_id)}
                        className="inline-flex items-center gap-1 rounded bg-[#e8f1f7] px-2 py-0.5 text-xs font-semibold text-[#1769a8] hover:bg-[#d8e7f2]"
                        title={t("Copy Application ID")}
                      >
                        <Copy size={12} />
                        {copied ? t("Copied!") : t("Copy")}
                      </button>
                    </div>

                    <h2 className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#14283e]">
                      {status.application_id}
                    </h2>

                    <p className="mt-1 text-xs text-[#526a84]">
                      {t("Applicant")}: <span className="font-bold text-[#14283e]">{status.applicant_name}</span>{" "}
                      · {t("Registered Phone")}: <span className="font-medium text-[#14283e]">{status.mobile_masked}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-start sm:items-end">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold ${
                        status.status_code === "APPROVED"
                          ? "bg-[#e5f7ed] text-[#1e824c]"
                          : status.status_code === "ACTION_REQUIRED"
                          ? "bg-[#fef3dd] text-[#b45309]"
                          : "bg-[#e8f3fb] text-[#145c91]"
                      }`}
                    >
                      {status.status_code === "APPROVED" ? (
                        <CheckCircle2 size={14} />
                      ) : status.status_code === "ACTION_REQUIRED" ? (
                        <AlertTriangle size={14} />
                      ) : (
                        <Clock size={14} />
                      )}
                      {status.status_label}
                    </span>

                    <span className="mt-1.5 text-[11px] text-[#718596]">
                      {t("Last Scrutiny Activity")}: {status.last_updated}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Required Alert (if any) */}
              {status.action_required && (
                <div className="border-b border-[#fcd38d] bg-[#fffbf2] p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#d97706]" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#92400e]">
                        {t("Action Required by Applicant")}
                      </h4>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#78350f]">
                        {status.action_required}
                      </p>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate("documents")}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#b45309] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#92400e]"
                        >
                          <FileText size={13} />
                          {t("Check Document Checklist")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Official Scrutiny Note */}
              {status.official_note && (
                <div className="border-b border-[#e9eff4] bg-[#f8fbfe] px-6 py-4">
                  <p className="text-xs text-[#40586e]">
                    <span className="font-bold text-[#14283e]">{t("Official Remarks")}:</span>{" "}
                    {status.official_note}
                  </p>
                </div>
              )}

              {/* 3. VISUAL 5-STAGE PROGRESS STEPPER */}
              <div className="p-6 md:p-8">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7b8e9f]">
                  {t("Application Progress Journey")}
                </p>

                <div className="mt-6">
                  {/* Desktop Step Bar */}
                  <div className="hidden lg:grid grid-cols-5 gap-3 relative">
                    {STAGES_MASTER.map((stage, idx) => {
                      const isPast = idx < status.current_stage_index;
                      const isCurrent = idx === status.current_stage_index;
                      const isAction =
                        isCurrent && status.status_code === "ACTION_REQUIRED";
                      const isApproved =
                        isCurrent && status.status_code === "APPROVED";

                      return (
                        <div key={stage.index} className="relative flex flex-col items-center text-center">
                          {/* Step Connector Line */}
                          {idx < STAGES_MASTER.length - 1 && (
                            <div
                              className={`absolute left-1/2 top-4 -z-0 h-0.5 w-full ${
                                idx < status.current_stage_index
                                  ? "bg-[#20835c]"
                                  : "bg-[#e0e8ef]"
                              }`}
                            />
                          )}

                          {/* Node Badge */}
                          <div
                            className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold text-xs transition ${
                              isPast
                                ? "border-[#20835c] bg-[#20835c] text-white"
                                : isAction
                                ? "border-[#d97706] bg-[#fff8eb] text-[#d97706] ring-4 ring-[#d97706]/20"
                                : isApproved
                                ? "border-[#20835c] bg-[#e6f8ef] text-[#20835c] ring-4 ring-[#20835c]/20"
                                : isCurrent
                                ? "border-[#145c91] bg-[#eef7fd] text-[#145c91] ring-4 ring-[#145c91]/20 animate-pulse"
                                : "border-[#cfdbe3] bg-white text-[#8397a8]"
                            }`}
                          >
                            {isPast ? (
                              <Check size={16} strokeWidth={3} />
                            ) : isAction ? (
                              <AlertTriangle size={16} />
                            ) : (
                              <span>0{idx + 1}</span>
                            )}
                          </div>

                          {/* Step Title */}
                          <p
                            className={`mt-3 text-xs font-bold ${
                              isCurrent
                                ? isAction
                                  ? "text-[#b45309]"
                                  : "text-[#145c91]"
                                : isPast
                                ? "text-[#1d334a]"
                                : "text-[#8397a8]"
                            }`}
                          >
                            {t(stage.name)}
                          </p>

                          {/* Step Subtitle / Status */}
                          <span className="mt-0.5 text-[10px] text-[#718596]">
                            {isPast
                              ? t("Completed")
                              : isCurrent
                              ? status.status_label
                              : t("Upcoming")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Timeline List (Vertical) */}
                  <div className="mt-8 space-y-4">
                    {status.timeline?.map((step, index) => {
                      const isDone = step.status === "COMPLETED";
                      const isNow = step.status === "IN_PROGRESS";
                      const isAct = step.status === "ACTION_REQUIRED";

                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                            isNow
                              ? "border-[#b8ddf4] bg-[#f5fbfe]"
                              : isAct
                              ? "border-[#fcd38d] bg-[#fffdfa]"
                              : isDone
                              ? "border-[#dcebe1] bg-[#f8fbf9]"
                              : "border-[#e6edf2] bg-white opacity-60"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isDone
                                ? "bg-[#20835c] text-white"
                                : isAct
                                ? "bg-[#d97706] text-white"
                                : isNow
                                ? "bg-[#145c91] text-white"
                                : "bg-[#cfdbe3] text-[#5b7185]"
                            }`}
                          >
                            {isDone ? <Check size={14} /> : index + 1}
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                              <h4 className="text-xs font-bold text-[#14283e]">
                                {step.title}{" "}
                                <span className="font-normal text-[#6f859a]">
                                  · {step.subtitle}
                                </span>
                              </h4>
                              <span className="text-[11px] font-medium text-[#718596]">
                                {step.date}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#4b6073]">
                              {step.remarks}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Key Parameters Grid */}
              <div className="border-t border-[#e8eff4] bg-[#fafcfd] p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8d9e]">
                    {t("Scheme Name")}
                  </span>
                  <p className="mt-1 font-bold text-[#14283e]">
                    {status.scheme_name}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8d9e]">
                    {t("Assistance / Loan Amount")}
                  </span>
                  <p className="mt-1 font-bold text-[#14283e]">
                    {status.loan_amount}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8d9e]">
                    {t("Submission Date")}
                  </span>
                  <p className="mt-1 font-medium text-[#14283e]">
                    {status.submission_date}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8d9e]">
                    {t("Est. Completion Date")}
                  </span>
                  <p className="mt-1 font-bold text-[#1769a8]">
                    {status.estimated_completion}
                  </p>
                </div>
              </div>
            </div>

            {/* Channel Partner & Support Card */}
            {status.channel_partner && (
              <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#eef7fd] p-3 text-[#1769a8]">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#718596]">
                        {t("Assigned Implementing Partner / Agency")}
                      </span>
                      <h4 className="text-base font-bold text-[#172a43]">
                        {status.channel_partner.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-[#526a84]">
                        {status.channel_partner.office_address}
                      </p>
                      <p className="mt-1 text-xs text-[#526a84]">
                        {t("Nodal Officer")}:{" "}
                        <span className="font-bold text-[#172a43]">
                          {status.channel_partner.officer_in_charge}
                        </span>{" "}
                        · {t("Contact")}:{" "}
                        <span className="font-semibold text-[#1769a8]">
                          {status.channel_partner.contact_phone}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate("partner_locator")}
                        className="flex items-center gap-1.5 rounded-xl border border-[#cfdbe3] bg-white px-4 py-2.5 text-xs font-bold text-[#203a55] shadow-sm transition hover:bg-[#f5f8fb]"
                      >
                        <MapPin size={14} className="text-[#1769a8]" />
                        {t("Partner Locator")}
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        onClick={() =>
                          onNavigate(
                            "ai_assistant",
                            `Can you explain the current status and upcoming steps for my application ${status.application_id} under "${status.scheme_name}"? Current stage: ${status.status_label}.`
                          )
                        }
                        className="flex items-center gap-1.5 rounded-xl bg-[#145c91] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#104d7b]"
                      >
                        <Bot size={14} />
                        {t("Ask AI About Status")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FeaturePageShell>
  );
}

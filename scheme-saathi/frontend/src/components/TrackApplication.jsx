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
  Package,
  User,
  ArrowRight,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { FeaturePageShell } from "./common/CommonUI";
import { useTranslation } from "../i18n";
import { STAGES_MASTER } from "../data/schemesConstants";
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
  const [applicantName, setApplicantName] = useState("");
  const [mobileInput, setMobileInput] = useState("");
  const [searchTab, setSearchTab] = useState("id"); // "id" | "details"
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [searchError, setSearchError] = useState("");
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
    if (!id) return;
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
    const id = (inputVal !== undefined ? inputVal : applicationId).trim();
    if (!id) {
      setSearchError("Please enter your Application ID or registered mobile number.");
      return;
    }
    setLoading(true);
    setSearchError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/applications/track/${encodeURIComponent(id)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.application) {
          setStatus(data.application);
          saveRecent(data.application.application_id);
          setLoading(false);
          // Scroll down to tracker
          setTimeout(() => {
            const el = document.getElementById("application-tracker-view");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 100);
          return;
        }
      } else {
        const errData = await res.json().catch(() => null);
        const msg =
          errData?.detail ||
          `No application found for "${id}". Please check your Application ID or registered mobile number.`;
        setSearchError(msg);
        setStatus(null);
      }
    } catch {
      // Check user localStorage applications fallback
      try {
        const saved = JSON.parse(
          localStorage.getItem("scheme_saathi_applications") || "{}"
        );
        const found = saved[id] || saved[id.toUpperCase()];
        if (found) {
          setStatus(found);
          saveRecent(found.application_id);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
      setSearchError(
        "Unable to connect to the backend server. Please verify the backend is running on port 8000."
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const trackByDetails = async () => {
    const name = applicantName.trim();
    const phone = mobileInput.trim();

    if (!name && !phone) {
      setSearchError("Please enter your Registered Mobile Number or Applicant Name.");
      return;
    }

    setLoading(true);
    setSearchError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/applications/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: null,
          mobile: phone || null,
          applicant_name: name || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.application) {
          setStatus(data.application);
          saveRecent(data.application.application_id);
          setTimeout(() => {
            const el = document.getElementById("application-tracker-view");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 100);
          return;
        }
      } else {
        const errData = await res.json().catch(() => null);
        setSearchError(
          errData?.detail ||
            "No application found matching these details. Please verify your mobile number and name."
        );
        setStatus(null);
      }
    } catch {
      setSearchError("Unable to search application details. Please check your connection.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
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
      <div className="mx-auto max-w-4xl space-y-8">
        {/* 1. SEARCH INTAKE CARD - USER ENTERS DETAILS TO TRACK */}
        <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#edf2f6] pb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#14283e] flex items-center gap-2">
                <Search size={20} className="text-[#1769a8]" />
                {t("Track Your Application")}
              </h2>
              <p className="mt-0.5 text-xs text-[#63778a]">
                {t("Enter your application details below to check real-time processing progress.")}
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center rounded-xl bg-[#f0f5fa] p-1 text-xs font-semibold text-[#546b80]">
              <button
                type="button"
                onClick={() => {
                  setSearchTab("id");
                  setSearchError("");
                }}
                className={`rounded-lg px-3 py-1.5 transition ${
                  searchTab === "id"
                    ? "bg-white text-[#145c91] font-bold shadow-sm"
                    : "hover:text-[#172a43]"
                }`}
              >
                {t("By Application ID / Mobile")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTab("details");
                  setSearchError("");
                }}
                className={`rounded-lg px-3 py-1.5 transition ${
                  searchTab === "details"
                    ? "bg-white text-[#145c91] font-bold shadow-sm"
                    : "hover:text-[#172a43]"
                }`}
              >
                {t("By Name & Mobile")}
              </button>
            </div>
          </div>

          {/* Search Inputs */}
          {searchTab === "id" ? (
            <div className="mt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#566c82]">
                {t("Application ID or Registered Mobile Number")}
              </label>
              <div className="mt-2 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8fa2b3]"
                  />
                  <input
                    value={applicationId}
                    onChange={(e) => {
                      setApplicationId(e.target.value);
                      if (searchError) setSearchError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && trackId()}
                    placeholder={t("e.g. SS-2026-MFS-1285 or 10-digit mobile number")}
                    className="w-full rounded-xl border border-[#cfdbe3] px-4 py-3.5 pl-11 text-sm font-medium text-[#172a43] outline-none transition placeholder:text-[#9bb0c1] focus:border-[#1769a8] focus:ring-2 focus:ring-[#1769a8]/10"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => trackId()}
                  disabled={loading || !applicationId.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#145c91] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#145c91]/20 transition hover:bg-[#104d7b] disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#566c82]">
                    {t("Applicant Full Name")}
                  </label>
                  <div className="relative mt-2">
                    <User
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8fa2b3]"
                    />
                    <input
                      value={applicantName}
                      onChange={(e) => {
                        setApplicantName(e.target.value);
                        if (searchError) setSearchError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && trackByDetails()}
                      placeholder={t("e.g. Ramesh Chandra")}
                      className="w-full rounded-xl border border-[#cfdbe3] px-4 py-3.5 pl-11 text-sm font-medium text-[#172a43] outline-none transition placeholder:text-[#9bb0c1] focus:border-[#1769a8] focus:ring-2 focus:ring-[#1769a8]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#566c82]">
                    {t("Registered Mobile Number")}
                  </label>
                  <div className="relative mt-2">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8fa2b3]"
                    />
                    <input
                      value={mobileInput}
                      onChange={(e) => {
                        setMobileInput(e.target.value);
                        if (searchError) setSearchError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && trackByDetails()}
                      placeholder={t("10-digit mobile number")}
                      className="w-full rounded-xl border border-[#cfdbe3] px-4 py-3.5 pl-11 text-sm font-medium text-[#172a43] outline-none transition placeholder:text-[#9bb0c1] focus:border-[#1769a8] focus:ring-2 focus:ring-[#1769a8]/10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={trackByDetails}
                  disabled={loading || (!applicantName.trim() && !mobileInput.trim())}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#145c91] px-7 py-3 text-sm font-bold text-white shadow-md shadow-[#145c91]/20 transition hover:bg-[#104d7b] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t("Searching...")}</span>
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      <span>{t("Search & Track")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Search Error Alert */}
          {searchError && (
            <div className="mt-4 rounded-xl border border-[#fbd38d] bg-[#fffaf0] p-4 text-xs font-medium text-[#975a16]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#dd6b20]" />
                <div className="flex-1">
                  <p className="font-semibold text-[#7b341e]">{searchError}</p>
                  <p className="mt-1 text-[#975a16]">
                    {t("Haven't submitted an application yet? You can explore schemes tailored to you and apply via Scheme Finder.")}
                  </p>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate("scheme_finder")}
                      className="mt-2 inline-flex items-center gap-1 font-bold text-[#145c91] hover:underline"
                    >
                      {t("Go to Scheme Finder")}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#718597] border-t border-[#edf2f6] pt-3">
              <span className="text-[11px] font-semibold text-[#8b9fad]">{t("Recent Searches:")}</span>
              {recentSearches.map((rId) => (
                <button
                  key={rId}
                  type="button"
                  onClick={() => {
                    setApplicationId(rId);
                    trackId(rId);
                  }}
                  className="rounded-lg bg-[#f0f5fa] px-2.5 py-1 text-xs font-mono font-medium text-[#354f67] transition hover:bg-[#e4eff7]"
                >
                  {rId}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. AMAZON-STYLE "YOUR PLACED APPLICATIONS" SECTION */}
        <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#edf2f6] pb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#14283e] flex items-center gap-2">
                <Package size={20} className="text-[#1769a8]" />
                {t("Your Placed Applications")}
                {myApplications.length > 0 && (
                  <span className="rounded-full bg-[#e8f3fb] px-2.5 py-0.5 text-xs font-bold text-[#145c91]">
                    {myApplications.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-[#63778a]">
                {t("Like Amazon order tracking, all applications placed from your account are recorded in SQLite and trackable anytime.")}
              </p>
            </div>
          </div>

          {myApplications.length > 0 ? (
            <div className="mt-5 space-y-3.5">
              {myApplications.map((app) => {
                const isSelected = status?.application_id === app.application_id;
                return (
                  <div
                    key={app.application_id}
                    className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border p-4.5 transition ${
                      isSelected
                        ? "border-[#145c91] bg-[#f2f8fc] shadow-sm"
                        : "border-[#e2ebf1] bg-[#fcfdfe] hover:border-[#b8cfdf]"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#14283e]">
                          {app.application_id}
                        </span>
                        <span className="rounded bg-[#e8f3fb] px-2 py-0.5 text-xs font-semibold text-[#145c91]">
                          {app.scheme_name || app.scheme_id}
                        </span>
                        <span className="text-xs text-[#718596]">
                          • {t("Amount")}: <strong className="text-[#172a43]">{app.loan_amount || "₹ 1,50,000"}</strong>
                        </span>
                      </div>

                      <p className="text-xs text-[#5a6f84]">
                        {t("Applicant")}: <span className="font-medium text-[#172a43]">{app.applicant_name}</span>{" "}
                        • {t("Applied On")}: <span className="font-medium text-[#172a43]">{app.submission_date || "Recent"}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          app.status_code === "APPROVED"
                            ? "bg-[#e5f7ed] text-[#1e824c]"
                            : app.status_code === "ACTION_REQUIRED"
                            ? "bg-[#fef3dd] text-[#b45309]"
                            : "bg-[#e8f3fb] text-[#145c91]"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {app.status_label || "Application Submitted"}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setApplicationId(app.application_id);
                          trackId(app.application_id);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                          isSelected
                            ? "bg-[#104d7b] text-white ring-2 ring-[#145c91]/30"
                            : "bg-[#145c91] text-white hover:bg-[#104d7b]"
                        }`}
                      >
                        <span>{isSelected ? t("Tracking Active") : t("Track Status")}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isLoggedIn ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#d1dee7] bg-[#f9fcfe] p-8 text-center">
              <Package size={36} className="mx-auto text-[#8ea4b8]" />
              <h4 className="mt-3 text-sm font-bold text-[#1e344a]">
                {t("No applications placed yet")}
              </h4>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#63778a]">
                {t("You haven't submitted any scheme applications under this account yet. Find schemes matching your criteria and apply to track them here anytime.")}
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("scheme_finder")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#145c91] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#104d7b]"
                >
                  {t("Find Schemes & Apply")}
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-[#d1dee7] bg-[#f9fcfe] p-6 text-center">
              <p className="text-xs text-[#52657b]">
                {t("Sign in to your account to view all your placed applications automatically in one place, or enter your Application ID above to track any application.")}
              </p>
            </div>
          )}
        </div>

        {/* 3. LIVE PROGRESS TRACKING DOSSIER */}
        {status && (
          <div id="application-tracker-view" className="mt-8 space-y-6 scroll-mt-6">
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

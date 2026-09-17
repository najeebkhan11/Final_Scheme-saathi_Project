import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Folder,
  User,
  Phone,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Check,
  Loader2,
  ArrowLeft,
  X,
  LockKeyhole,
  LogOut,
  Eye,
  Upload,
  FileCheck,
  Ban,
} from "lucide-react";
import { FeaturePageShell } from "./common/CommonUI";
import { useTranslation } from "../i18n";
import { API_BASE_URL } from "../config/api";

const STAGES = [
  { index: 0, title: "1. Application Submitted", short: "Submitted", color: "blue" },
  { index: 1, title: "2. Document Verification", short: "Doc Verification", color: "amber" },
  { index: 2, title: "3. SCA / Partner Review", short: "SCA Review", color: "indigo" },
  { index: 3, title: "4. Bank Sanction", short: "Bank Sanction", color: "purple" },
  { index: 4, title: "5. Disbursement (DBT)", short: "Disbursed", color: "emerald" },
];

export default function AdminPortal({ onBack, onNavigate }) {
  const { t } = useTranslation();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem("scheme_saathi_admin_auth") === "true";
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const [activeTab, setActiveTab] = useState("applications"); // "applications" | "users"
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [authorRemarks, setAuthorRemarks] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [excelFolder, setExcelFolder] = useState("");

  // Full Dossier Inspection states
  const [appDossier, setAppDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [rejectPromptDocId, setRejectPromptDocId] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [sanctionAmountInput, setSanctionAmountInput] = useState("");
  const [disbursementRefInput, setDisbursementRefInput] = useState("");

  const fetchApplicationDossier = async (appId) => {
    try {
      setDossierLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/applications/${encodeURIComponent(appId)}/full-dossier`);
      if (res.ok) {
        const data = await res.json();
        setAppDossier(data);
      }
    } catch {
      // ignore
    } finally {
      setDossierLoading(false);
    }
  };

  const handleVerifyDocument = async (docId, docName) => {
    try {
      setActionLoading(true);
      setActionError("");
      const res = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(docId)}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified_by: "District Scrutiny Officer", remarks: "Approved upon verification." }),
      });
      if (res.ok) {
        setActionSuccess(`Document '${docName}' verified successfully!`);
        if (selectedApp) fetchApplicationDossier(selectedApp.application_id);
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to verify document.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async (docId, docName) => {
    if (!rejectReasonInput.trim()) {
      setActionError("Please enter a specific reason for rejecting this document.");
      return;
    }
    try {
      setActionLoading(true);
      setActionError("");
      const res = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(docId)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejection_reason: rejectReasonInput.trim(),
          remarks: "Applicant requested to re-upload clear document.",
        }),
      });
      if (res.ok) {
        setActionSuccess(`Document '${docName}' rejected. Citizen has been notified to re-upload.`);
        setRejectPromptDocId(null);
        setRejectReasonInput("");
        if (selectedApp) {
          fetchApplicationDossier(selectedApp.application_id);
          fetchApplications();
        }
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to reject document.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProceedToSca = async (app) => {
    try {
      setActionLoading(true);
      setActionError("");
      setActionSuccess("");
      const res = await fetch(
        `${API_BASE_URL}/api/admin/applications/${encodeURIComponent(app.application_id)}/proceed-to-sca`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remarks: authorRemarks.trim() || "All mandatory documents verified. Forwarded to SCA Review.",
            officer_name: "District Scrutiny Officer",
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActionSuccess(`Application ${app.application_id} verified and forwarded to SCA Review!`);
        setAuthorRemarks("");
        fetchApplications();
        fetchApplicationDossier(app.application_id);
        if (data.application) setSelectedApp(data.application);
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Cannot proceed: All required documents must be VERIFIED first.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScaReview = async (app) => {
    try {
      setActionLoading(true);
      setActionError("");
      setActionSuccess("");
      const res = await fetch(
        `${API_BASE_URL}/api/admin/applications/${encodeURIComponent(app.application_id)}/sca-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remarks: authorRemarks.trim() || "SCA quota allocation approved. Nominated to bank for sanction.",
            officer_name: "SCA Nodal Officer",
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActionSuccess(`Application ${app.application_id} endorsed by SCA and sent for Bank Sanction!`);
        setAuthorRemarks("");
        fetchApplications();
        fetchApplicationDossier(app.application_id);
        if (data.application) setSelectedApp(data.application);
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to update SCA stage.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBankSanction = async (app) => {
    try {
      setActionLoading(true);
      setActionError("");
      setActionSuccess("");
      const res = await fetch(
        `${API_BASE_URL}/api/admin/applications/${encodeURIComponent(app.application_id)}/bank-sanction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sanction_amount: sanctionAmountInput.trim() || app.loan_amount || "₹ 1,50,000",
            remarks: authorRemarks.trim() || "Bank credit sanction order executed. Ready for DBT disbursement.",
            officer_name: "Chief Bank Credit Officer",
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActionSuccess(`Bank Sanction issued for ${app.application_id}! Ready for DBT disbursement.`);
        setAuthorRemarks("");
        setSanctionAmountInput("");
        fetchApplications();
        fetchApplicationDossier(app.application_id);
        if (data.application) setSelectedApp(data.application);
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to sanction loan.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisbursement = async (app) => {
    try {
      setActionLoading(true);
      setActionError("");
      setActionSuccess("");
      const res = await fetch(
        `${API_BASE_URL}/api/admin/applications/${encodeURIComponent(app.application_id)}/disbursement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disbursement_ref: disbursementRefInput.trim() || undefined,
            remarks: authorRemarks.trim() || "Direct Benefit Transfer successfully credited to Aadhaar bank account.",
            officer_name: "Treasury DBT Officer",
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActionSuccess(`Application ${app.application_id} DISBURSED successfully! Ref: ${data.disbursement_ref}`);
        setAuthorRemarks("");
        setDisbursementRefInput("");
        fetchApplications();
        fetchApplicationDossier(app.application_id);
        if (data.application) setSelectedApp(data.application);
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to record disbursement.");
      }
    } catch {
      setActionError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError("Please enter your Author Desk PIN");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/verify-pin?pin=${encodeURIComponent(pinInput.trim())}`);
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem("scheme_saathi_admin_auth", "true");
        setIsAdminAuthenticated(true);
        setPinInput("");
      } else {
        setPinError("Invalid PIN. Please enter the authorized Author Desk PIN.");
      }
    } catch {
      if (pinInput.trim() === "1234") {
        sessionStorage.setItem("scheme_saathi_admin_auth", "true");
        setIsAdminAuthenticated(true);
      } else {
        setPinError("Authentication failed. Please verify your connection or PIN.");
      }
    } finally {
      setPinLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
      }
    } catch {
      // ignore
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/applications`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        if (data.excel_folder) setExcelFolder(data.excel_folder);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchApplications();
      fetchUsers();
      fetchStats();
    }
  }, [isAdminAuthenticated]);

  const handleAdvanceStage = async (app, targetStageIndex, customNote = "") => {
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");

    const meta = [
      { code: "IN_PROGRESS", label: "Application Submitted - Under Scrutiny" },
      { code: "IN_PROGRESS", label: "Under Document Verification" },
      { code: "IN_PROGRESS", label: "SCA / Channel Partner Review" },
      { code: "IN_PROGRESS", label: "Bank Credit Appraisal & Sanction" },
      { code: "APPROVED", label: "Loan Sanctioned - Ready for Disbursement" },
    ][targetStageIndex];

    const note =
      customNote.trim() ||
      authorRemarks.trim() ||
      (targetStageIndex === 1
        ? "Author authorized application for Document Verification. Scrutiny in progress at District Scrutiny Cell."
        : targetStageIndex === 2
        ? "Documents verified by Scrutiny Cell. Forwarded to State Channelizing Agency for quota recommendation."
        : targetStageIndex === 3
        ? "SCA quota allocation approved. Lending bank processing sanction order."
        : "Sanction granted. Direct Benefit Transfer (DBT) credit scheduled.");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/applications/${encodeURIComponent(app.application_id)}/update-stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_stage_index: targetStageIndex,
            status_code: meta.code,
            status_label: meta.label,
            official_note: note,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setActionSuccess(
          `Application ${app.application_id} successfully advanced to ${STAGES[targetStageIndex].title}!`
        );
        setAuthorRemarks("");
        // Update local state
        setApplications((prev) =>
          prev.map((item) =>
            item.application_id === app.application_id ? data.application : item
          )
        );
        if (selectedApp?.application_id === app.application_id) {
          setSelectedApp(data.application);
        }
      } else {
        const err = await res.json().catch(() => null);
        setActionError(err?.detail || "Failed to update application stage.");
      }
    } catch {
      setActionError("Unable to connect to backend server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncExcel = async () => {
    setSyncLoading(true);
    setSyncMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/sync-excel`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const folder = data?.applications?.excel_path || excelFolder || "Admin_Data folder";
        setSyncMessage(`Excel files updated successfully in: ${folder}`);
        setTimeout(() => setSyncMessage(""), 6000);
      }
    } catch {
      // ignore
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    window.open(`${API_BASE_URL}/api/admin/download-excel`, "_blank");
  };

  // Filter applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      !searchTerm ||
      app.application_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.mobile_masked?.includes(searchTerm) ||
      app.scheme_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage =
      selectedStageFilter === "all" ||
      app.current_stage_index === Number(selectedStageFilter);

    return matchesSearch && matchesStage;
  });

  if (!isAdminAuthenticated) {
    return (
      <FeaturePageShell
        title={t("Author & Verification Desk")}
        subtitle={t("Official NSFDC Verification & State Channelizing Portal")}
        onBack={onBack}
      >
        <div className="mx-auto max-w-md py-12 px-4">
          <div className="rounded-3xl border border-[#cbe0ee] bg-white p-8 shadow-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef7fd] text-[#145c91] shadow-inner mb-5">
              <LockKeyhole size={30} />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#14283e]">
              Author Desk Access
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#60778c]">
              This desk is restricted to authorized state channelizing agency (SCA) officers and verification authors.
            </p>

            <form onSubmit={handleVerifyPin} className="mt-6 space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Enter 4-digit PIN (Default: 1234)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError("");
                  }}
                  className="w-full text-center tracking-widest font-mono text-lg rounded-xl border border-[#cfdbe3] px-4 py-3 text-[#172a43] outline-none focus:border-[#145c91] focus:ring-2 focus:ring-[#145c91]/15"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-2.5 text-xs font-semibold text-[#b91c1c]">
                  ⚠️ {pinError}
                </div>
              )}

              <button
                type="submit"
                disabled={pinLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#145c91] py-3 text-sm font-bold text-white transition hover:bg-[#104d7b] shadow-md shadow-[#145c91]/20 disabled:opacity-50"
              >
                {pinLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                <span>Unlock Author Desk</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#edf2f6] flex items-center justify-between text-[11px] text-[#788e9f]">
              <span>Evaluation PIN: <strong className="font-mono text-[#145c91]">1234</strong></span>
              <button onClick={onBack} className="hover:text-[#145c91] font-medium">
                Cancel & Exit
              </button>
            </div>
          </div>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={t("Author & Verification Desk")}
      subtitle={t("View all user submissions, advance applications across verification stages, and manage auto-synced Excel records.")}
      onBack={onBack}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncExcel}
            disabled={syncLoading}
            className="flex items-center gap-1.5 rounded-lg border border-[#cfdbe3] bg-white px-3.5 py-2 text-xs font-semibold text-[#29445d] shadow-sm transition hover:bg-[#f2f6fa]"
            title="Refresh Excel file on disk"
          >
            <RefreshCw size={14} className={syncLoading ? "animate-spin text-[#1769a8]" : "text-[#1769a8]"} />
            <span>{syncLoading ? "Syncing..." : "Sync Excel"}</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 rounded-lg bg-[#145c91] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#104d7b]"
          >
            <Download size={14} />
            <span>Download Excel Sheet</span>
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem("scheme_saathi_admin_auth");
              setIsAdminAuthenticated(false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#cfdbe3] bg-white px-3 py-2 text-xs font-semibold text-[#b91c1c] shadow-sm transition hover:bg-[#fff5f5]"
            title="Lock Author Desk"
          >
            <LogOut size={13} />
            <span>Lock</span>
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* KPI Stats Dashboard Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#cbe0ee] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#62778a]">TOTAL APPLICATIONS</p>
            <p className="mt-1 font-serif text-2xl font-bold text-[#145c91]">
              {stats?.total_applications ?? applications.length}
            </p>
            <p className="mt-1 text-[10px] text-[#8096aa]">Active in pipeline</p>
          </div>
          <div className="rounded-2xl border border-[#cbe0ee] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#b45309]">UNDER SCRUTINY</p>
            <p className="mt-1 font-serif text-2xl font-bold text-[#b45309]">
              {(stats?.by_stage?.[0] || 0) + (stats?.by_stage?.[1] || 0) + (stats?.by_stage?.[2] || 0)}
            </p>
            <p className="mt-1 text-[10px] text-[#8096aa]">Verification & SCA review</p>
          </div>
          <div className="rounded-2xl border border-[#cbe0ee] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#15803d]">SANCTIONED / DBT</p>
            <p className="mt-1 font-serif text-2xl font-bold text-[#15803d]">
              {(stats?.by_stage?.[3] || 0) + (stats?.by_stage?.[4] || 0)}
            </p>
            <p className="mt-1 text-[10px] text-[#8096aa]">Bank credit & disbursement</p>
          </div>
          <div className="rounded-2xl border border-[#cbe0ee] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#4338ca]">REGISTERED CITIZENS</p>
            <p className="mt-1 font-serif text-2xl font-bold text-[#4338ca]">
              {stats?.total_users ?? users.length}
            </p>
            <p className="mt-1 text-[10px] text-[#8096aa]">With saved profiles</p>
          </div>
        </div>

        {/* Storage Location Callout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#cbe0ee] bg-gradient-to-r from-[#eef7fd] to-[#f4faff] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#145c91] text-white shadow-sm">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="font-serif text-sm font-bold text-[#14283e] flex items-center gap-2">
                User Details Automatically Saving to Excel Sheet
                <span className="rounded bg-[#20bf6b]/15 px-2 py-0.5 text-[10px] font-bold text-[#1e824c]">
                  LIVE AUTO-SYNC
                </span>
              </h3>
              <p className="mt-1 font-mono text-xs text-[#35536e]">
                📁 File Location:{" "}
                <strong className="text-[#145c91]">
                  {excelFolder ? `${excelFolder}` : "Admin_Data folder (auto-detected on server)"}
                </strong>
              </p>
              <p className="mt-0.5 text-[11px] text-[#6b8296]">
                Every time a user fills details or an author advances a stage, this Excel sheet is updated automatically.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadExcel}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#145c91] bg-white px-4 py-2 text-xs font-bold text-[#145c91] hover:bg-[#e8f3fb] transition shadow-sm"
          >
            <Download size={14} />
            Open / Download .xlsx
          </button>
        </div>

        {syncMessage && (
          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-xs font-semibold text-[#166534]">
            ✅ {syncMessage}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-xs font-semibold text-[#166534] flex items-center justify-between">
            <span>✅ {actionSuccess}</span>
            <button onClick={() => setActionSuccess("")} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-xs font-semibold text-[#b91c1c] flex items-center justify-between">
            <span>⚠️ {actionError}</span>
            <button onClick={() => setActionError("")} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Toggle: Applications vs Registered Users */}
        <div className="flex items-center gap-3 border-b border-[#e2eaf0] pb-2">
          <button
            onClick={() => setActiveTab("applications")}
            className={`pb-2 text-sm font-bold transition border-b-2 -mb-2.5 ${
              activeTab === "applications"
                ? "border-[#145c91] text-[#145c91]"
                : "border-transparent text-[#62778a] hover:text-[#172a43]"
            }`}
          >
            Submitted Applications ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-2 text-sm font-bold transition border-b-2 -mb-2.5 ${
              activeTab === "users"
                ? "border-[#145c91] text-[#145c91]"
                : "border-transparent text-[#62778a] hover:text-[#172a43]"
            }`}
          >
            Registered Users & Profiles ({users.length})
          </button>
        </div>

        {activeTab === "applications" ? (
          <>
            {/* Search & Stage Filter Bar */}
            <div className="rounded-2xl border border-[#d5e1e8] bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fa2b3]" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Application ID, Applicant Name, Mobile, Scheme..."
                    className="w-full rounded-xl border border-[#cfdbe3] px-3.5 py-2.5 pl-10 text-xs font-medium text-[#172a43] outline-none placeholder:text-[#9bb0c1] focus:border-[#1769a8]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#667d91] shrink-0">Stage Filter:</span>
                  <select
                    value={selectedStageFilter}
                    onChange={(e) => setSelectedStageFilter(e.target.value)}
                    className="rounded-xl border border-[#cfdbe3] bg-white px-3 py-2 text-xs font-semibold text-[#1e344a] outline-none"
                  >
                    <option value="all">All Stages ({applications.length})</option>
                    {STAGES.map((s) => (
                      <option key={s.index} value={s.index}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Applications List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-[#145c91]" />
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d1dee7] bg-white p-12 text-center">
                <ShieldCheck size={40} className="mx-auto text-[#94a8bc]" />
                <h4 className="mt-3 font-serif text-base font-bold text-[#14283e]">No Applications Found</h4>
                <p className="mt-1 text-xs text-[#62778a]">
                  No applications match your current search or filter criteria.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApps.map((app) => {
                  const stageIdx = app.current_stage_index ?? 0;
                  const isExpanded = selectedApp?.application_id === app.application_id;

                  return (
                    <div
                      key={app.application_id}
                      className="overflow-hidden rounded-2xl border border-[#d5e1e8] bg-white shadow-sm transition hover:border-[#b8cfdf]"
                    >
                      {/* Card Header */}
                      <div className="border-b border-[#edf2f6] bg-[#fbfdfe] p-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono text-sm font-bold text-[#14283e]">
                                {app.application_id}
                              </span>
                              <span className="rounded bg-[#e8f3fb] px-2 py-0.5 text-xs font-semibold text-[#145c91]">
                                {app.scheme_name || app.scheme_id}
                              </span>
                              <span className="text-xs text-[#718596]">
                                Amount: <strong className="text-[#172a43]">{app.loan_amount || "₹ 1,50,000"}</strong>
                              </span>
                            </div>

                            <p className="text-xs text-[#526a84]">
                              <span className="font-bold text-[#172a43]">{app.applicant_name}</span> · Phone:{" "}
                              <span className="font-medium text-[#172a43]">{app.mobile_masked || app.mobile}</span> · Applied:{" "}
                              <span>{app.submission_date || "Recent"}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                                stageIdx === 4
                                  ? "bg-[#e5f7ed] text-[#1e824c]"
                                  : stageIdx === 1
                                  ? "bg-[#fef3dd] text-[#b45309]"
                                  : "bg-[#e8f3fb] text-[#145c91]"
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {app.status_label || STAGES[stageIdx].short}
                            </span>

                            <button
                              onClick={() => {
                                if (isExpanded) {
                                  setSelectedApp(null);
                                  setAppDossier(null);
                                } else {
                                  setSelectedApp(app);
                                  fetchApplicationDossier(app.application_id);
                                }
                              }}
                              className="rounded-lg border border-[#cfdbe3] bg-white px-3 py-1.5 text-xs font-bold text-[#2d4965] hover:bg-[#f2f6fa]"
                            >
                              {isExpanded ? "Close Author Actions" : "Author Actions & Docs"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 5-Stage Visual Stepper */}
                      <div className="bg-white p-5 border-b border-[#edf2f6]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#798e9f] mb-3">
                          Current Processing Journey (Stage {stageIdx + 1} of 5)
                        </p>
                        <div className="grid grid-cols-5 gap-2 relative text-center">
                          {STAGES.map((s, idx) => {
                            const isPast = idx < stageIdx;
                            const isCurrent = idx === stageIdx;
                            return (
                              <div key={s.index} className="flex flex-col items-center">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                    isPast
                                      ? "bg-[#20835c] text-white"
                                      : isCurrent
                                      ? "border-2 border-[#145c91] bg-white text-[#145c91] ring-2 ring-[#145c91]/20 font-extrabold"
                                      : "bg-[#edf2f6] text-[#8fa0b0]"
                                  }`}
                                >
                                  {isPast ? <Check size={13} /> : s.index + 1}
                                </div>
                                <span
                                  className={`mt-1.5 text-[11px] leading-tight ${
                                    isCurrent ? "font-bold text-[#145c91]" : isPast ? "text-[#20835c] font-medium" : "text-[#8fa0b0]"
                                  }`}
                                >
                                  {s.short}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Author Action & Document Scrutiny Panel */}
                      {isExpanded && (
                        <div className="bg-[#fcfdfe] p-5 space-y-5 border-t border-[#edf2f6]">
                          {/* Document Verification & Scrutiny Section */}
                          <div className="rounded-2xl border border-[#d2e2ec] bg-white p-5 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#edf2f6] pb-3">
                              <div>
                                <h4 className="text-sm font-bold text-[#14283e] flex items-center gap-2">
                                  <FileCheck size={18} className="text-[#145c91]" />
                                  Citizen Document Scrutiny
                                  {appDossier?.document_summary && (
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                        appDossier.document_summary.is_complete
                                          ? "bg-[#e5f7ed] text-[#1e824c]"
                                          : "bg-[#fef3dd] text-[#b45309]"
                                      }`}
                                    >
                                      {appDossier.document_summary.verified_required} / {appDossier.document_summary.total_required} Required Verified
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-[#63778a] mt-0.5">
                                  Review citizen's uploaded documents. Verify each requirement or reject with reasons.
                                </p>
                              </div>

                              <button
                                onClick={() => fetchApplicationDossier(app.application_id)}
                                disabled={dossierLoading}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#145c91] hover:underline"
                              >
                                <RefreshCw size={12} className={dossierLoading ? "animate-spin" : ""} />
                                Refresh Docs
                              </button>
                            </div>

                            {/* Completeness Alert Banner */}
                            {appDossier?.document_summary && (
                              <div
                                className={`mt-3.5 rounded-xl border p-3.5 text-xs ${
                                  appDossier.document_summary.is_complete
                                    ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                                    : "border-[#fed7aa] bg-[#fffaf0] text-[#9a3412]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {appDossier.document_summary.is_complete ? (
                                    <>
                                      <CheckCircle2 size={16} className="text-[#16a34a] shrink-0" />
                                      <span className="font-bold">
                                        All Required Documents Verified (100% Complete). This application is authorized to proceed to Stage 3: SCA Review.
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle size={16} className="text-[#ea580c] shrink-0" />
                                      <span>
                                        <strong>Completeness Gate Active:</strong>{" "}
                                        {appDossier.document_summary.total_required - appDossier.document_summary.verified_required} required document(s) pending verification. Advancement to SCA Review is locked until all required documents are marked VERIFIED.
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Documents Table */}
                            {dossierLoading && !appDossier ? (
                              <div className="flex justify-center py-6">
                                <Loader2 size={22} className="animate-spin text-[#145c91]" />
                              </div>
                            ) : (
                              <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-[#e2eaf0] bg-[#f8fbfe] text-[11px] font-bold uppercase text-[#718596]">
                                      <th className="py-2.5 px-3">Document Requirement</th>
                                      <th className="py-2.5 px-3">Type</th>
                                      <th className="py-2.5 px-3">Uploaded File</th>
                                      <th className="py-2.5 px-3">Current Status</th>
                                      <th className="py-2.5 px-3 text-right">Scrutiny Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#edf2f6]">
                                    {(appDossier?.documents || []).map((doc) => (
                                      <tr key={doc.document_id} className="hover:bg-[#fbfdfe]">
                                        <td className="py-3 px-3">
                                          <p className="font-semibold text-[#172a43]">{doc.document_name}</p>
                                          <p className="text-[10px] text-[#718596] font-mono">{doc.document_id}</p>
                                          {doc.rejection_reason && (
                                            <p className="mt-1 text-[11px] text-[#b91c1c] bg-[#fef2f2] p-1.5 rounded">
                                              <strong>Rejected Reason:</strong> {doc.rejection_reason}
                                            </p>
                                          )}
                                        </td>
                                        <td className="py-3 px-3">
                                          {doc.required ? (
                                            <span className="rounded bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#b91c1c]">
                                              MANDATORY
                                            </span>
                                          ) : (
                                            <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">
                                              OPTIONAL
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 px-3">
                                          {doc.file_name ? (
                                            <div>
                                              <p className="font-medium text-[#172a43] truncate max-w-[160px]" title={doc.file_name}>
                                                {doc.file_name}
                                              </p>
                                              <p className="text-[10px] text-[#8fa0b0]">
                                                {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : ""}
                                                {doc.uploaded_at ? ` · ${doc.uploaded_at.split(" ")[0]}` : ""}
                                              </p>
                                              <a
                                                href={`${API_BASE_URL}${doc.view_url}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#145c91] hover:underline"
                                              >
                                                <Eye size={12} />
                                                View Document
                                              </a>
                                            </div>
                                          ) : (
                                            <span className="italic text-[#94a3b8]">Not uploaded yet</span>
                                          )}
                                        </td>
                                        <td className="py-3 px-3">
                                          <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                              doc.status === "VERIFIED"
                                                ? "bg-[#e5f7ed] text-[#1e824c]"
                                                : doc.status === "REJECTED"
                                                ? "bg-[#fee2e2] text-[#b91c1c]"
                                                : doc.status === "UNDER_VERIFICATION" || doc.status === "UPLOADED"
                                                ? "bg-[#fef3dd] text-[#b45309]"
                                                : "bg-[#f1f5f9] text-[#64748b]"
                                            }`}
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                            {doc.status}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {doc.status !== "VERIFIED" && (
                                              <button
                                                onClick={() => handleVerifyDocument(doc.document_id, doc.document_name)}
                                                disabled={actionLoading}
                                                className="rounded-lg bg-[#16a34a] px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-[#15803d] transition"
                                                title="Mark this document verified"
                                              >
                                                Verify
                                              </button>
                                            )}
                                            {doc.status !== "REJECTED" && (
                                              <button
                                                onClick={() => {
                                                  setRejectPromptDocId(doc.document_id);
                                                  setRejectReasonInput("");
                                                }}
                                                disabled={actionLoading}
                                                className="rounded-lg border border-[#fca5a5] bg-[#fff5f5] px-2.5 py-1 text-[11px] font-bold text-[#b91c1c] hover:bg-[#fee2e2] transition"
                                                title="Reject document with reason"
                                              >
                                                Reject
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Rejection Prompt Modal inline */}
                            {rejectPromptDocId && (
                              <div className="mt-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] p-4">
                                <h5 className="text-xs font-bold text-[#991b1b]">
                                  Specify Reason for Rejection:
                                </h5>
                                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                  <input
                                    value={rejectReasonInput}
                                    onChange={(e) => setRejectReasonInput(e.target.value)}
                                    placeholder="e.g. Income certificate is older than 6 months. Please re-upload latest certificate."
                                    className="flex-1 rounded-lg border border-[#fca5a5] bg-white px-3 py-2 text-xs text-[#172a43] outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const d = (appDossier?.documents || []).find((x) => x.document_id === rejectPromptDocId);
                                        handleRejectDocument(rejectPromptDocId, d?.document_name || rejectPromptDocId);
                                      }}
                                      disabled={actionLoading}
                                      className="rounded-lg bg-[#b91c1c] px-3 py-2 text-xs font-bold text-white hover:bg-[#991b1b]"
                                    >
                                      Confirm Rejection
                                    </button>
                                    <button
                                      onClick={() => setRejectPromptDocId(null)}
                                      className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-xs font-bold text-[#4b5563]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stage Transition Control Center */}
                          <div className="rounded-2xl border border-[#cbe0ee] bg-[#f4faff] p-5 space-y-4">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#145c91]">
                                Author Stage Transition Controls
                              </h4>
                              <p className="mt-0.5 text-xs text-[#526a84]">
                                Advance lifecycle stages as scrutiny progresses. All transitions log immutable audit events and sync live to Excel.
                              </p>
                            </div>

                            {/* Stage Action Controllers */}
                            <div className="flex flex-wrap items-center gap-3">
                              {/* Stage 1 -> 2: Proceed to Document Verification */}
                              {stageIdx === 0 && (
                                <button
                                  onClick={() =>
                                    handleAdvanceStage(
                                      app,
                                      1,
                                      "Author authorized application for Document Verification at District Scrutiny Cell."
                                    )
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#d97706] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b45309] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  Proceed to Document Verification (Stage 2)
                                </button>
                              )}

                              {/* Stage 2 -> 3: Proceed to SCA Review (Completeness Gatekeeper) */}
                              {stageIdx === 1 && (
                                <button
                                  onClick={() => handleProceedToSca(app)}
                                  disabled={actionLoading || !appDossier?.document_summary?.is_complete}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition ${
                                    appDossier?.document_summary?.is_complete
                                      ? "bg-[#145c91] hover:bg-[#104d7b] cursor-pointer"
                                      : "bg-[#94a3b8] cursor-not-allowed opacity-75"
                                  }`}
                                  title={
                                    !appDossier?.document_summary?.is_complete
                                      ? "Locked: 100% of required documents must be VERIFIED first"
                                      : "Proceed to SCA Review"
                                  }
                                >
                                  <CheckCircle2 size={15} />
                                  Proceed to SCA Review (Stage 3)
                                </button>
                              )}

                              {/* Stage 3 -> 4: SCA Endorsement to Bank */}
                              {stageIdx === 2 && (
                                <button
                                  onClick={() => handleScaReview(app)}
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#6d28d9] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  Endorse SCA Quota & Forward to Bank (Stage 4)
                                </button>
                              )}

                              {/* Stage 4 -> 5: Bank Sanction with Loan Amount */}
                              {stageIdx === 3 && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <input
                                    value={sanctionAmountInput}
                                    onChange={(e) => setSanctionAmountInput(e.target.value)}
                                    placeholder={`Sanction Amount (Default: ${app.loan_amount || "₹ 1,50,000"})`}
                                    className="rounded-xl border border-[#cfdbe3] bg-white px-3 py-2 text-xs text-[#172a43] outline-none"
                                  />
                                  <button
                                    onClick={() => handleBankSanction(app)}
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#15803d] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#166534] transition shrink-0"
                                  >
                                    <CheckCircle2 size={15} />
                                    Issue Bank Sanction Order
                                  </button>
                                </div>
                              )}

                              {/* Stage 5: DBT Disbursement with UTR */}
                              {stageIdx === 4 && app.status_code !== "DISBURSED" && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <input
                                    value={disbursementRefInput}
                                    onChange={(e) => setDisbursementRefInput(e.target.value)}
                                    placeholder="Enter Bank UTR Ref (e.g. UTR202609001)"
                                    className="rounded-xl border border-[#cfdbe3] bg-white px-3 py-2 text-xs text-[#172a43] outline-none"
                                  />
                                  <button
                                    onClick={() => handleDisbursement(app)}
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#065f46] transition shrink-0"
                                  >
                                    <CheckCircle2 size={15} />
                                    Confirm DBT Disbursement (Final Stage)
                                  </button>
                                </div>
                              )}

                              {stageIdx === 4 && app.status_code === "DISBURSED" && (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#e5f7ed] px-4 py-2 text-xs font-bold text-[#1e824c]">
                                  <CheckCircle2 size={15} />
                                  Application Fully Disbursed & Completed! Ref: {app.disbursement_ref || "Recorded"}
                                </span>
                              )}
                            </div>

                            {/* Author Remarks Input */}
                            <div>
                              <label className="text-[11px] font-bold text-[#455c72]">
                                Official Remarks for Applicant & Timeline:
                              </label>
                              <input
                                value={authorRemarks}
                                onChange={(e) => setAuthorRemarks(e.target.value)}
                                placeholder="e.g. All KYC verified. Endorsed under district quota."
                                className="mt-1 w-full rounded-xl border border-[#cfdbe3] bg-white px-3 py-2 text-xs text-[#172a43] outline-none"
                              />
                            </div>
                          </div>

                          {/* Audit Trail Section */}
                          {appDossier?.audit_logs && appDossier.audit_logs.length > 0 && (
                            <div className="rounded-2xl border border-[#e2eaf0] bg-white p-4">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-[#718596] mb-2.5">
                                Immutable Audit Trail ({appDossier.audit_logs.length} Events)
                              </h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {appDossier.audit_logs.map((log) => (
                                  <div key={log.id} className="flex items-start justify-between gap-3 text-[11px] bg-[#fbfdfe] p-2 rounded-lg border border-[#f0f4f8]">
                                    <div>
                                      <span className="font-bold text-[#145c91]">{log.action}</span>
                                      <span className="text-[#8fa0b0] font-mono"> · {log.role}</span>
                                      <p className="text-[#475569] mt-0.5">{log.remarks}</p>
                                    </div>
                                    <span className="text-[#94a3b8] shrink-0 font-mono text-[10px]">{log.created_at}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Details Summary */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#52657b]">
                            <div className="rounded-xl border border-[#e2eaf0] bg-white p-3">
                              <span className="text-[11px] font-bold uppercase text-[#8195a6]">Purpose</span>
                              <p className="mt-1 font-semibold text-[#172a43]">{app.purpose || "N/A"}</p>
                            </div>
                            <div className="rounded-xl border border-[#e2eaf0] bg-white p-3">
                              <span className="text-[11px] font-bold uppercase text-[#8195a6]">Official Remarks</span>
                              <p className="mt-1 font-medium text-[#172a43]">{app.official_note || "None"}</p>
                            </div>
                            <div className="rounded-xl border border-[#e2eaf0] bg-white p-3">
                              <span className="text-[11px] font-bold uppercase text-[#8195a6]">Assigned Partner</span>
                              <p className="mt-1 font-semibold text-[#172a43]">
                                {app.channel_partner?.name || "State Channelizing Agency"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Users & Profiles Tab */
          <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 shadow-sm">
            <h3 className="font-serif text-base font-bold text-[#14283e]">
              Registered Citizens & Scheme Finder Profiles ({users.length})
            </h3>
            <p className="mt-1 text-xs text-[#62778a]">
              Also saved in Excel at:{" "}
              <strong className="text-[#145c91]">
                {excelFolder ? excelFolder.replace("User_Applications", "User_Profiles") : "Admin_Data/User_Profiles.xlsx"}
              </strong>
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2ebf1] text-[11px] font-bold uppercase text-[#718596] bg-[#f8fbfe]">
                    <th className="py-3 px-3">User ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Mobile</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">State / District</th>
                    <th className="py-3 px-3">Annual Income</th>
                    <th className="py-3 px-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f6]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#fbfdfe]">
                      <td className="py-3 px-3 font-mono font-bold text-[#145c91]">#{u.id}</td>
                      <td className="py-3 px-3 font-semibold text-[#172a43]">{u.name}</td>
                      <td className="py-3 px-3 font-mono text-[#445b72]">{u.identifier}</td>
                      <td className="py-3 px-3 text-[#445b72]">{u.category || "Not filled"}</td>
                      <td className="py-3 px-3 text-[#445b72]">
                        {u.state ? `${u.district || ""}, ${u.state}` : "Not specified"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#1e824c]">
                        {u.annual_income != null ? `₹ ${Number(u.annual_income).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-[#445b72]">{u.purpose || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </FeaturePageShell>
  );
}

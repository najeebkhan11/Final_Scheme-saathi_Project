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
    fetchApplications();
    fetchUsers();
  }, []);

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
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
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
                              onClick={() => setSelectedApp(isExpanded ? null : app)}
                              className="rounded-lg border border-[#cfdbe3] bg-white px-3 py-1.5 text-xs font-bold text-[#2d4965] hover:bg-[#f2f6fa]"
                            >
                              {isExpanded ? "Close Author Actions" : "Author Actions"}
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

                      {/* Author Action Panel */}
                      {isExpanded && (
                        <div className="bg-[#fcfdfe] p-5 space-y-4">
                          <div className="rounded-xl border border-[#cbe0ee] bg-[#f4faff] p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#145c91]">
                              Author Controls: Advance to Next Stage
                            </h4>
                            <p className="mt-1 text-xs text-[#526a84]">
                              As the author, you can authorize and proceed this application to the next step. When you click, the user will immediately see the updated stage on their tracking screen, and the Excel sheet will update automatically.
                            </p>

                            {/* Action Buttons based on current stage */}
                            <div className="mt-3 flex flex-wrap gap-2.5">
                              {stageIdx === 0 && (
                                <button
                                  onClick={() =>
                                    handleAdvanceStage(
                                      app,
                                      1,
                                      "Author approved initial application. Authorized for Document Verification at District Scrutiny Cell."
                                    )
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#d97706] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b45309] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  1. Allow / Proceed to Document Verification
                                </button>
                              )}

                              {stageIdx === 1 && (
                                <button
                                  onClick={() =>
                                    handleAdvanceStage(
                                      app,
                                      2,
                                      "Documents successfully verified by Scrutiny Cell. Forwarded to State Channelizing Agency (SCA) for quota allocation."
                                    )
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#145c91] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#104d7b] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  2. Verify Documents & Proceed to SCA Review
                                </button>
                              )}

                              {stageIdx === 2 && (
                                <button
                                  onClick={() =>
                                    handleAdvanceStage(
                                      app,
                                      3,
                                      "SCA committee has endorsed quota allotment. Forwarded to nominated bank for credit appraisal and sanction."
                                    )
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#6d28d9] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  3. Approve SCA Review & Proceed to Bank Sanction
                                </button>
                              )}

                              {stageIdx === 3 && (
                                <button
                                  onClick={() =>
                                    handleAdvanceStage(
                                      app,
                                      4,
                                      "Bank credit sanction letter issued. Direct Benefit Transfer (DBT) subsidy credit authorized to Aadhaar-linked account."
                                    )
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#15803d] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#166534] transition"
                                >
                                  <CheckCircle2 size={15} />
                                  4. Grant Sanction & Authorize DBT Disbursement
                                </button>
                              )}

                              {stageIdx === 4 && (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#e5f7ed] px-4 py-2 text-xs font-bold text-[#1e824c]">
                                  <CheckCircle2 size={15} />
                                  Application Fully Disbursed & Completed!
                                </span>
                              )}
                            </div>

                            {/* Custom Remarks Input */}
                            <div className="mt-3">
                              <label className="text-[11px] font-bold text-[#455c72]">
                                Optional Author Remarks (Will be shown to applicant and saved in Excel):
                              </label>
                              <div className="mt-1 flex gap-2">
                                <input
                                  value={authorRemarks}
                                  onChange={(e) => setAuthorRemarks(e.target.value)}
                                  placeholder="e.g. All KYC documents confirmed. Site visit scheduled on 08 Sep."
                                  className="flex-1 rounded-xl border border-[#cfdbe3] bg-white px-3 py-2 text-xs text-[#172a43] outline-none"
                                />
                              </div>
                            </div>
                          </div>

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

import React, { useState, useEffect } from "react";
import {
  UserRound,
  Lock,
  Phone,
  MapPin,
  IndianRupee,
  Briefcase,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onTrackApplication,
}) {
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "password" | "applications"
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Profile Form States
  const [name, setName] = useState(currentUser?.name || "");
  const [identifier, setIdentifier] = useState(currentUser?.identifier || "");
  const [category, setCategory] = useState("General");
  const [gender, setGender] = useState("");
  const [stateName, setStateName] = useState("");
  const [district, setDistrict] = useState("");
  const [annualIncome, setAnnualIncome] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requiredLoan, setRequiredLoan] = useState("");

  // Password Form States
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Applications
  const [applications, setApplications] = useState([]);

  // Fetch full profile and applications on open
  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage("");
    setErrorMessage("");

    const token = localStorage.getItem("scheme_saathi_token");
    if (!token) return;

    setLoading(true);

    // Load profile
    fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setName(data.user.name || "");
          setIdentifier(data.user.identifier || "");
        }
        if (data?.profile) {
          const p = data.profile;
          if (p.category) setCategory(p.category);
          if (p.gender) setGender(p.gender);
          if (p.state) setStateName(p.state);
          if (p.district) setDistrict(p.district);
          if (p.annualIncome) setAnnualIncome(p.annualIncome);
          if (p.purpose) setPurpose(p.purpose);
          if (p.requiredLoan) setRequiredLoan(p.requiredLoan);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load user's applications
    fetch(`${API_BASE_URL}/api/applications/my-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.applications) {
          setApplications(data.applications);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Full Name cannot be empty.");
      return;
    }
    if (!identifier.trim()) {
      setErrorMessage("Mobile number is required.");
      return;
    }

    setSaving(true);
    const token = localStorage.getItem("scheme_saathi_token");

    try {
      const payload = {
        name: name.trim(),
        identifier: identifier.trim(),
        category,
        gender,
        state: stateName,
        district,
        annualIncome: annualIncome ? Number(annualIncome) : null,
        purpose,
        requiredLoan: requiredLoan ? Number(requiredLoan) : null,
      };

      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage("Profile details updated successfully!");
        if (data.user) {
          localStorage.setItem("scheme_saathi_user", JSON.stringify(data.user));
          if (onUserUpdated) onUserUpdated(data.user);
        }
      } else {
        setErrorMessage(data.detail || "Failed to update profile.");
      }
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    if (!oldPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    setSaving(true);
    const token = localStorage.getItem("scheme_saathi_token");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setErrorMessage(data.detail || "Failed to change password.");
      }
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#d8e4ec]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2eaf0] bg-[#f8fbfe] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#145c91] text-white shadow-sm">
              <UserRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#14283f]">Account & Profile</h2>
              <p className="text-xs text-[#60758a]">Manage your personal details and security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#60758a] transition hover:bg-[#e8f1f8] hover:text-[#14283f]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e2eaf0] bg-white px-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab("profile");
              setStatusMessage("");
              setErrorMessage("");
            }}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "profile"
                ? "border-[#145c91] text-[#145c91]"
                : "border-transparent text-[#60758a] hover:text-[#14283f]"
            }`}
          >
            <UserRound size={15} /> Personal Details
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setStatusMessage("");
              setErrorMessage("");
            }}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "password"
                ? "border-[#145c91] text-[#145c91]"
                : "border-transparent text-[#60758a] hover:text-[#14283f]"
            }`}
          >
            <Lock size={15} /> Security & Password
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("applications");
              setStatusMessage("");
              setErrorMessage("");
            }}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "applications"
                ? "border-[#145c91] text-[#145c91]"
                : "border-transparent text-[#60758a] hover:text-[#14283f]"
            }`}
          >
            <FileText size={15} /> My Applications ({applications.length})
          </button>
        </div>

        {/* Feedback Alerts */}
        <div className="px-6 pt-4">
          {statusMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#b2e2b2] bg-[#f0fff0] p-3 text-xs font-semibold text-[#276e27]">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#fcc0c0] bg-[#fff5f5] p-3 text-xs font-semibold text-[#c53030]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="max-h-[65vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={30} className="animate-spin text-[#145c91]" />
            </div>
          ) : activeTab === "profile" ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Full Name
                  </label>
                  <div className="relative mt-1">
                    <UserRound size={16} className="absolute left-3 top-3 text-[#7e93a6]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Najeeb Khan"
                      className="w-full rounded-xl border border-[#d2dce4] bg-white pl-9 pr-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91] focus:ring-1 focus:ring-[#145c91]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Registered Mobile Number
                  </label>
                  <div className="relative mt-1">
                    <Phone size={16} className="absolute left-3 top-3 text-[#7e93a6]" />
                    <input
                      type="tel"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      maxLength={10}
                      placeholder="10-digit Indian number"
                      className="w-full rounded-xl border border-[#d2dce4] bg-white pl-9 pr-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91] focus:ring-1 focus:ring-[#145c91]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Category (Caste)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2dce4] bg-white px-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                  >
                    <option value="SC">SC (Scheduled Caste)</option>
                    <option value="ST">ST (Scheduled Tribe)</option>
                    <option value="OBC">OBC (Other Backward Classes)</option>
                    <option value="DNT">DNT (De-notified Tribe)</option>
                    <option value="General">General / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2dce4] bg-white px-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    State
                  </label>
                  <div className="relative mt-1">
                    <MapPin size={16} className="absolute left-3 top-3 text-[#7e93a6]" />
                    <input
                      type="text"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      placeholder="e.g. Uttar Pradesh"
                      className="w-full rounded-xl border border-[#d2dce4] bg-white pl-9 pr-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Lucknow"
                    className="mt-1 w-full rounded-xl border border-[#d2dce4] bg-white px-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Annual Family Income (₹)
                  </label>
                  <div className="relative mt-1">
                    <IndianRupee size={16} className="absolute left-3 top-3 text-[#7e93a6]" />
                    <input
                      type="number"
                      value={annualIncome}
                      onChange={(e) => setAnnualIncome(e.target.value)}
                      placeholder="e.g. 450000"
                      className="w-full rounded-xl border border-[#d2dce4] bg-white pl-9 pr-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                    Requirement / Purpose
                  </label>
                  <div className="relative mt-1">
                    <Briefcase size={16} className="absolute left-3 top-3 text-[#7e93a6]" />
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. New Business, Education"
                      className="w-full rounded-xl border border-[#d2dce4] bg-white pl-9 pr-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[#cfdbe3] px-5 py-2.5 text-sm font-semibold text-[#52677d] hover:bg-[#f5f8fb]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#145c91] hover:bg-[#104a75] px-6 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Save Profile Changes
                </button>
              </div>
            </form>
          ) : activeTab === "password" ? (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md mx-auto py-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                  Current Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showOldPw ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-[#d2dce4] bg-white pl-3 pr-10 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-3 top-3 text-[#7e93a6] hover:text-[#14283f]"
                  >
                    {showOldPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                  New Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-[#d2dce4] bg-white pl-3 pr-10 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-3 text-[#7e93a6] hover:text-[#14283f]"
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#405466]">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  className="mt-1 w-full rounded-xl border border-[#d2dce4] bg-white px-3 py-2.5 text-sm text-[#14283f] outline-none focus:border-[#145c91]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#145c91] hover:bg-[#104a75] px-6 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Update Password
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {applications.length === 0 ? (
                <div className="rounded-xl border border-[#dce5ed] bg-[#f9fcfe] p-8 text-center">
                  <FileText size={32} className="mx-auto text-[#7d93a8]" />
                  <p className="mt-2 text-sm font-bold text-[#14283f]">No Applications Found</p>
                  <p className="mt-1 text-xs text-[#60758a]">
                    You haven't submitted any scheme applications yet. Complete Scheme Finder to match and submit!
                  </p>
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-[#dce5ed] bg-white p-4 shadow-sm hover:border-[#145c91] transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#145c91] bg-[#eef7fb] px-2 py-0.5 rounded">
                          {app.application_id}
                        </span>
                        <span className="text-xs font-semibold text-[#47744a] bg-[#edf6ec] px-2 py-0.5 rounded-full">
                          {app.status_label || "Submitted"}
                        </span>
                      </div>
                      <h4 className="mt-1 font-bold text-sm text-[#14283f]">{app.scheme_name}</h4>
                      <p className="text-xs text-[#60758a]">
                        Loan: {app.loan_amount} • Submitted on {app.submission_date}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onTrackApplication && onTrackApplication(app.application_id)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#145c91] hover:bg-[#0f4670] px-4 py-2 text-xs font-bold text-white shadow transition shrink-0"
                    >
                      Track Status <ArrowRight size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

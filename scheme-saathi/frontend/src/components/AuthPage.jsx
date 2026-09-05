import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  LockKeyhole,
  ShieldCheck,
  FileText,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { TextField, AuthBenefit } from "./common/CommonUI";
import { API_BASE_URL } from "../config/api";

export default function AuthPage({
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

  const updateField = (field, value) => {
    setError("");
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (authMode === "signup") {
      if (
        !form.identifier.trim() ||
        !form.name.trim() ||
        !form.password ||
        !form.confirmPassword
      ) {
        setError("Please fill all required fields.");
        return;
      }

      if (!INDIAN_PHONE_RE.test(form.identifier.trim())) {
        setError("Enter Valid 10 digit Indian Number");
        return;
      }

      if (form.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setError("Password and Confirm Password do not match.");
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            identifier: form.identifier.trim(),
            password: form.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(
            data?.detail || "Failed to create account. Please try again."
          );
          setLoading(false);
          return;
        }

        if (data.access_token) {
          localStorage.setItem("scheme_saathi_token", data.access_token);
        }

        if (data.user) {
          localStorage.setItem("scheme_saathi_user", JSON.stringify(data.user));
        }

        if (onSignupSuccess) {
          onSignupSuccess(data.user);
        } else if (onLogin) {
          onLogin(data.user);
        }
      } catch {
        setError(
          "Unable to connect to server. Please verify the backend is running."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // Login mode
    if (!form.identifier.trim() || !form.password) {
      setError("Please enter your mobile number and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.detail || "Invalid mobile number or password.");
        setLoading(false);
        return;
      }

      if (data.access_token) {
        localStorage.setItem("scheme_saathi_token", data.access_token);
      }

      if (data.user) {
        localStorage.setItem("scheme_saathi_user", JSON.stringify(data.user));
      }

      if (onLogin) {
        onLogin(data.user);
      }
    } catch {
      setError(
        "Unable to connect to server. Please verify the backend is running."
      );
    } finally {
      setLoading(false);
    }
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
                and provide personalized scheme discovery and recommendations.
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
                  text="Real password verification will be handled by the backend."
                />
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-10">
            <div className="max-w-md">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                {authMode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
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

              {error && (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                  <span className="leading-5 font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-5">
                {authMode === "signup" && (
                  <TextField
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(value) => updateField("name", value)}
                  />
                )}

                <TextField
                  label="Mobile Number"
                  placeholder="Enter 10-digit mobile number"
                  value={form.identifier}
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
                      placeholder={
                        authMode === "signup"
                          ? "Create a password (min 6 characters)"
                          : "Enter password"
                      }
                      className="w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 pr-12 text-sm text-[#21364f] outline-none transition placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((curr) => !curr)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#768798]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {authMode === "signup" && (
                  <div>
                    <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(event) => updateField("confirmPassword", event.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10"
                    />
                  </div>
                )}

                {authMode === "login" && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-[#66778a]">
                      <input type="checkbox" className="h-4 w-4 accent-[#145c91]" />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "Password recovery will be connected to the backend authentication service."
                        )
                      }
                      className="font-semibold text-[#1769a8]"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#145c91] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#104d7b] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span>{authMode === "login" ? "Signing In..." : "Creating Account..."}</span>
                  ) : (
                    <>
                      <span>{authMode === "login" ? "Sign In" : "Create Account"}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e3e9ee]" />
                <span className="text-[11px] font-semibold text-[#95a1ad]">OR</span>
                <div className="h-px flex-1 bg-[#e3e9ee]" />
              </div>

              {authMode === "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setError("");
                    if (onSignup) onSignup();
                  }}
                  className="w-full rounded-lg border border-[#cfdbe3] px-5 py-3.5 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
                >
                  Don't have an account? Create one
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                  }}
                  className="w-full rounded-lg border border-[#cfdbe3] px-5 py-3.5 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
                >
                  Already have an account? Sign in
                </button>
              )}

              <div className="mt-7 flex gap-2 rounded-lg bg-[#f6fafc] p-3 text-[11px] leading-5 text-[#778799]">
                <LockKeyhole size={15} className="mt-0.5 shrink-0 text-[#1769a8]" />
                <span>
                  You can explore general scheme information without signing in. Login is required only for personalized scheme matching.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

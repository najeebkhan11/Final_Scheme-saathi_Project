import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "../i18n";
import { API_BASE_URL } from "../config/api";
import { apiCache } from "../services/apiCache";

export default function EMICalculator({ onBack }) {
  const { t } = useTranslation();
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("6");
  const [tenure, setTenure] = useState("60");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const calculate = async () => {
    setError("");
    setResult(null);

    const p = Number(principal);
    const r = Number(interestRate);
    const tVal = Number(tenure);

    if (!p || p <= 0) {
      setError(t("Please enter a valid loan amount."));
      return;
    }
    if (r == null || isNaN(r) || r < 0) {
      setError(t("Please enter a valid interest rate."));
      return;
    }
    if (!tVal || tVal <= 0) {
      setError(t("Please enter a valid tenure."));
      return;
    }

    const emiKey = `${p}_${r}_${tVal}`;
    const cached = apiCache.getEmi(emiKey);
    if (cached != null) {
      setResult(cached);
      return;
    }

    const calculateClientEmi = (principalAmount, rate, months) => {
      const monthlyRate = rate / (12 * 100);
      let emi = 0;
      if (monthlyRate === 0) {
        emi = Math.round(principalAmount / months);
      } else {
        emi = Math.round(
          (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
            (Math.pow(1 + monthlyRate, months) - 1)
        );
      }
      const totalRepayment = emi * months;
      const totalInterest = Math.max(0, totalRepayment - principalAmount);
      return {
        principal: principalAmount,
        interest_rate: rate,
        tenure_months: months,
        monthly_emi: emi,
        total_interest: totalInterest,
        total_repayment: totalRepayment,
        calculation_method: "Standard reducing balance formula (Deterministic)",
      };
    };

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/emi/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal: p,
          interest_rate: r,
          tenure_months: tVal,
        }),
      });

      if (!response.ok) {
        throw new Error("EMI calculation failed.");
      }

      const data = await response.json();
      const emiResult = data?.emi || (data && data.monthly_emi != null ? data : calculateClientEmi(p, r, tVal));
      apiCache.setEmi(emiKey, emiResult);
      setResult(emiResult);
    } catch {
      // Seamless offline / network fallback calculation
      const fallbackEmi = calculateClientEmi(p, r, tVal);
      apiCache.setEmi(emiKey, fallbackEmi);
      setResult(fallbackEmi);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="border-b border-[#dce4ea] bg-white">
        <div className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft size={18} />
            {t("Back to Home")}
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />
              <Sparkles size={17} />
            </div>
            <p className="font-serif text-[18px] font-bold tracking-wide text-[#172a43]">
              SCHEME SAATHI
            </p>
          </div>

          <span className="hidden text-xs font-semibold text-[#718096] sm:block">
            {t("Financial Calculator")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
            {t("FINANCIAL CALCULATOR")}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#172a43] md:text-5xl">
            {t("Calculate your loan EMI.")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[#66788d]">
            {t("Use the standard EMI formula to understand your monthly repayment before applying.")}
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-[#d7e2e9] bg-white p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                {t("Loan Amount (₹)")}
              </label>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="e.g. 250000"
                className="w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                {t("Interest Rate (% p.a.)")}
              </label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 6.5"
                step="0.1"
                className="w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#2c4058]">
                {t("Tenure (months)")}
              </label>
              <input
                type="number"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                placeholder="e.g. 60"
                className="w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              <span className="leading-5 font-medium">{error}</span>
            </div>
          )}

          <button
            onClick={calculate}
            disabled={loading}
            className="mt-6 flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("Calculating...")}
              </>
            ) : (
              <>
                {t("Calculate EMI")}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="mt-8 rounded-2xl border border-[#d4e8d4] bg-[#f0f8f0] p-7">
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#3d7a42]">
              {t("EMI CALCULATION RESULT")}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-5">
                <p className="text-[11px] text-[#7a8998]">{t("Monthly EMI")}</p>
                <p className="mt-1 font-serif text-3xl font-bold text-[#145c91]">
                  ₹{Number(result.monthly_emi).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5">
                <p className="text-[11px] text-[#7a8998]">{t("Total Interest")}</p>
                <p className="mt-1 font-serif text-3xl font-bold text-[#1b3148]">
                  ₹{Number(result.total_interest).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5">
                <p className="text-[11px] text-[#7a8998]">{t("Total Repayment")}</p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#1b3148]">
                  ₹{Number(result.total_repayment).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5">
                <p className="text-[11px] text-[#7a8998]">{t("Tenure")}</p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#1b3148]">
                  {result.tenure_months} {t("months")}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-[#d4e2e9] bg-white p-3 text-[11px] leading-5 text-[#718096]">
              {t("Calculation method")}: {result.calculation_method} •{" "}
              {t("Interest rate")}: {result.interest_rate}% p.a. •{" "}
              {t("Principal")}: ₹{Number(result.principal).toLocaleString("en-IN")}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

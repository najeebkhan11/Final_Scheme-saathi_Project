import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Layers, Award } from "lucide-react";
import { PRIMARY_SCHEMES, SECONDARY_SCHEMES } from "../data/schemesConstants";
import { SchemeCard } from "./common/CommonUI";
import { useTranslation } from "../i18n";

export default function ExploreSchemes({ onBack, onLogin, onLocatePartner }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all"); // 'all' | 'primary' | 'secondary'

  const showPrimary = filter === "all" || filter === "primary";
  const showSecondary = filter === "all" || filter === "secondary";

  return (
    <div className="min-h-screen bg-[#f5f9fc]">
      <header className="border-b border-[#dce4ec] bg-white">
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
            {t("Public Scheme Explorer")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
            {t("EXPLORE SCHEMES")}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#172a43] md:text-5xl">
            {t("Explore government credit options.")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[#66788d]">
            {t("Browse all 10 Primary and Secondary credit schemes under Scheme Saathi without creating an account. View interest rates, loan limits, eligibility criteria, and find nearby channel partners on the map.")}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          <button
            onClick={() => setFilter("all")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition ${
              filter === "all"
                ? "bg-[#145c91] text-white shadow-sm"
                : "border border-[#d7e1e9] bg-white text-[#566879] hover:bg-[#f1f6fa]"
            }`}
          >
            <Layers size={15} />
            <span>{t("All Schemes")} (10)</span>
          </button>
          <button
            onClick={() => setFilter("primary")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition ${
              filter === "primary"
                ? "bg-[#145c91] text-white shadow-sm"
                : "border border-[#d7e1e9] bg-white text-[#566879] hover:bg-[#f1f6fa]"
            }`}
          >
            <Sparkles size={15} />
            <span>{t("Primary Schemes")} (5)</span>
          </button>
          <button
            onClick={() => setFilter("secondary")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition ${
              filter === "secondary"
                ? "bg-[#145c91] text-white shadow-sm"
                : "border border-[#d7e1e9] bg-white text-[#566879] hover:bg-[#f1f6fa]"
            }`}
          >
            <Award size={15} />
            <span>{t("Secondary Schemes")} (5)</span>
          </button>
        </div>

        {/* Primary Schemes Section */}
        {showPrimary && (
          <section className="mt-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                  {t("PRIMARY SCHEMES")}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                  {t("Core Concessional Credit Schemes")}
                </h2>
                <p className="mt-1 text-xs text-[#6e8093]">
                  {t("Foundational NSFDC credit assistance for self-employment, micro-business, and higher education.")}
                </p>
              </div>
              <span className="rounded-full border border-[#d5e0e7] bg-white px-4 py-2 text-[11px] font-bold text-[#637589]">
                {t("5 PRIMARY SCHEMES")}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PRIMARY_SCHEMES.map((scheme) => (
                <SchemeCard
                  key={scheme.code}
                  {...scheme}
                  onLocatePartner={onLocatePartner}
                />
              ))}
            </div>
          </section>
        )}

        {/* Secondary Schemes Section */}
        {showSecondary && (
          <section className="mt-14">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#2c7a7b]">
                  {t("SECONDARY SCHEMES")}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                  {t("Targeted & Specialized Credit Schemes")}
                </h2>
                <p className="mt-1 text-xs text-[#6e8093]">
                  {t("Specialized programs for skill acquisition, women empowerment, eco-friendly green initiatives, and greenfield enterprises.")}
                </p>
              </div>
              <span className="rounded-full border border-[#cbe4de] bg-[#eef7f5] px-4 py-2 text-[11px] font-bold text-[#1f665a]">
                {t("5 SECONDARY SCHEMES")}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {SECONDARY_SCHEMES.map((scheme) => (
                <SchemeCard
                  key={scheme.code}
                  {...scheme}
                  onLocatePartner={onLocatePartner}
                />
              ))}
            </div>

            {/* Connected Support: VISVAS Interest Subvention */}
            <div className="mt-8 rounded-2xl border border-[#d7e3ea] bg-white p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf6fa] text-[#1769a8]">
                  <ShieldCheck size={23} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#23384f]">
                    {t("VISVAS — Connected Interest Subvention Support")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#718096]">
                    {t("Eligible SC, OBC and Safai Karamchari individual beneficiaries receiving loans from participating banks may receive up to 5% interest subvention under the Central Government VISVAS scheme.")}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-[#f7fafc] p-3">
                      <p className="text-[10px] text-[#84919d]">{t("Interest Support")}</p>
                      <p className="mt-1 text-sm font-bold text-[#145c91]">{t("Up to 5% p.a.")}</p>
                    </div>
                    <div className="rounded-lg bg-[#f7fafc] p-3">
                      <p className="text-[10px] text-[#84919d]">{t("Individual Loan Cap")}</p>
                      <p className="mt-1 text-sm font-bold text-[#263b52]">{t("Up to ₹5 lakh")}</p>
                    </div>
                    <div className="rounded-lg bg-[#f7fafc] p-3">
                      <p className="text-[10px] text-[#84919d]">{t("Channel Route")}</p>
                      <p className="mt-1 text-sm font-bold text-[#263b52]">{t("Scheduled Lending Banks")}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-[10px] leading-5 text-[#8a7b62]">
                    {t("VISVAS is complementary interest subvention support applicable across eligible government credit assistance accounts.")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-12 rounded-2xl bg-[#eaf5fa] p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#1769a8]">
                {t("WANT PERSONALIZED RESULTS?")}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#1c334c]">
                {t("Sign in to find schemes matched to your profile.")}
              </h2>
            </div>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b]"
            >
              {t("Sign In & Continue")}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Layers, Award, Search, Bot } from "lucide-react";
import { PRIMARY_SCHEMES, SECONDARY_SCHEMES } from "../data/schemesConstants";
import { SchemeCard } from "./common/CommonUI";
import { useTranslation } from "../i18n";

export default function ExploreSchemes({ onBack, onLogin, onLocatePartner, onNavigate, isLoggedIn }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filterScheme = (s) =>
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.tag?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q);
    return {
      primary: PRIMARY_SCHEMES.filter(filterScheme),
      secondary: SECONDARY_SCHEMES.filter(filterScheme),
    };
  }, [search]);

  const showPrimary = filter === "all" || filter === "primary";
  const showSecondary = filter === "all" || filter === "secondary";
  const totalFiltered = filtered.primary.length + filtered.secondary.length;

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

          <button
            onClick={() => onNavigate ? onNavigate("ai_assistant") : null}
            className="hidden items-center gap-2 rounded-lg border border-[#cbe0ee] bg-[#eef7fd] px-4 py-2 text-xs font-bold text-[#145c91] transition hover:bg-[#ddeef9] sm:flex"
          >
            <Bot size={15} />
            {t("Ask AI Assistant")}
          </button>
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
            {t("Browse all 10 Primary and Secondary credit schemes under Scheme Saathi. View interest rates, loan limits, eligibility criteria, and find nearby channel partners.")}
          </p>
        </div>

        {/* Search + Filter Row */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2.5">
            {[
              { id: "all", label: `${t("All Schemes")} (10)`, icon: <Layers size={15} /> },
              { id: "primary", label: `${t("Primary Schemes")} (5)`, icon: <Sparkles size={15} /> },
              { id: "secondary", label: `${t("Secondary Schemes")} (5)`, icon: <Award size={15} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition ${
                  filter === tab.id
                    ? "bg-[#145c91] text-white shadow-sm"
                    : "border border-[#d7e1e9] bg-white text-[#566879] hover:bg-[#f1f6fa]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8496aa]" />
            <input
              type="text"
              placeholder={t("Search schemes...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#d7e1e9] bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-[#a0b0bc] focus:border-[#145c91] focus:ring-2 focus:ring-[#145c91]/10"
            />
          </div>
        </div>

        {/* Search result info */}
        {search && (
          <p className="mt-3 text-xs text-[#6e8093]">
            {totalFiltered > 0
              ? `Found ${totalFiltered} scheme${totalFiltered !== 1 ? "s" : ""} matching "${search}"`
              : `No schemes found for "${search}". Try a different keyword.`}
          </p>
        )}

        {/* Primary Schemes Section */}
        {showPrimary && filtered.primary.length > 0 && (
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
                {filtered.primary.length} {t("PRIMARY SCHEMES")}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.primary.map((scheme) => (
                <div key={scheme.code} className="group relative flex flex-col">
                  <SchemeCard {...scheme} onLocatePartner={onLocatePartner} />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onNavigate ? onNavigate("finder") : onLogin?.()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#145c91] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#104d7b]"
                    >
                      <ArrowRight size={12} />
                      {t("Check Eligibility")}
                    </button>
                    <button
                      onClick={() => onNavigate ? onNavigate("ai_assistant") : null}
                      className="flex items-center gap-1.5 rounded-lg border border-[#cbe0ee] bg-[#eef7fd] px-3 py-2 text-[11px] font-bold text-[#145c91] transition hover:bg-[#ddeef9]"
                    >
                      <Bot size={12} />
                      {t("Ask AI")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Secondary Schemes Section */}
        {showSecondary && filtered.secondary.length > 0 && (
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
                {filtered.secondary.length} {t("SECONDARY SCHEMES")}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.secondary.map((scheme) => (
                <div key={scheme.code} className="group relative flex flex-col">
                  <SchemeCard {...scheme} onLocatePartner={onLocatePartner} />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onNavigate ? onNavigate("finder") : onLogin?.()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#145c91] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#104d7b]"
                    >
                      <ArrowRight size={12} />
                      {t("Check Eligibility")}
                    </button>
                    <button
                      onClick={() => onNavigate ? onNavigate("ai_assistant") : null}
                      className="flex items-center gap-1.5 rounded-lg border border-[#cbe0ee] bg-[#eef7fd] px-3 py-2 text-[11px] font-bold text-[#145c91] transition hover:bg-[#ddeef9]"
                    >
                      <Bot size={12} />
                      {t("Ask AI")}
                    </button>
                  </div>
                </div>
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
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="mt-12 rounded-2xl bg-gradient-to-r from-[#eaf5fa] to-[#f4faff] p-8 border border-[#cde5f5]">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#1769a8]">
                {t("READY TO APPLY?")}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#1c334c]">
                {t("Find the scheme that matches your profile.")}
              </h2>
              <p className="mt-1 text-sm text-[#66788d]">
                {t("Our AI-powered eligibility checker will match you to the right scheme in minutes.")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate ? onNavigate("finder") : onLogin?.()}
                className="flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b] shadow-sm"
              >
                {t("Find My Scheme")}
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => onNavigate ? onNavigate("ai_assistant") : null}
                className="flex items-center gap-2 rounded-lg border border-[#145c91] bg-white px-6 py-3.5 font-semibold text-[#145c91] transition hover:bg-[#eef7fd]"
              >
                <Bot size={18} />
                {t("Ask AI Assistant")}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

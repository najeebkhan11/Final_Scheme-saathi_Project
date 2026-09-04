import React from "react";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { PRIMARY_SCHEMES } from "../data/schemesConstants";
import { SchemeCard } from "./common/CommonUI";
import { useTranslation } from "../i18n";

export default function ExploreSchemes({ onBack, onLogin }) {
  const { t } = useTranslation();

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
            {t("Browse the primary Scheme Saathi scope without creating an account. Personalized eligibility matching requires sign-in.")}
          </p>
        </div>

        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7b8998]">
                {t("PRIMARY")}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                {t("PS-Core Schemes")}
              </h2>
            </div>
            <span className="rounded-full border border-[#d5e0e7] bg-white px-4 py-2 text-[11px] font-bold text-[#637589]">
              {t("5 CORE SCHEMES")}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRIMARY_SCHEMES.map((scheme) => (
              <SchemeCard key={scheme.code} {...scheme} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-6">
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#7b8998]">
              {t("SECONDARY")}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
              {t("Related / Connected Support")}
            </h2>
          </div>

          <div className="rounded-2xl border border-[#d7e3ea] bg-white p-7 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf6fa] text-[#1769a8]">
                <ShieldCheck size={23} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-[#23384f]">
                  {t("VISVAS — Connected Interest Support")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#718096]">
                  {t("Eligible SC, OBC and Safai Karamchari individual beneficiaries may receive interest subvention support, subject to the separate VISVAS eligibility conditions.")}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">{t("Interest Support")}</p>
                    <p className="mt-1 text-sm font-bold text-[#145c91]">{t("Up to 5%")}</p>
                  </div>
                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">{t("Individual Loan")}</p>
                    <p className="mt-1 text-sm font-bold text-[#263b52]">{t("Up to ₹5 lakh")}</p>
                  </div>
                  <div className="rounded-lg bg-[#f7fafc] p-3">
                    <p className="text-[10px] text-[#84919d]">{t("Route")}</p>
                    <p className="mt-1 text-sm font-bold text-[#263b52]">{t("Lending Institutions")}</p>
                  </div>
                </div>

                <p className="mt-4 text-[10px] leading-5 text-[#8a7b62]">
                  {t("VISVAS is shown as connected support and is not treated as one of the five primary NSFDC scheme recommendations.")}
                </p>
              </div>
            </div>
          </div>
        </section>

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

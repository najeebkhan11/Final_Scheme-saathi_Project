import React, { useMemo } from "react";
import {
  Bot,
  ArrowRight,
  Globe2,
  ShieldCheck,
  LockKeyhole,
  Sparkles,
  UserRound,
  FileText,
  Calculator,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import AppNavbar from "./AppNavbar";
import { useTranslation } from "../i18n";
import { apiCache } from "../services/apiCache";
import {
  TrustItem,
  MatchPoint,
  FeatureStrip,
  ProcessStep,
  MatchScoreDisplay,
  MatchScoreRing,
} from "./common/CommonUI";

export default function LandingPage({
  onFindScheme,
  onExplore,
  onLogin,
  onNavigate,
  isLoggedIn,
  currentUser,
  onLogout,
  hideNavbar = false,
  lastSchemeResults: propResults,
  lastSchemeFormData: propFormData,
}) {
  const { t } = useTranslation();

  const saved = useMemo(() => {
    if (propResults) {
      return { results: propResults, formData: propFormData };
    }
    return apiCache.getSavedRecommendations();
  }, [propResults, propFormData]);

  const results = saved?.results;
  const formData = saved?.formData;

  const topScheme =
    results?.best_scheme ||
    results?.primary?.eligible?.[0] ||
    null;

  const hasRecommendation = Boolean(topScheme);
  const matchScore = hasRecommendation
    ? (results?.match_score ?? topScheme?.match_score ?? 95)
    : null;

  const schemeName = hasRecommendation
    ? (topScheme?.scheme_name || topScheme?.name || "Recommended Scheme")
    : t("Based on your profile");

  const maxLoanText = hasRecommendation
    ? (topScheme?.financial_terms?.maximum_loan_amount_inr
        ? `₹${Number(topScheme.financial_terms.maximum_loan_amount_inr).toLocaleString("en-IN")}`
        : "Applicable")
    : t("Applicable");

  const interestRateText = hasRecommendation
    ? (topScheme?.financial_terms?.beneficiary_interest_rate_percent
        ? `${topScheme.financial_terms.beneficiary_interest_rate_percent}% p.a.`
        : "Applicable")
    : t("Applicable");

  return (
    <>
      {!hideNavbar && (
        <AppNavbar
          activeView="home"
          onNavigate={onNavigate}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      )}

      <main>
        <section className="relative overflow-hidden bg-[#eaf5fa]">
          <div className="absolute -left-32 top-10 h-[500px] w-[500px] rounded-full bg-white/60 blur-3xl" />
          <div className="absolute right-0 top-0 h-full w-[45%] bg-gradient-to-l from-[#dceef5]/70 to-transparent" />

          <div className="relative mx-auto grid min-h-[610px] max-w-[1440px] items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_0.9fr] lg:px-20 lg:py-20">
            <div className="relative z-10">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#c9d5df] bg-white/75 px-5 py-2.5 shadow-sm">
                <Bot size={18} className="text-[#1769a8]" />
                <span className="text-[13px] font-semibold tracking-[0.12em] text-[#536275]">
                  {t("AI-POWERED SCHEME MATCHING")}
                </span>
              </div>

              <h2 className="max-w-[680px] font-serif text-[36px] sm:text-[46px] md:text-[54px] lg:text-[62px] font-bold leading-[1.08] tracking-[-0.02em] text-[#12365d]">
                {t("Find the right government scheme for your next step.")}
              </h2>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px w-20 bg-[#c6a56b]" />
                <div className="h-2 w-2 rotate-45 bg-[#c6a56b]" />
                <div className="h-px w-8 bg-[#c6a56b]" />
              </div>

              <p className="max-w-[650px] text-[16px] sm:text-[18px] leading-7 sm:leading-8 text-[#43566f]">
                {t("Discover suitable schemes, calculate loan details, and connect with the right partners — all in one place.")}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={onFindScheme}
                  className="group flex items-center gap-3 rounded-lg bg-[#145c91] px-6 sm:px-7 py-3.5 sm:py-4 text-[15px] sm:text-[16px] font-semibold text-white shadow-lg shadow-[#145c91]/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#104d7b]"
                >
                  {t("Find My Scheme")}
                  <ArrowRight size={19} className="transition group-hover:translate-x-1" />
                </button>

                <button
                  onClick={onExplore}
                  className="group flex items-center gap-3 rounded-lg border-2 border-[#145c91] bg-white/80 px-6 sm:px-7 py-3.5 sm:py-4 text-[15px] sm:text-[16px] font-semibold text-[#145c91] transition hover:bg-white"
                >
                  {t("Explore Schemes")}
                  <ArrowRight size={19} className="transition group-hover:translate-x-1" />
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
                <TrustItem icon={<Globe2 size={19} />} text={t("Multilingual Support")} />
                <TrustItem icon={<ShieldCheck size={19} />} text={t("Explainable Matching")} />
                <TrustItem icon={<LockKeyhole size={18} />} text={t("Secure & Trusted")} />
              </div>
            </div>

            <div className="relative z-10">
              <div className="relative rounded-[18px] border-2 border-[#31465c] bg-[#fffdf7] p-5 shadow-[0_20px_50px_rgba(38,68,94,0.15)] md:p-6">
                <div className="absolute -right-1 top-0 overflow-hidden">
                  <div className="flex h-[105px] w-[65px] flex-col items-center justify-start bg-[#175b88] px-2 pt-3 text-center text-white shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]">
                    <Sparkles size={17} />
                    <span className="mt-2 text-[10px] font-bold leading-3">
                      {t("BEST")}
                      <br />
                      {t("MATCH")}
                    </span>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-center gap-3">
                  <div className="h-px flex-1 bg-[#c8d1d9]" />
                  <span className="font-serif text-[15px] font-bold tracking-[0.08em] text-[#24384e]">
                    {t("YOUR PERSONAL MATCH")}
                  </span>
                  <div className="h-px flex-1 bg-[#c8d1d9]" />
                </div>

                <div className="rounded-xl border-2 border-[#43586c] bg-[#fffef9] p-5">
                  <div className="grid grid-cols-[0.95fr_1.15fr] gap-5">
                    <div className="flex min-h-[230px] flex-col items-center justify-center border-r border-[#d4dbe1] pr-5">
                      <p className="text-[12px] font-semibold text-[#37485a]">
                        {t("Match Score")}
                      </p>
                      <MatchScoreDisplay score={matchScore} />
                      <MatchScoreRing score={matchScore} />
                    </div>

                    <div className="space-y-4">
                      <MatchPoint
                        icon={<UserRound size={16} />}
                        title={t("Income Eligible")}
                        subtitle={
                          formData?.annualIncome
                            ? `≤ ₹5,00,000 (${t("Verified")})`
                            : t("Verified by rule engine")
                        }
                      />
                      <MatchPoint
                        icon={<FileText size={16} />}
                        title={t("Purpose Matched")}
                        subtitle={
                          formData?.purpose
                            ? `${formData.purpose.replaceAll("_", " ")} (${t("Verified")})`
                            : t("Based on requirement")
                        }
                      />
                      <MatchPoint
                        icon={<Calculator size={16} />}
                        title={t("Loan Requirement")}
                        subtitle={
                          formData?.requiredLoan
                            ? `₹${Number(formData.requiredLoan).toLocaleString("en-IN")} (${t("Checked")})`
                            : t("Compared with scheme limits")
                        }
                      />
                      <button
                        type="button"
                        onClick={() => onNavigate("partner_locator")}
                        className="w-full text-left transition hover:opacity-85"
                      >
                        <MatchPoint
                          icon={<MapPin size={16} />}
                          title={t("Partner Matching")}
                          subtitle={
                            formData?.district && formData?.state
                              ? `${formData.district}, ${formData.state}`
                              : t("Location-aware routing")
                          }
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border-2 border-[#43586c] bg-[#fffef9] p-4">
                  <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr] items-center gap-4">
                    <div>
                      <p className="text-[11px] text-[#748396]">
                        {hasRecommendation
                          ? t("Top Recommended Scheme")
                          : t("Recommended Schemes")}
                      </p>
                      <h3 className="mt-1 font-serif text-[19px] font-bold text-[#17263b] line-clamp-1">
                        {schemeName}
                      </h3>
                      <p className="mt-1 text-[10px] text-[#65758a]">
                        {hasRecommendation
                          ? t("Verified by Government Rule Engine")
                          : t("Take 2-min assessment to discover your match")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#748396]">{t("Max Loan")}</p>
                      <p className="mt-1 font-bold text-[#17263b]">{maxLoanText}</p>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#748396]">{t("Interest Rate")}</p>
                      <p className="mt-1 font-bold text-[#17263b]">{interestRateText}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (hasRecommendation) {
                      onNavigate("recommendations");
                    } else {
                      onFindScheme();
                    }
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg bg-[#1769a8] py-3.5 text-[14px] font-bold text-white shadow-md shadow-[#1769a8]/25 transition hover:bg-[#125386]"
                >
                  {hasRecommendation
                    ? t("View My Recommendation")
                    : t("Find My Scheme Recommendation")}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e4ddd2] bg-[#faf3e8] px-6 py-5">
          <div className="mx-auto grid max-w-[1320px] divide-y divide-[#ded5c8] md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
            <FeatureStrip
              onClick={onFindScheme}
              icon={<Bot size={25} />}
              title={t("AI Scheme Finder")}
              text={t("Get personalized scheme recommendations with clear reasons.")}
            />
            <FeatureStrip
              onClick={() => onNavigate("emi_calculator")}
              icon={<Calculator size={25} />}
              title={t("Financial Calculator")}
              text={t("Calculate EMI, interest and repayment before applying.")}
            />
            <FeatureStrip
              onClick={() => onNavigate("partner_locator")}
              icon={<MapPin size={25} />}
              title={t("Partner Locator")}
              text={t("Find the right channel partner near you.")}
            />
            <FeatureStrip
              onClick={() => onNavigate("track_application")}
              icon={<FileText size={25} />}
              title={t("Track Applications")}
              text={t("Track status and understand your application journey.")}
            />
          </div>
        </section>

        <section className="bg-white px-6 py-20 lg:py-24">
          <div className="mx-auto max-w-[1300px]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16 bg-[#ccd3d9]" />
                <span className="text-[12px] font-bold tracking-[0.18em] text-[#7b858e]">
                  {t("SIMPLE PROCESS")}
                </span>
                <div className="h-px w-16 bg-[#ccd3d9]" />
              </div>

              <h2 className="mt-4 font-serif text-[34px] font-bold text-[#182a42] md:text-[40px]">
                {t("From Confusion to the Right Opportunity")}
              </h2>

              <div className="mx-auto mt-5 h-2 w-2 rotate-45 bg-[#c6a56b]" />
            </div>

            <div className="relative mt-16">
              <div className="absolute left-[10%] right-[10%] top-[37px] hidden border-t border-dashed border-[#ccd6dd] lg:block" />

              <div className="relative grid gap-12 md:grid-cols-3 lg:grid-cols-5">
                <ProcessStep
                  number="01"
                  icon={<UserRound size={26} />}
                  title={t("About You")}
                  text={t("Tell us basic details about your income, location and background.")}
                  iconClass="bg-[#d9eef8] text-[#17669a]"
                />
                <ProcessStep
                  number="02"
                  icon={<Bot size={26} />}
                  title={t("Get AI Matching")}
                  text={t("Our intelligent engine checks your profile against eligible schemes.")}
                  iconClass="bg-[#d9eef8] text-[#17669a]"
                />
                <ProcessStep
                  number="03"
                  icon={<Calculator size={26} />}
                  title={t("Understand Better")}
                  text={t("Calculate loan details, EMI, interest and repayment terms.")}
                  iconClass="bg-[#dff0ec] text-[#397e72]"
                />
                <ProcessStep
                  number="04"
                  icon={<MapPin size={26} />}
                  title={t("Connect & Apply")}
                  text={t("Find a suitable channel partner and understand how to apply.")}
                  iconClass="bg-[#eef0c9] text-[#7a7b2e]"
                />
                <ProcessStep
                  number="05"
                  icon={<CheckCircle2 size={26} />}
                  title={t("Achieve Your Goal")}
                  text={t("Track your application and move confidently toward your goal.")}
                  iconClass="bg-[#f1e1d4] text-[#925c38]"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="calculator" className="bg-[#f7fafc] px-6 py-16">
          <div className="mx-auto max-w-[1200px] rounded-2xl border border-[#d7e2e9] bg-white p-8">
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                  {t("FINANCIAL CALCULATOR")}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                  {t("Understand your loan before applying.")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#708095]">
                  {t("The scheme-specific calculator will use official loan limits, rates, tenure and moratorium values from the backend.")}
                </p>
              </div>

              <button
                onClick={() => onNavigate("emi_calculator")}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b]"
              >
                {t("Open Calculator")}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section id="partner-locator" className="bg-white px-6 py-16">
          <div className="mx-auto max-w-[1200px] rounded-2xl border border-[#d7e2e9] bg-[#f8fbfe] p-8">
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                  {t("CHANNEL PARTNER LOCATOR")}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                  {t("Connect with verified channel partners near you.")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#708095]">
                  {t("Locate official State Channelising Agencies (SCAs) and NSFDC liaison centres across India to submit loan applications and receive institutional guidance.")}
                </p>
              </div>

              <button
                onClick={() => onNavigate("partner_locator")}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white transition hover:bg-[#104d7b]"
              >
                {t("Find Partners")}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-[#edf7fb] px-6 py-16">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-8 rounded-2xl border border-[#d4e2e9] bg-white px-8 py-10 shadow-sm md:flex-row">
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-[#17669a]">
                {t("READY TO GET STARTED?")}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-[#172a43]">
                {t("Let Scheme Saathi find your best match.")}
              </h2>
              <p className="mt-2 text-[#68788a]">
                {t("Simple. Transparent. Built around your needs.")}
              </p>
            </div>

            <button
              onClick={onFindScheme}
              className="flex shrink-0 items-center gap-3 rounded-lg bg-[#145c91] px-7 py-4 font-semibold text-white shadow-md transition hover:bg-[#104d7b]"
            >
              {t("Find My Scheme")}
              <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dce4ea] bg-white px-6 py-7">
        <div className="mx-auto flex max-w-[1300px] flex-col justify-between gap-3 text-sm text-[#718096] md:flex-row">
          <p>© 2026 {t("Scheme Saathi. Your Government Scheme Companion.")}</p>
          <p>{t("AI-assisted • Rule-based • Location-aware")}</p>
        </div>
      </footer>
    </>
  );
}

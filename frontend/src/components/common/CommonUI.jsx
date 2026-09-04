import React from "react";
import {
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import {
  normalizeMatchScore,
  shouldExcludeForGender,
  calculateFallbackMatchScore,
} from "../../utils/schemeHelpers";
import { useTranslation } from "../../i18n";

export function SectionIntro({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
        {eyebrow}
      </p>
      <h2 className="mt-2 max-w-[700px] font-serif text-[32px] font-bold leading-tight text-[#172a43]">
        {title}
      </h2>
      <p className="mt-3 max-w-[700px] text-[14px] leading-6 text-[#6d7d8f]">
        {description}
      </p>
    </div>
  );
}

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  prefix,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#2c4058]">
        {label}
      </span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7a8999]">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={[
            "w-full rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 text-sm text-[#21364f] outline-none transition",
            "placeholder:text-[#a1acb6] focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10",
            prefix ? "pl-9" : "",
          ].join(" ")}
        />
      </div>
    </label>
  );
}

export function SelectField({
  label,
  helper,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select an option",
}) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-[13px] font-bold text-[#2c4058]">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full appearance-none rounded-lg border border-[#ced9e1] bg-white px-4 py-3.5 pr-10 text-sm text-[#21364f] outline-none transition focus:border-[#1769a8] focus:ring-4 focus:ring-[#1769a8]/10 ${
            disabled ? "cursor-not-allowed bg-[#f8fafc] text-[#94a3b8] opacity-75" : ""
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={17}
          className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
            disabled ? "text-[#cbd5e1]" : "text-[#718096]"
          }`}
        />
      </div>
      {helper && (
        <span className="mt-1.5 block text-[10px] text-[#8a97a4]">
          {helper}
        </span>
      )}
    </label>
  );
}

export function InfoBox({ icon, children }) {
  return (
    <div className="mt-8 flex gap-3 rounded-xl border border-[#d8e6ed] bg-[#f4fafc] p-4">
      <div className="mt-0.5 shrink-0 text-[#1769a8]">{icon}</div>
      <p className="text-xs leading-5 text-[#60758a]">{children}</p>
    </div>
  );
}

export function ReviewCard({ title, icon, rows }) {
  return (
    <div className="rounded-xl border border-[#dbe3e9] bg-[#fbfcfd] p-5">
      <div className="flex items-center gap-3 border-b border-[#e5eaee] pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5f2f8] text-[#1769a8]">
          {icon}
        </div>
        <h3 className="font-serif text-[17px] font-bold text-[#263a52]">
          {title}
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-5 text-xs"
          >
            <span className="text-[#7a8998]">{label}</span>
            <span className="max-w-[60%] text-right font-semibold text-[#2b4058]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrustItem({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-[#34475d]">
      <span className="text-[#17669a]">{icon}</span>
      {text}
    </div>
  );
}

export function MatchPoint({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#dcecf4] text-[#1769a8]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold leading-4 text-[#25374c]">{title}</p>
        <p className="text-[10px] leading-4 text-[#718196]">{subtitle}</p>
      </div>
      <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#3d9a87]" />
    </div>
  );
}

export function FeatureStrip({ icon, title, text, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-5 lg:px-7 ${
        onClick ? "cursor-pointer transition hover:bg-black/[0.03]" : ""
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#17669a] shadow-sm ring-1 ring-[#e5ded3]">
        {icon}
      </div>
      <div>
        <h3 className="font-serif text-[16px] font-bold text-[#1d2d42]">
          {title}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-[#657487]">{text}</p>
      </div>
    </div>
  );
}

export function ProcessStep({ number, icon, title, text, iconClass }) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div
        className={`flex h-[76px] w-[76px] items-center justify-center rounded-full shadow-sm ring-4 ring-white ${iconClass}`}
      >
        {icon}
      </div>
      <p className="mt-5 text-[11px] font-semibold text-[#8a9198]">{number}.</p>
      <h3 className="mt-1 font-serif text-[17px] font-bold text-[#25364a]">
        {title}
      </h3>
      <p className="mt-2 max-w-[210px] text-[12px] leading-5 text-[#718096]">
        {text}
      </p>
    </div>
  );
}

export function SchemeCard({
  code,
  title,
  description,
  rate,
  limit,
  loan,
  eligibility,
  documents,
  route,
  icon,
}) {
  const { t } = useTranslation();
  return (
    <div className="group rounded-2xl border border-[#d8e3e9] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f9] text-[#1769a8]">
          {icon}
        </div>
        <span className="rounded-full bg-[#f1f5f8] px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[#768797]">
          {code}
        </span>
      </div>

      <h3 className="mt-6 font-serif text-xl font-bold text-[#1d3048]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#718096]">{description}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#f7fafc] p-3">
          <p className="text-[10px] text-[#84919d]">{t("Interest Rate")}</p>
          <p className="mt-1 text-sm font-bold text-[#145c91]">{rate}</p>
        </div>
        <div className="rounded-lg bg-[#f7fafc] p-3">
          <p className="text-[10px] text-[#84919d]">{t("Maximum Loan")}</p>
          <p className="mt-1 text-sm font-bold text-[#263b52]">{loan}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#e1e8ed] p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8995a0]">
          {t("Financial Range")}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#60758a]">{limit}</p>
      </div>

      <div className="mt-4 rounded-xl bg-[#f8fbfd] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#1769a8]">
          {t("Eligibility")}
        </p>
        <div className="mt-3 space-y-2">
          {eligibility.map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 text-xs leading-5 text-[#60758a]"
            >
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#3d9a87]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#fbf7ee] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a7047]">
          {t("Indicative Documents")}
        </p>
        <div className="mt-3 space-y-2">
          {documents.map((document) => (
            <div
              key={document}
              className="flex items-start gap-2 text-xs leading-5 text-[#756447]"
            >
              <FileText size={14} className="mt-0.5 shrink-0" />
              <span>{document}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-[#8a7b62]">
          {t("Final document requirements may vary by the concerned channelizing / lending agency.")}
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs font-semibold text-[#1769a8]">
        <MapPin size={15} className="mt-0.5 shrink-0" />
        <span>{t("Application route:")} {route}</span>
      </div>
    </div>
  );
}

export function ReasonRow({ text }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-5 text-[#60758a]">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#3d9a87]" />
      <span>{text}</span>
    </div>
  );
}

export function EligibleSchemeCard({
  scheme,
  formData,
  featured = false,
  secondary = false,
}) {
  const { t } = useTranslation();
  const schemeMatchScore = shouldExcludeForGender(scheme, formData)
    ? 0
    : normalizeMatchScore(scheme?.match_score) ??
      calculateFallbackMatchScore(scheme, formData);

  const reasons = Array.isArray(scheme?.reasons) ? scheme.reasons : [];

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-6 shadow-sm",
        featured ? "border-2 border-[#35536a]" : "border-[#d8e3e9]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e7f3f8] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#1769a8]">
              {scheme.scheme_id}
            </span>
            <span
              className={[
                "rounded-full px-3 py-1 text-[10px] font-bold",
                secondary
                  ? "bg-[#f1eef9] text-[#675685]"
                  : "bg-[#edf6ec] text-[#47744a]",
              ].join(" ")}
            >
              {secondary ? t("CONNECTED SUPPORT") : t("ELIGIBLE")}
            </span>
            <span className="rounded-full bg-[#eaf5fa] px-3 py-1 text-[10px] font-bold text-[#145c91]">
              {schemeMatchScore}{t("% MATCH")}
            </span>
          </div>

          <h3 className="mt-4 font-serif text-xl font-bold text-[#20344b]">
            {scheme.scheme_name}
          </h3>
        </div>

        <CheckCircle2 size={21} className="shrink-0 text-[#3d9a87]" />
      </div>

      <div className="mt-5 rounded-xl bg-[#f7fafc] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8995a0]">
          {t("Why it matched")}
        </p>
        {reasons.length === 0 ? (
          <p className="mt-3 text-xs text-[#718096]">
            {t("Eligibility criteria were satisfied according to the backend rule engine.")}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {reasons.map((reason) => (
              <ReasonRow key={reason} text={reason} />
            ))}
          </div>
        )}
      </div>

      {scheme.gender_status?.message && (
        <div className="mt-4 rounded-lg bg-[#fbf7ee] p-3 text-xs leading-5 text-[#756447]">
          {scheme.gender_status.message}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[#d4dfe6] bg-white p-7 text-center">
      <AlertCircle size={24} className="mx-auto text-[#8b98a5]" />
      <h3 className="mt-3 font-serif text-lg font-bold text-[#3a4c60]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#7b8998]">{text}</p>
    </div>
  );
}

export function AuthBenefit({ icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1769a8] shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-[#29445d]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6d7f92]">{text}</p>
      </div>
    </div>
  );
}

export function MatchScoreDisplay({ score }) {
  const normalizedScore = normalizeMatchScore(score);
  return (
    <div className="mt-1 flex h-[58px] items-baseline justify-center">
      <span className="font-serif text-[54px] font-bold leading-none text-[#155985]">
        {normalizedScore !== null ? normalizedScore : "—"}
      </span>
      {normalizedScore !== null && (
        <span className="ml-0.5 font-serif text-[23px] font-bold leading-none text-[#155985]">
          %
        </span>
      )}
    </div>
  );
}

export function MatchScoreRing({ score }) {
  const normalizedScore = normalizeMatchScore(score);
  const hasScore = normalizedScore !== null;
  const ringStyle = hasScore
    ? {
        background: `conic-gradient(#155985 ${
          normalizedScore * 3.6
        }deg, #d8e4eb 0deg)`,
      }
    : { background: "#d8e4eb" };

  return (
    <div
      className="relative mt-3 flex h-[78px] w-[78px] items-center justify-center rounded-full p-[7px]"
      style={ringStyle}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#fffef9]">
        <Sparkles size={20} className="text-[#155985]" />
      </div>
    </div>
  );
}

export function FeaturePageShell({ title, subtitle, onBack, actions, children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#10213f]">
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-semibold text-[#38506a] hover:text-[#1769a8] transition"
            >
              <ArrowLeft size={18} /> {t("Back to Home")}
            </button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-[#172a43]">{title}</h1>
              <p className="mt-1 text-sm text-[#718096]">{subtitle}</p>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

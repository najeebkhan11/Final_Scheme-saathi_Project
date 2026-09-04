import React, { useState, useMemo } from "react";
import {
  Printer,
  MapPin,
  Sparkles,
  CheckCircle2,
  Info,
  Search,
  FileText,
  Check,
  Building2,
  AlertCircle,
  ShieldCheck,
  Calculator,
  Bot,
} from "lucide-react";
import { FeaturePageShell } from "./common/CommonUI";
import { useTranslation } from "../i18n";
import {
  UNIVERSAL_DOCUMENTS,
  SCHEME_SPECIFIC_DOCUMENTS,
} from "../data/schemesConstants";
import { apiCache } from "../services/apiCache";

export default function DocumentsPage({
  onBack,
  onFindScheme,
  lastSchemeResults: propResults,
  onNavigate,
}) {
  const { t } = useTranslation();

  // Fallback to cached recommendations if prop is not passed
  const cachedRecs = useMemo(() => {
    return apiCache.getSavedRecommendations();
  }, []);

  const results = propResults || cachedRecs?.results || null;

  const eligibleSchemes = useMemo(() => {
    return [
      ...(results?.primary?.eligible || []),
      ...(results?.secondary?.eligible || []),
    ];
  }, [results]);

  // Pick first eligible scheme ID if available
  const firstEligibleId =
    eligibleSchemes[0]?.scheme_id ||
    eligibleSchemes[0]?.id ||
    eligibleSchemes[0]?.code ||
    null;

  const [selectedSchemeId, setSelectedSchemeId] = useState(
    firstEligibleId && SCHEME_SPECIFIC_DOCUMENTS[firstEligibleId]
      ? firstEligibleId
      : "ALL"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [checkedDocs, setCheckedDocs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("scheme_saathi_doc_checklist") || "{}");
    } catch {
      return {};
    }
  });

  // Toggle document checked status and persist in localStorage
  const toggleDoc = (docId) => {
    setCheckedDocs((prev) => {
      const updated = { ...prev, [docId]: !prev[docId] };
      try {
        localStorage.setItem("scheme_saathi_doc_checklist", JSON.stringify(updated));
      } catch {
        // ignore storage error
      }
      return updated;
    });
  };

  // Mark all ready or reset
  const handleMarkAll = (docsList, markReady) => {
    setCheckedDocs((prev) => {
      const updated = { ...prev };
      docsList.forEach((d) => {
        updated[d.id] = markReady;
      });
      try {
        localStorage.setItem("scheme_saathi_doc_checklist", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Compile active document list based on scheme selection
  const activeDocs = useMemo(() => {
    if (selectedSchemeId === "ALL") {
      return UNIVERSAL_DOCUMENTS;
    }
    const specific = SCHEME_SPECIFIC_DOCUMENTS[selectedSchemeId];
    if (!specific) {
      return UNIVERSAL_DOCUMENTS;
    }
    return [...UNIVERSAL_DOCUMENTS, ...specific.docs];
  }, [selectedSchemeId]);

  // Filter documents by category and search term
  const filteredDocs = useMemo(() => {
    return activeDocs.filter((doc) => {
      const matchesCategory =
        activeCategory === "all" || doc.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.authority.toLowerCase().includes(q) ||
        doc.whereToGet.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeDocs, activeCategory, searchQuery]);

  // Calculate readiness score
  const totalCount = activeDocs.length;
  const readyCount = activeDocs.filter((d) => checkedDocs[d.id]).length;
  const readinessPercent =
    totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <FeaturePageShell
      title={t("Document Center & Checklist")}
      subtitle={t("Verify, prepare, and check off commonly required documents before approaching an authorized Channel Partner.")}
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-[#cfdbe3] bg-white px-3.5 py-2 text-xs font-semibold text-[#29445d] shadow-sm transition hover:bg-[#f2f6fa]"
            title="Print or save as PDF checklist"
          >
            <Printer size={15} className="text-[#1769a8]" />
            <span className="hidden sm:inline">{t("Print Checklist")}</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate("partner_locator")}
              className="flex items-center gap-1.5 rounded-lg bg-[#145c91] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#104d7b]"
            >
              <MapPin size={15} />
              <span className="hidden sm:inline">{t("Find Channel Partner")}</span>
            </button>
          )}
        </div>
      }
    >
      {/* 1. MATCHED SCHEMES NOTIFICATION / DISCOVERY BANNER */}
      {eligibleSchemes.length > 0 ? (
        <div className="mb-8 overflow-hidden rounded-2xl border border-[#b8ddf4] bg-gradient-to-r from-[#eef8fe] via-[#f5fbff] to-[#edf6fc] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#145c91]/10 px-3 py-1 text-xs font-bold tracking-wide text-[#145c91]">
                <Sparkles size={14} />
                {t("MATCHED TO YOUR PROFILE")}
              </div>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#123153]">
                {eligibleSchemes[0]?.scheme_name || eligibleSchemes[0]?.name}
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-[#526a84]">
                {t("Based on your submitted details, this scheme is your top match. Click below to load its dedicated checklist with specialized project and subsidy requirements.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {eligibleSchemes.slice(0, 3).map((s, idx) => {
                const sId = s.scheme_id || s.id || s.code;
                const isSelected = selectedSchemeId === sId;
                return (
                  <button
                    key={sId || idx}
                    onClick={() => {
                      if (sId && SCHEME_SPECIFIC_DOCUMENTS[sId]) {
                        setSelectedSchemeId(sId);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                      isSelected
                        ? "border-[#145c91] bg-[#145c91] text-white shadow-md shadow-[#145c91]/20"
                        : "border-[#b8ddf4] bg-white text-[#174871] hover:bg-[#f0f7fd]"
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    {s.short_name || s.scheme_name || s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-2xl border border-[#d6e5ef] bg-white p-5 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#eef7fd] p-2.5 text-[#1769a8]">
                <Info size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#172a43]">
                  {t("Browse universal documents or find your matched scheme")}
                </h4>
                <p className="mt-0.5 text-xs text-[#63778d]">
                  {t("Below is the complete checklist of core documents required across all government credit and subsidy schemes. Complete your profile anytime to see scheme-specific forms.")}
                </p>
              </div>
            </div>

            <button
              onClick={onFindScheme}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#145c91] px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#104d7b]"
            >
              <Sparkles size={14} />
              {t("Find My Schemes")}
            </button>
          </div>
        </div>
      )}

      {/* 2. READINESS PROGRESS BAR & SCHEME SELECTOR */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {/* Readiness Meter */}
        <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#738596]">
              {t("Your Document Readiness")}
            </span>
            <span className="rounded-full bg-[#edf5fa] px-2.5 py-0.5 text-xs font-extrabold text-[#145c91]">
              {readinessPercent}%
            </span>
          </div>

          <div className="mt-3 text-2xl font-serif font-bold text-[#172a43]">
            {readyCount}{" "}
            <span className="text-sm font-sans font-normal text-[#738596]">
              {t("of")} {totalCount} {t("ready")}
            </span>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#e8eef3]">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                readinessPercent === 100
                  ? "bg-[#2ea879]"
                  : readinessPercent >= 50
                  ? "bg-[#1769a8]"
                  : "bg-[#e59b23]"
              }`}
              style={{ width: `${readinessPercent}%` }}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-[#5e7185]">
            {readinessPercent === 100 ? (
              <span className="flex items-center gap-1.5 font-semibold text-[#20835c]">
                <CheckCircle2 size={14} />{" "}
                {t("All documents ready! You are prepared to visit your Channel Partner.")}
              </span>
            ) : readinessPercent >= 50 ? (
              <span className="text-[#1769a8]">
                {t("Good progress! Collect the remaining")} {totalCount - readyCount}{" "}
                {t("documents to prevent processing delays.")}
              </span>
            ) : (
              <span className="text-[#a86e10]">
                {t("Check off documents as you gather them to track your application readiness.")}
              </span>
            )}
          </p>

          <div className="mt-4 flex items-center gap-2 border-t border-[#eef3f7] pt-3 text-xs">
            <button
              onClick={() => handleMarkAll(activeDocs, true)}
              className="text-[#1769a8] hover:underline font-semibold"
            >
              {t("Select All")}
            </button>
            <span className="text-[#cfdbe3]">|</span>
            <button
              onClick={() => handleMarkAll(activeDocs, false)}
              className="text-[#718294] hover:underline"
            >
              {t("Reset Checklist")}
            </button>
          </div>
        </div>

        {/* Scheme Selector Tabs */}
        <div className="rounded-2xl border border-[#d5e1e8] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#738596]">
                {t("Select Scheme Checklist")}
              </p>
              <h3 className="mt-1 font-serif text-lg font-bold text-[#172a43]">
                {selectedSchemeId === "ALL"
                  ? t("Universal Core Documents (All Schemes)")
                  : SCHEME_SPECIFIC_DOCUMENTS[selectedSchemeId]?.name || t("Selected Scheme")}
              </h3>
            </div>
            {selectedSchemeId !== "ALL" && (
              <span className="inline-flex items-center rounded-lg bg-[#eef7fd] px-3 py-1 text-xs font-bold text-[#145c91]">
                {t("Max Limit")}: {SCHEME_SPECIFIC_DOCUMENTS[selectedSchemeId]?.maxLimit}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSchemeId("ALL")}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                selectedSchemeId === "ALL"
                  ? "border-[#145c91] bg-[#145c91] text-white shadow-sm"
                  : "border-[#d5e1e8] bg-[#f8fbfe] text-[#334b65] hover:bg-[#eef5fa]"
              }`}
            >
              {t("All Standard KYC")} ({UNIVERSAL_DOCUMENTS.length})
            </button>

            {Object.keys(SCHEME_SPECIFIC_DOCUMENTS).map((key) => {
              const item = SCHEME_SPECIFIC_DOCUMENTS[key];
              const isSelected = selectedSchemeId === key;
              const isEligible = eligibleSchemes.some(
                (es) => (es.scheme_id || es.id || es.code) === key
              );
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSchemeId(key)}
                  className={`relative flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    isSelected
                      ? "border-[#145c91] bg-[#145c91] text-white shadow-sm"
                      : "border-[#d5e1e8] bg-[#f8fbfe] text-[#334b65] hover:bg-[#eef5fa]"
                  }`}
                >
                  {isEligible && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#20bf6b]" />
                  )}
                  {item.shortCode}
                  <span
                    className={`ml-1 text-[10px] ${
                      isSelected ? "text-white/80" : "text-[#7b90a4]"
                    }`}
                  >
                    ({UNIVERSAL_DOCUMENTS.length + item.docs.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. SEARCH & CATEGORY FILTERS */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b9caa]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search document by name, issuer, or rule...")}
            className="w-full rounded-xl border border-[#cfdbe3] bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-[#1c2e42] outline-none transition placeholder:text-[#9bb0c1] focus:border-[#1769a8] focus:ring-2 focus:ring-[#1769a8]/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8296a8] hover:text-[#233547]"
            >
              {t("Clear")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Types" },
            { id: "kyc", label: "KYC & Identity" },
            { id: "income_caste", label: "Income & Caste" },
            { id: "banking", label: "Banking & Finance" },
            { id: "business_education", label: "Project & Education" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat.id
                  ? "bg-[#1769a8] text-white shadow-sm"
                  : "bg-white text-[#52667b] border border-[#d6e2eb] hover:bg-[#f5f9fc]"
              }`}
            >
              {t(cat.label)}
            </button>
          ))}
        </div>
      </div>

      {/* 4. DOCUMENT CHECKLIST CARDS */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cfdbe3] bg-white p-12 text-center">
          <FileText size={36} className="mx-auto text-[#9fb3c5]" />
          <h4 className="mt-3 font-serif text-lg font-bold text-[#20344b]">
            {t("No matching documents found")}
          </h4>
          <p className="mt-1 text-xs text-[#6e8296]">
            {t("Try adjusting your search keywords or filter category.")}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("all");
            }}
            className="mt-4 rounded-lg bg-[#145c91] px-4 py-2 text-xs font-semibold text-white"
          >
            {t("Clear Filters")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDocs.map((doc, idx) => {
            const isChecked = !!checkedDocs[doc.id];
            return (
              <div
                key={doc.id || idx}
                onClick={() => toggleDoc(doc.id)}
                className={`group cursor-pointer rounded-2xl border p-5 transition duration-150 ${
                  isChecked
                    ? "border-[#a5d6be] bg-[#f4faf7] shadow-sm"
                    : "border-[#d8e3eb] bg-white hover:border-[#b9cddb] hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Interactive Checkbox */}
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                      isChecked
                        ? "border-[#20835c] bg-[#20835c] text-white"
                        : "border-[#b8c9d6] bg-white group-hover:border-[#1769a8]"
                    }`}
                  >
                    {isChecked ? (
                      <Check size={16} strokeWidth={3} />
                    ) : (
                      <div className="h-2 w-2 rounded-sm bg-transparent group-hover:bg-[#d0dfec]" />
                    )}
                  </div>

                  {/* Document Details */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-base font-bold transition ${
                          isChecked
                            ? "text-[#1b5e3f] line-through decoration-2"
                            : "text-[#182d47]"
                        }`}
                      >
                        {doc.name}
                      </h4>

                      {doc.mandatory ? (
                        <span className="rounded-full bg-[#fee8e8] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b42828]">
                          {t("Mandatory")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#fef5e7] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#a0680f]">
                          {t("Conditional / As Applicable")}
                        </span>
                      )}

                      <span className="rounded-full bg-[#edf4fa] px-2.5 py-0.5 text-[10px] font-bold text-[#145c91]">
                        {doc.category === "kyc"
                          ? t("Identity & KYC")
                          : doc.category === "income_caste"
                          ? t("Income & Community")
                          : doc.category === "banking"
                          ? t("Bank / DBT")
                          : t("Project & Purpose")}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs leading-5 text-[#4a6075]">
                      {doc.description}
                    </p>

                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5 border border-[#e1e9ef]">
                        <Building2 size={15} className="shrink-0 text-[#1769a8] mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8294a5]">
                            {t("Issuing Authority")}
                          </p>
                          <p className="font-semibold text-[#25394e]">
                            {doc.authority}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5 border border-[#e1e9ef]">
                        <MapPin size={15} className="shrink-0 text-[#1769a8] mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8294a5]">
                            {t("Where to Obtain")}
                          </p>
                          <p className="font-semibold text-[#25394e]">
                            {doc.whereToGet}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5 border border-[#e1e9ef] sm:col-span-2 lg:col-span-1">
                        <AlertCircle size={15} className="shrink-0 text-[#d97706] mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8294a5]">
                            {t("Key Guideline / Validity")}
                          </p>
                          <p className="text-[#3c5267]">
                            {doc.guidelines}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. ESSENTIAL PREPARATION GUIDELINES */}
      <div className="mt-10 rounded-2xl border border-[#d2e0ea] bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#145c91]" />
          <h3 className="font-serif text-lg font-bold text-[#14283f]">
            {t("Crucial Guidelines Before Visiting Your Channel Partner")}
          </h3>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-xl border border-[#e4ecf2] bg-[#fbfdfe] p-4">
            <span className="font-bold text-[#145c91]">{t("1. Self-Attestation")}</span>
            <p className="mt-1 leading-5 text-[#5b6f82]">
              {t("Sign and write the current date in blue/black ink on photocopies of each submitted document.")}
            </p>
          </div>

          <div className="rounded-xl border border-[#e4ecf2] bg-[#fbfdfe] p-4">
            <span className="font-bold text-[#145c91]">{t("2. Carry Originals")}</span>
            <p className="mt-1 leading-5 text-[#5b6f82]">
              {t("Always bring original certificates for spot verification by the District Nodal Officer or Bank Manager.")}
            </p>
          </div>

          <div className="rounded-xl border border-[#e4ecf2] bg-[#fbfdfe] p-4">
            <span className="font-bold text-[#145c91]">{t("3. Active Mobile Number")}</span>
            <p className="mt-1 leading-5 text-[#5b6f82]">
              {t("Ensure the mobile phone linked to your Aadhaar is working and charged for DigiLocker OTP authentication.")}
            </p>
          </div>

          <div className="rounded-xl border border-[#e4ecf2] bg-[#fbfdfe] p-4">
            <span className="font-bold text-[#145c91]">{t("4. DBT Bank Seeding")}</span>
            <p className="mt-1 leading-5 text-[#5b6f82]">
              {t("Confirm at your branch that your bank account is active and mapped with NPCI for Direct Benefit Transfer.")}
            </p>
          </div>
        </div>
      </div>

      {/* 6. BOTTOM ACTION BAR */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#cfe0ec] bg-[#f2f7fb] p-6">
        <div>
          <h4 className="font-serif text-base font-bold text-[#12283e]">
            {t("Documents ready? Take the next step")}
          </h4>
          <p className="text-xs text-[#5f7488]">
            {t("Locate your nearest authorized State Channelizing Agency or bank branch to submit your physical file.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate("partner_locator")}
              className="flex items-center gap-2 rounded-xl bg-[#145c91] px-5 py-3 text-xs font-bold text-white shadow-md shadow-[#145c91]/20 transition hover:bg-[#104d7b]"
            >
              <MapPin size={15} />
              {t("Locate Authorized Partner")}
            </button>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate("emi_calculator")}
              className="flex items-center gap-2 rounded-xl border border-[#cfdbe3] bg-white px-4 py-3 text-xs font-bold text-[#28425b] shadow-sm transition hover:bg-[#f8fafc]"
            >
              <Calculator size={15} />
              {t("Calculate Loan & EMI")}
            </button>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate("ai_assistant")}
              className="flex items-center gap-2 rounded-xl border border-[#cfdbe3] bg-white px-4 py-3 text-xs font-bold text-[#28425b] shadow-sm transition hover:bg-[#f8fafc]"
            >
              <Bot size={15} />
              {t("Ask AI Assistant")}
            </button>
          )}
        </div>
      </div>
    </FeaturePageShell>
  );
}

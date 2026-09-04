import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Sparkles,
  Compass,
  Search,
  RotateCcw,
  MapPin,
  CheckCircle2,
  Globe2,
  ShieldCheck,
  Phone,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import AppNavbar from "./AppNavbar";
import { SelectField } from "./common/CommonUI";
import { useTranslation } from "../i18n";
import { API_BASE_URL } from "../config/api";
import { apiCache } from "../services/apiCache";
import { PARTNER_LOAN_CATEGORIES, PARTNER_SCHEMES } from "../data/schemesConstants";
import { formatValue } from "../utils/schemeHelpers";

export default function PartnerLocator({
  onBack,
  onNavigate,
  isLoggedIn,
  currentUser,
  onLogin,
  onLogout,
  initialState = "",
  initialDistrict = "",
  initialSchemeId = "",
  hideNavbar = false,
}) {
  const { t } = useTranslation();
  const [state, setState] = useState(initialState || "");
  const [district, setDistrict] = useState(initialDistrict || "");
  const [schemeId, setSchemeId] = useState(initialSchemeId || "");
  const [loanCategory, setLoanCategory] = useState("");
  const [partners, setPartners] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [aiRanked, setAiRanked] = useState(false);
  const [statesList, setStatesList] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [coords, setCoords] = useState(null);

  const fetchStates = async () => {
    const cached = apiCache.getStates();
    if (cached && cached.length > 0) {
      setStatesList(cached);
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/locations/states`);
      if (!response.ok) throw new Error("Failed to fetch states");
      const data = await response.json();
      const list = data.states || [];
      apiCache.setStates(list);
      setStatesList(list);
    } catch {
      setStatesList([]);
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchDistricts = async (selectedState) => {
    if (!selectedState) return;
    const cached = apiCache.getDistricts(selectedState);
    if (cached && cached.length > 0) {
      setDistrictsList(cached);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/locations/states/${encodeURIComponent(selectedState)}/districts`
      );
      if (!response.ok) throw new Error("Failed to fetch districts");
      const data = await response.json();
      const list = data.districts || [];
      apiCache.setDistricts(selectedState, list);
      setDistrictsList(list);
    } catch {
      setDistrictsList([]);
    }
  };

  const searchPartners = async (overrides = {}) => {
    setError("");
    setMessage("");

    const targetState = overrides.stateName !== undefined ? overrides.stateName : state;
    const targetDistrict = overrides.districtName !== undefined ? overrides.districtName : district;
    const targetScheme = overrides.scheme !== undefined ? overrides.scheme : schemeId;
    const targetCategory = overrides.category !== undefined ? overrides.category : loanCategory;
    const targetCoords = overrides.coordinates !== undefined ? overrides.coordinates : coords;

    if (!targetState && !targetCoords) {
      setError(t("Please select a state or use GPS location detection."));
      return;
    }

    const queryKey = `${targetState || ""}_${targetDistrict || ""}_${targetScheme || ""}_${targetCategory || ""}_${targetCoords?.latitude || ""}_${targetCoords?.longitude || ""}`;
    const cached = apiCache.getPartners(queryKey);
    if (cached) {
      setPartners(cached.partners || []);
      setSearched(true);
      setMessage(cached.message || "");
      setAiRanked(Boolean(cached.ai_ranked));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        state: targetState || undefined,
        district: targetDistrict || undefined,
        scheme_id: targetScheme || undefined,
        loan_category: targetCategory || undefined,
        latitude: targetCoords?.latitude,
        longitude: targetCoords?.longitude,
        max_results: 10,
        ai_rank: true,
      };

      const response = await fetch(`${API_BASE_URL}/api/partners/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Partner search failed.");
      }

      const data = await response.json();
      apiCache.setPartners(queryKey, data);
      setPartners(data.partners || []);
      setSearched(true);
      setMessage(data.message || "");
      setAiRanked(Boolean(data.ai_ranked));
    } catch {
      setError(t("Unable to search channel partners. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
    if (initialState) {
      searchPartners({
        stateName: initialState,
        districtName: initialDistrict,
        scheme: initialSchemeId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state) {
      fetchDistricts(state);
    } else {
      setDistrictsList((prev) => (prev.length > 0 ? [] : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleStateChange = (value) => {
    setState(value);
    setDistrict("");
    setGpsActive(false);
    setCoords(null);
  };

  const handleDetectLocation = () => {
    setError("");
    const cached = apiCache.getCachedGps();
    if (cached) {
      setCoords(cached);
      setGpsActive(true);
      searchPartners({ coordinates: cached });
      return;
    }

    if (!navigator.geolocation) {
      setError(t("Geolocation is not supported by your browser."));
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detected = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        apiCache.setCachedGps(detected);
        setCoords(detected);
        setGpsActive(true);
        setGpsLoading(false);
        searchPartners({ coordinates: detected });
      },
      () => {
        setGpsLoading(false);
        setError(
          t("Location access was denied or unavailable. Please select your State and District manually from the dropdowns.")
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleReset = () => {
    setState("");
    setDistrict("");
    setSchemeId("");
    setLoanCategory("");
    setPartners([]);
    setSearched(false);
    setError("");
    setMessage("");
    setGpsActive(false);
    setCoords(null);
  };

  const renderMatchTypeBadge = (matchType, distanceKm) => {
    if (matchType === "exact_district") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#edf7ed] px-3 py-1 text-[11px] font-bold text-[#1e4620]">
          <CheckCircle2 size={13} className="text-[#2e7d32]" />
          {t("In Your District")}
        </span>
      );
    }
    if (matchType === "exact_state") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3fa] px-3 py-1 text-[11px] font-bold text-[#135985]">
          <MapPin size={13} className="text-[#1769a8]" />
          {t("State Channel Partner")}
        </span>
      );
    }
    if (matchType === "gps_nearby") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fef7e6] px-3 py-1 text-[11px] font-bold text-[#8f5800]">
          <Compass size={13} className="text-[#c67d0a]" />
          {t("Nearby Partner")} {distanceKm != null ? `(${distanceKm} km)` : ""}
        </span>
      );
    }
    if (matchType === "official_national_route") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f4ebfa] px-3 py-1 text-[11px] font-bold text-[#5c2483]">
          <Globe2 size={13} className="text-[#7e34b0]" />
          {t("Official National Route")}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f5f9fc] text-[#10213f]">
      {!hideNavbar && (
        <AppNavbar
          activeView="partner_locator"
          onNavigate={onNavigate || (() => {})}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      )}

      <div className="border-b border-[#e1eaf0] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between text-xs font-semibold text-[#576b82]">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition hover:text-[#1769a8]"
          >
            <ArrowLeft size={16} />
            <span>{t("Back to Home")}</span>
          </button>
          <span className="text-[#8495a7]">
            {t("Home")} &gt; <strong className="text-[#172a43]">{t("Partner Locator")}</strong>
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-6 py-10 lg:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cbe0ee] bg-[#eaf4fb] px-3.5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-[#145c91]">
            <Sparkles size={14} className="text-[#c6a56b]" />
            {t("CHANNEL PARTNER LOCATOR")}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#172a43] sm:text-4xl md:text-5xl">
            {t("Find a verified channel partner near you.")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[#60748b]">
            {t("Search by location, loan category, or government scheme to connect with verified State Channelising Agencies (SCAs), NSFDC Liaison Centres, and authorized application routes.")}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-[#d6e3ec] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 pb-6 border-b border-[#e9f0f5] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#1a2e46]">
                {t("Search Filters")}
              </h2>
              <p className="text-xs text-[#718599]">
                {t("Select your location or use GPS to find the closest verified partner.")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={gpsLoading || loading}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
                gpsActive
                  ? "border-[#1769a8] bg-[#eef7fd] text-[#145c91]"
                  : "border-[#cfdbe4] bg-white text-[#2f435a] hover:bg-[#f6f9fc]"
              }`}
            >
              {gpsLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin text-[#145c91]" />
                  <span>{t("Detecting GPS Location...")}</span>
                </>
              ) : (
                <>
                  <Compass size={15} className="text-[#1769a8]" />
                  <span>{gpsActive ? t("GPS Active") : t("Detect My Current Location")}</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <SelectField
                label={t("State")}
                value={state}
                onChange={handleStateChange}
                placeholder={t("Select State")}
                options={
                  locationLoading
                    ? []
                    : statesList.map((s) => ({
                        value: s.name,
                        label: s.name,
                      }))
                }
                helper={locationLoading ? t("Loading states...") : undefined}
              />
            </div>

            <div>
              <SelectField
                label={t("District (Optional)")}
                value={district}
                onChange={setDistrict}
                disabled={!state}
                placeholder={!state ? t("Select State first") : t("All Districts")}
                options={
                  !state
                    ? []
                    : districtsList.map((d) => ({
                        value: d,
                        label: d,
                      }))
                }
                helper={!state ? t("Select state first") : undefined}
              />
            </div>

            <div>
              <SelectField
                label={t("Loan Category")}
                value={loanCategory}
                onChange={setLoanCategory}
                placeholder={t("All Categories")}
                options={PARTNER_LOAN_CATEGORIES.map((c) => ({
                  value: c.value,
                  label: t(c.label),
                }))}
              />
            </div>

            <div>
              <SelectField
                label={t("Target Scheme")}
                value={schemeId}
                onChange={setSchemeId}
                placeholder={t("All Schemes")}
                options={PARTNER_SCHEMES.map((s) => ({
                  value: s.value,
                  label: t(s.label),
                }))}
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              <span className="leading-5 font-medium">{error}</span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => searchPartners()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-[#104d7b] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>{t("Searching Partners...")}</span>
                </>
              ) : (
                <>
                  <Search size={17} />
                  <span>{t("Search Channel Partners")}</span>
                </>
              )}
            </button>

            {(state || district || schemeId || loanCategory || searched || gpsActive) && (
              <button
                onClick={handleReset}
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-[#d2dde5] bg-white px-4 py-3 text-xs font-semibold text-[#506377] transition hover:bg-[#f6f9fb]"
              >
                <RotateCcw size={14} />
                <span>{t("Reset Filters")}</span>
              </button>
            )}
          </div>
        </div>

        {searched && (
          <div className="mt-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#172a43]">
                  {t("Search Results")}
                </h3>
                {message && (
                  <p className="mt-1 text-sm text-[#5d7186]">{message}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {aiRanked && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe2f7] bg-[#eaf5fc] px-3.5 py-1 text-xs font-bold text-[#145c91]">
                    <Sparkles size={14} className="text-[#c6a56b]" />
                    {t("AI Ranked Match")}
                  </span>
                )}
                <span className="rounded-full bg-white border border-[#d6e3ec] px-3.5 py-1 text-xs font-bold text-[#35485d]">
                  {t("Total Found")}: {partners.length}
                </span>
              </div>
            </div>

            {partners.length === 0 ? (
              <div className="rounded-2xl border border-[#d7e2e9] bg-white p-12 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f6fa] text-[#8698aa]">
                  <MapPin size={32} />
                </div>
                <h4 className="mt-4 font-serif text-xl font-bold text-[#23384f]">
                  {t("No matching partner found")}
                </h4>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#6c7f93]">
                  {t('No partner was found for your specific filter combination. Try selecting "All Categories", removing the district filter, or viewing the official national portal.')}
                </p>
                <button
                  onClick={handleReset}
                  className="mt-5 rounded-lg bg-[#145c91] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#104d7b]"
                >
                  {t("Clear Filters & View All")}
                </button>
              </div>
            ) : (
              <div className="grid gap-5">
                {partners.map((partner) => (
                  <div
                    key={partner.partner_id}
                    className="overflow-hidden rounded-2xl border border-[#d7e3eb] bg-white p-6 shadow-sm transition hover:border-[#1769a8]/40 hover:shadow-md md:p-7"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#e8f3fa] px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-[#145c91]">
                          {partner.type}
                        </span>

                        {partner.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf6ec] px-3 py-1 text-[11px] font-bold text-[#3d7041]">
                            <ShieldCheck size={13} className="text-[#438848]" />
                            {t("VERIFIED")}
                          </span>
                        )}

                        {renderMatchTypeBadge(partner.match_type, partner.distance_km)}
                      </div>

                      {partner.distance_km != null && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#145c91]">
                          <Compass size={14} />
                          {partner.distance_km} km {t("away")}
                        </span>
                      )}
                    </div>

                    {partner.ai_score != null && partner.ai_score > 0 && (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#cbe4f7] bg-[#f0f7fd] p-3.5 text-xs text-[#0f4d7a]">
                        <Sparkles size={16} className="mt-0.5 shrink-0 text-[#1769a8]" />
                        <div>
                          <span className="font-bold text-[#145c91]">
                            {t("AI Match Score")}: {partner.ai_score}%
                          </span>
                          {partner.ai_reason && (
                            <p className="mt-0.5 leading-5 text-[#41607c]">
                              {partner.ai_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-serif text-xl font-bold text-[#182d45] sm:text-2xl">
                          {partner.name}
                        </h3>

                        {partner.address && (
                          <p className="mt-2.5 flex items-start gap-2 text-sm text-[#5d7186]">
                            <MapPin size={16} className="mt-0.5 shrink-0 text-[#1769a8]" />
                            <span className="leading-6">{partner.address}</span>
                          </p>
                        )}

                        {partner.contact && (
                          <p className="mt-2 flex items-center gap-2 text-sm text-[#5d7186]">
                            <Phone size={15} className="shrink-0 text-[#456b50]" />
                            <span>{t("Contact")}: <strong className="font-semibold text-[#1e344e]">{partner.contact}</strong></span>
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                        {partner.max_loan_amount_handled && (
                          <div className="rounded-xl bg-[#f5f8fa] border border-[#e4ecf1] px-4 py-2.5 text-left lg:text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8292a1]">
                              {t("Max Loan Handled")}
                            </p>
                            <p className="mt-0.5 font-serif text-base font-bold text-[#172a43]">
                              ₹{Number(partner.max_loan_amount_handled).toLocaleString("en-IN")}
                            </p>
                          </div>
                        )}

                        {(partner.official_url || partner.website) && (
                          <a
                            href={partner.official_url || partner.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#145c91] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f4873]"
                          >
                            <span>{t("Official Portal")}</span>
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>

                    {(partner.supported_loan_categories?.length > 0 || partner.supported_schemes?.length > 0) && (
                      <div className="mt-5 border-t border-[#eaf0f5] pt-4">
                        {partner.supported_loan_categories?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-[#7d8f9f] mr-1">
                              {t("Supported Categories")}:
                            </span>
                            {partner.supported_loan_categories.map((cat) => (
                              <span
                                key={cat}
                                className="rounded-md border border-[#d9e5ed] bg-[#f8fafc] px-2 py-0.5 text-[10px] font-semibold text-[#485d73]"
                              >
                                {formatValue(cat)}
                              </span>
                            ))}
                          </div>
                        )}

                        {partner.supported_schemes?.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-[#7d8f9f] mr-1">
                              {t("Supported Schemes")}:
                            </span>
                            {partner.supported_schemes.map((s) => (
                              <span
                                key={s}
                                className="rounded-md border border-[#e2e2d8] bg-[#fafaf4] px-2 py-0.5 text-[10px] font-semibold text-[#666427]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

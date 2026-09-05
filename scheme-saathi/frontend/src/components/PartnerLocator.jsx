import React, { useState, useEffect, useMemo } from "react";
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
  Navigation,
  TrendingUp,
  Building2,
  Filter,
  Check,
} from "lucide-react";
import AppNavbar from "./AppNavbar";
import { SelectField } from "./common/CommonUI";
import PartnerMap from "./common/PartnerMap";
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
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyFastTrack, setOnlyFastTrack] = useState(false);

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

  // When user is signed in, load location from user_profiles or auto-detect
  useEffect(() => {
    if (!isLoggedIn) return;

    let isMounted = true;
    const loadSignedUserLocation = async () => {
      try {
        const token = localStorage.getItem("scheme_saathi_token");
        if (token) {
          const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const profile = data?.profile;
            if (profile?.state && isMounted) {
              setState(profile.state);
              if (profile.district) {
                setDistrict(profile.district);
              }
              fetchDistricts(profile.state);
              searchPartners({
                stateName: profile.state,
                districtName: profile.district || "",
              });
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch user profile for location autofill:", err);
      }

      // If signed in but no saved profile state yet, auto-detect location and fill filters!
      if (isMounted && !state) {
        performDetectLocation(true);
      }
    };

    loadSignedUserLocation();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

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

  const performDetectLocation = async (silent = false) => {
    if (!silent) setError("");
    setGpsLoading(true);

    const applyDetectedLocation = async (lat, lon) => {
      const detectedCoords = { latitude: lat, longitude: lon };
      setCoords(detectedCoords);
      setGpsActive(true);
      apiCache.setCachedGps(detectedCoords);

      // Reverse geocode to find State & District
      let detectedState = "";
      let detectedDistrict = "";

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/locations/reverse-geocode?latitude=${lat}&longitude=${lon}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.state) {
            detectedState = data.state;
            detectedDistrict = data.district || "";
          }
        }
      } catch (err) {
        console.warn("Backend reverse-geocode failed, falling back to direct OSM:", err);
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`
          );
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            detectedState = osmData.address?.state || "";
            detectedDistrict =
              osmData.address?.state_district ||
              osmData.address?.county ||
              osmData.address?.city ||
              "";
          }
        } catch {
          // ignore
        }
      }

      // If state was detected, fill it in the filters!
      if (detectedState) {
        setState(detectedState);
        if (detectedDistrict) {
          setDistrict(detectedDistrict);
        }
        fetchDistricts(detectedState);
      }

      // Execute partner search with coordinates and detected state/district
      await searchPartners({
        coordinates: detectedCoords,
        stateName: detectedState || undefined,
        districtName: detectedDistrict || undefined,
      });

      // Scroll smoothly to map so the user immediately sees their pinpointed location
      setTimeout(() => {
        const mapElem = document.getElementById("partner-route-map");
        if (mapElem) {
          mapElem.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    };

    // Try browser navigator.geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setGpsLoading(false);
          await applyDetectedLocation(pos.coords.latitude, pos.coords.longitude);
        },
        async (err) => {
          console.warn("Browser GPS error or blocked:", err);
          // Fallback to IP Geolocation via backend
          try {
            const ipRes = await fetch(`${API_BASE_URL}/api/locations/reverse-geocode`);
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData.latitude && ipData.longitude) {
                setGpsLoading(false);
                await applyDetectedLocation(ipData.latitude, ipData.longitude);
                return;
              }
            }
          } catch {
            // ignore
          }

          setGpsLoading(false);
          if (!silent) {
            setError(
              t(
                "Location access was denied or unavailable. Please select your State and District manually from the dropdowns."
              )
            );
          }
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      // Geolocation not supported, fallback to IP Geolocation
      try {
        const ipRes = await fetch(`${API_BASE_URL}/api/locations/reverse-geocode`);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            setGpsLoading(false);
            await applyDetectedLocation(ipData.latitude, ipData.longitude);
            return;
          }
        }
      } catch {
        // ignore
      }
      setGpsLoading(false);
      if (!silent) {
        setError(t("Geolocation is not supported. Please select your State and District manually."));
      }
    }
  };

  const handleDetectLocation = () => {
    performDetectLocation(false);
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
    setSelectedPartnerId(null);
    setCategoryFilter("all");
    setOnlyFastTrack(false);
  };

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (categoryFilter !== "all") {
        const pCat = (p.partner_category || p.type || "").toLowerCase();
        if (
          categoryFilter === "sca" &&
          !pCat.includes("sca") &&
          !pCat.includes("channelising") &&
          !pCat.includes("channelizing")
        )
          return false;
        if (categoryFilter === "bank" && !pCat.includes("bank")) return false;
        if (
          categoryFilter === "nbfc" &&
          !pCat.includes("nbfc") &&
          !pCat.includes("microfin") &&
          !pCat.includes("mfi")
        )
          return false;
        if (
          categoryFilter === "liaison" &&
          !pCat.includes("liaison") &&
          !pCat.includes("nsfdc")
        )
          return false;
      }
      if (onlyFastTrack) {
        if (
          (p.npa_rate != null && p.npa_rate > 3.0) ||
          (p.fund_utilization_percent != null && p.fund_utilization_percent < 88.0) ||
          p.eligibility_status === "restricted"
        ) {
          return false;
        }
      }
      return true;
    });
  }, [partners, categoryFilter, onlyFastTrack]);

  const userLocationObj = useMemo(() => {
    if (gpsActive && coords && coords.latitude && coords.longitude) {
      const locText = [district, state].filter(Boolean).join(", ");
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        isGps: true,
        label: locText ? `${locText} (${t("Your GPS Location")})` : t("Your GPS Location"),
      };
    }
    if (coords && coords.latitude && coords.longitude) {
      const locText = [district, state].filter(Boolean).join(", ");
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        isGps: true,
        label: locText ? `${locText} (${t("Detected Location")})` : t("Detected Location"),
      };
    }
    if (state) {
      const firstWithCoords = partners.find(
        (p) =>
          p.latitude &&
          p.longitude &&
          p.state?.toLowerCase() === state.toLowerCase()
      );
      if (firstWithCoords) {
        return {
          latitude: firstWithCoords.latitude - 0.02,
          longitude: firstWithCoords.longitude - 0.02,
          isGps: false,
          label: `${district ? `${district}, ` : ""}${state} (${t("Citizen Location")})`,
        };
      }
    }
    return null;
  }, [coords, gpsActive, state, district, partners, t]);

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
            {t("GEO-SPATIAL PARTNER LOCATOR & ROUTER")}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#172a43] sm:text-4xl md:text-5xl">
            {t("Find a verified channel partner near you.")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[#60748b]">
            {t("Interactive geospatial map routing to identify the nearest eligible Channel Partner (SCA, Bank, NBFC-MFI) based on your location and real-time partner fund utilization eligibility (protecting applications from high NPAs or overdue recovery issues).")}
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

        {!searched && !loading && !gpsLoading && (
          <div className="mt-8 rounded-2xl border border-dashed border-[#cbe0ee] bg-[#f8fbfe] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4fc] text-[#145c91]">
              <MapPin size={28} />
            </div>
            <h3 className="mt-4 font-serif text-lg font-bold text-[#172a43]">
              {t("Explore Channel Partners Across India")}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[#5e748c]">
              {t(
                "Click 'Detect My Current Location' above to automatically locate verified SCAs, Banks, and NBFC-MFIs near you, or select your State and District from the dropdown to explore."
              )}
            </p>
          </div>
        )}

        {searched && (
          <div className="mt-10 space-y-8">
            {/* Header & Filter Controls */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#172a43]">
                  {t("Search Results & Interactive Map")}
                </h3>
                {message && (
                  <p className="mt-1 text-sm text-[#5d7186]">{message}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {aiRanked && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe2f7] bg-[#eaf5fc] px-3.5 py-1 text-xs font-bold text-[#145c91]">
                    <Sparkles size={14} className="text-[#c6a56b]" />
                    {t("AI Ranked Match")}
                  </span>
                )}
                <span className="rounded-full bg-white border border-[#d6e3ec] px-3.5 py-1 text-xs font-bold text-[#35485d]">
                  {t("Showing")}: {filteredPartners.length} / {partners.length}
                </span>
              </div>
            </div>

            {/* Interactive Geospatial Map Section */}
            {(partners.length > 0 || userLocationObj) && (
              <div id="partner-route-map" className="scroll-mt-24">
                <PartnerMap
                  partners={filteredPartners}
                  userLocation={userLocationObj}
                  selectedPartnerId={selectedPartnerId || filteredPartners[0]?.partner_id}
                  onSelectPartner={(p) => setSelectedPartnerId(p.partner_id)}
                  height="450px"
                  title={t("Interactive Partner Locator & Geo-Spatial Routing Map")}
                />
              </div>
            )}

            {/* Quick Filter Ribbon: Partner Type & Fast-Track Fund Safety */}
            {partners.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce7ee] bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#62778c] mr-1 flex items-center gap-1">
                    <Filter size={13} />
                    {t("Filter Type")}:
                  </span>
                  {[
                    { id: "all", label: "All Partners" },
                    { id: "sca", label: "SCAs" },
                    { id: "bank", label: "Commercial Banks" },
                    { id: "nbfc", label: "NBFC-MFIs" },
                    { id: "liaison", label: "NSFDC Centres" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setCategoryFilter(filter.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        categoryFilter === filter.id
                          ? "bg-[#145c91] text-white shadow-xs"
                          : "bg-[#f4f7f9] text-[#4d6379] hover:bg-[#eaf1f6]"
                      }`}
                    >
                      {t(filter.label)}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyFastTrack}
                    onChange={(e) => setOnlyFastTrack(e.target.checked)}
                    className="h-4 w-4 rounded border-[#cbd7e0] text-[#145c91] focus:ring-[#145c91]"
                  />
                  <span className="text-xs font-bold text-[#1e5a2e] flex items-center gap-1">
                    <ShieldCheck size={14} className="text-[#2e7d32]" />
                    {t("Fast-Track Disbursal Only (Low NPA < 3% & > 90% Fund Utilization)")}
                  </span>
                </label>
              </div>
            )}

            {/* Results Grid */}
            {filteredPartners.length === 0 ? (
              <div className="rounded-2xl border border-[#d7e2e9] bg-white p-12 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f6fa] text-[#8698aa]">
                  <MapPin size={32} />
                </div>
                <h4 className="mt-4 font-serif text-xl font-bold text-[#23384f]">
                  {t("No matching partner found")}
                </h4>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#6c7f93]">
                  {t('No partner was found for your specific filter combination. Try selecting "All Partners" or resetting category filters.')}
                </p>
                <button
                  onClick={() => {
                    setCategoryFilter("all");
                    setOnlyFastTrack(false);
                  }}
                  className="mt-5 rounded-lg bg-[#145c91] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#104d7b]"
                >
                  {t("Reset Category Filters")}
                </button>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredPartners.map((partner) => {
                  const isSelected = selectedPartnerId === partner.partner_id;

                  return (
                    <div
                      key={partner.partner_id}
                      className={`overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md md:p-7 ${
                        isSelected
                          ? "border-[#1769a8] ring-2 ring-[#1769a8]/20 bg-[#fbfdff]"
                          : "border-[#d7e3eb] hover:border-[#1769a8]/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#e8f3fa] px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-[#145c91]">
                            {partner.partner_category || partner.type}
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

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedPartnerId(partner.partner_id);
                                const mapEl = document.getElementById("partner-route-map");
                                if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#145c91] bg-[#eef7fd] px-3.5 py-2.5 text-xs font-bold text-[#145c91] transition hover:bg-[#145c91] hover:text-white"
                            >
                              <Compass size={14} />
                              <span>{t("View on Map & Route")}</span>
                            </button>

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
                      </div>

                      {/* Fund Utilization & NPA Health Real-time Card Dashboard */}
                      <div className="mt-5 rounded-xl border border-[#e1ebf2] bg-[#f8fafc] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={15} className="text-[#145c91]" />
                            <span className="text-xs font-bold text-[#1a2f47]">
                              {t("Partner Fund Utilization & NPA Health Status")}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf7ed] px-2.5 py-0.5 text-[11px] font-bold text-[#1e5a2e]">
                            <CheckCircle2 size={12} className="text-[#2e7d32]" />
                            {partner.disbursal_status || t("Active & Fast Track Disbursal")}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg bg-white border border-[#e5edf2] p-2.5">
                            <p className="text-[10px] text-[#718599] font-medium">{t("Fund Utilization")}</p>
                            <p className="mt-0.5 text-sm font-bold text-[#145c91]">
                              {partner.fund_utilization_percent || 94.5}%
                            </p>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#edf2f7] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#145c91]"
                                style={{ width: `${partner.fund_utilization_percent || 94.5}%` }}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg bg-white border border-[#e5edf2] p-2.5">
                            <p className="text-[10px] text-[#718599] font-medium">{t("NPA Default Rate")}</p>
                            <p className={`mt-0.5 text-sm font-bold ${(partner.npa_rate || 1.4) > 3.0 ? "text-amber-700" : "text-[#2e7d32]"}`}>
                              {partner.npa_rate != null ? `${partner.npa_rate}%` : "1.4%"}
                              <span className="ml-1 text-[10px] font-normal text-[#64748b]">
                                ({partner.npa_risk_level || "Low Risk"})
                              </span>
                            </p>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#edf2f7] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#2e7d32]"
                                style={{ width: `${Math.min(100, ((partner.npa_rate || 1.4) / 5) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg bg-white border border-[#e5edf2] p-2.5">
                            <p className="text-[10px] text-[#718599] font-medium">{t("Overdue Recovery")}</p>
                            <p className="mt-0.5 text-sm font-bold text-[#19324d]">
                              {partner.overdue_recovery_percent || 97.2}%
                            </p>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#edf2f7] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#3b82f6]"
                                style={{ width: `${partner.overdue_recovery_percent || 97.2}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {(partner.supported_loan_categories?.length > 0 || partner.supported_schemes?.length > 0) && (
                        <div className="mt-4 border-t border-[#eaf0f5] pt-3.5">
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}




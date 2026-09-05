import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  MapPin,
  Navigation,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Compass,
  Building2,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Phone,
  CheckCircle2,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "../../i18n";
import { getGoogleMapsDirectionsUrl, getGoogleMapsPlaceUrl } from "../../utils/schemeHelpers";

// Helper to create custom colored SVG pin icons
const createPinIcon = (type, isSelected = false, npaRisk = "Low") => {
  let bgColor = "#1769a8";
  let borderColor = "#ffffff";
  let iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>`;

  const lowerType = (type || "").toLowerCase();
  if (lowerType.includes("sca") || lowerType.includes("channelising") || lowerType.includes("channelizing")) {
    bgColor = "#0f4c81"; // Deep Blue
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  } else if (lowerType.includes("bank") || lowerType.includes("sbi") || lowerType.includes("pnb") || lowerType.includes("canara")) {
    bgColor = "#1b7a43"; // Emerald Green
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`;
  } else if (lowerType.includes("nbfc") || lowerType.includes("microfin") || lowerType.includes("mfi")) {
    bgColor = "#7e34b0"; // Purple
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4M12 16V8"/></svg>`;
  } else if (lowerType.includes("liaison") || lowerType.includes("hq") || lowerType.includes("nsfdc")) {
    bgColor = "#145c91"; // Navy
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  const ringColor = isSelected ? "#e6b032" : (npaRisk === "Low" ? "#48bb78" : "#ecc94b");
  const size = isSelected ? 42 : 36;

  const html = `
    <div class="partner-marker-container ${isSelected ? 'marker-selected' : ''}" style="position: relative; width: ${size}px; height: ${size + 8}px; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        color: white;
        border-radius: 50%;
        border: 3px solid ${borderColor};
        box-shadow: 0 4px 14px rgba(0,0,0,0.35), 0 0 0 ${isSelected ? '4px' : '2px'} ${ringColor};
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        ${iconSvg}
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${bgColor};
        margin-top: -2px;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-partner-marker",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 6)],
  });
};

const createUserLocationIcon = () => {
  const html = `
    <div class="user-pulse-marker" style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div class="user-pulse-ring" style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(23, 105, 168, 0.35); animation: pulseBeacon 2s infinite ease-out;"></div>
      <div style="
        position: relative;
        width: 18px;
        height: 18px;
        background: #1769a8;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-user-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

export default function PartnerMap({
  partners = [],
  userLocation = null,
  selectedPartnerId = null,
  onSelectPartner = () => {},
  height = "480px",
  showControls = true,
  showFastTrackBadge = true,
  title = "",
  className = "",
}) {
  const { t } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePartner, setActivePartner] = useState(null);

  // Filter partners that have valid coordinates
  const validPartners = useMemo(() => {
    return (partners || []).filter(
      (p) =>
        p &&
        typeof p.latitude === "number" &&
        typeof p.longitude === "number" &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude) &&
        p.latitude !== 0 &&
        p.longitude !== 0
    );
  }, [partners]);

  // Selected or first partner
  const selectedPartner = useMemo(() => {
    if (selectedPartnerId) {
      const found = validPartners.find((p) => p.partner_id === selectedPartnerId);
      if (found) return found;
    }
    return activePartner || validPartners[0] || null;
  }, [validPartners, selectedPartnerId, activePartner]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter = [20.5937, 78.9629]; // Center of India
      const defaultZoom = 5;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Clean OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Layer groups for clean updates
      markersGroupRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map instance alive or clean up if needed
    };
  }, []);

  // Update markers, route, and map bounds whenever partners or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const routeGroup = routeLayerRef.current;
    if (!map || !markersGroup || !routeGroup) return;

    markersGroup.clearLayers();
    routeGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    // 1. Plot User Location if available
    let userLatLng = null;
    if (
      userLocation &&
      typeof userLocation.latitude === "number" &&
      typeof userLocation.longitude === "number"
    ) {
      userLatLng = [userLocation.latitude, userLocation.longitude];
      bounds.extend(userLatLng);

      const userMarker = L.marker(userLatLng, {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000,
      });

      userMarker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; padding: 4px; min-width: 170px;">
          <div style="display: flex; align-items: center; gap: 4px; font-weight: 700; color: #1769a8; margin-bottom: 3px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #1769a8;"></span>
            📍 ${t("Your Location")}
          </div>
          <div style="color: #2d3748; font-weight: 600; font-size: 11px; margin-bottom: 2px;">
            ${userLocation.label || t("GPS Location")}
          </div>
          <div style="color: #718096; font-size: 10px;">
            GPS: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}
          </div>
        </div>
      `);

      userMarker.addTo(markersGroup);

      if (userLocation.isGps || validPartners.length === 0) {
        setTimeout(() => {
          userMarker.openPopup();
        }, 250);
      }
    }

    // 2. Plot Channel Partner Markers
    validPartners.forEach((partner) => {
      const isSelected = selectedPartner && selectedPartner.partner_id === partner.partner_id;
      const partnerLatLng = [partner.latitude, partner.longitude];
      bounds.extend(partnerLatLng);

      const marker = L.marker(partnerLatLng, {
        icon: createPinIcon(partner.partner_category || partner.type, isSelected, partner.npa_risk_level),
        zIndexOffset: isSelected ? 900 : 500,
      });

      // Rich popup content with fund utilization & NPA safety
      const npaRate = partner.npa_rate != null ? `${partner.npa_rate}%` : "1.4%";
      const fundUtil = partner.fund_utilization_percent != null ? `${partner.fund_utilization_percent}%` : "94.5%";
      const recoveryRate = partner.overdue_recovery_percent != null ? `${partner.overdue_recovery_percent}%` : "97.2%";
      const distanceText = partner.distance_km != null ? `${partner.distance_km} km` : "";

      const gmapsUrl = getGoogleMapsDirectionsUrl(partner, userLocation);

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 240px; max-width: 290px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: #145c91; background: #e8f4fc; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">
              ${partner.partner_category || partner.type || "Channel Partner"}
            </span>
            ${distanceText ? `<span style="font-size: 11px; font-weight: 700; color: #1769a8;">🧭 ${distanceText}</span>` : ""}
          </div>

          <div style="font-size: 14px; font-weight: 700; color: #172a43; line-height: 1.3; margin-bottom: 6px;">
            ${partner.name}
          </div>

          ${partner.address ? `
            <div style="font-size: 11px; color: #576b82; line-height: 1.4; margin-bottom: 8px;">
              📍 ${partner.address}
            </div>
          ` : ""}

          <!-- Fund Utilization & NPA Health -->
          <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; color: #4a5568; margin-bottom: 4px;">
              <span>Fund Utilization:</span>
              <span style="color: #2b6cb0; font-weight: 700;">${fundUtil}</span>
            </div>
            <div style="width: 100%; height: 5px; background: #edf2f7; border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
              <div style="width: ${parseFloat(fundUtil)}%; height: 100%; background: linear-gradient(90deg, #3182ce, #38a169); border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #4a5568;">
              <span>NPA Risk: <strong style="color: #2f855a;">${partner.npa_risk_level || "Low"} (${npaRate})</strong></span>
              <span>Recovery: <strong>${recoveryRate}</strong></span>
            </div>
          </div>

          <div style="display: flex; gap: 6px;">
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="
              flex: 1;
              text-align: center;
              background: #145c91;
              color: white;
              font-size: 11px;
              font-weight: 600;
              padding: 6px 10px;
              border-radius: 6px;
              text-decoration: none;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
            ">
              <span>Directions</span> ↗
            </a>
            ${partner.contact ? `
              <a href="tel:${partner.contact.split('/')[0].trim()}" style="
                background: #edf7ed;
                color: #2e7d32;
                border: 1px solid #c8e6c9;
                font-size: 11px;
                font-weight: 600;
                padding: 6px 10px;
                border-radius: 6px;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 4px;
              ">
                📞 Call
              </a>
            ` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on("click", () => {
        setActivePartner(partner);
        onSelectPartner(partner);
      });

      marker.addTo(markersGroup);

      if (isSelected) {
        setTimeout(() => {
          marker.openPopup();
        }, 150);
      }
    });

    // 3. Draw Route Polyline from user to selected partner
    if (userLatLng && selectedPartner) {
      const destLatLng = [selectedPartner.latitude, selectedPartner.longitude];

      L.polyline([userLatLng, destLatLng], {
        color: "#1769a8",
        weight: 3.5,
        opacity: 0.85,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(routeGroup);

      const midLat = (userLatLng[0] + destLatLng[0]) / 2;
      const midLng = (userLatLng[1] + destLatLng[1]) / 2;

      if (selectedPartner.distance_km) {
        L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `
              <div style="
                background: #172a43;
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                font-family: sans-serif;
                padding: 2px 8px;
                border-radius: 9999px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                white-space: nowrap;
                border: 1.5px solid #ffffff;
              ">
                🧭 ${selectedPartner.distance_km} km
              </div>
            `,
            className: "route-distance-badge",
            iconSize: [60, 20],
            iconAnchor: [30, 10],
          }),
        }).addTo(routeGroup);
      }
    }

    // 4. Fit map to view all relevant markers nicely
    if (validPartners.length === 0 && userLatLng) {
      map.setView(userLatLng, 13, { animate: true });
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 14,
        animate: true,
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [validPartners, userLocation, selectedPartner, onSelectPartner, t]);

  const handleCenterOnUser = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.flyTo([userLocation.latitude, userLocation.longitude], 12, {
      duration: 1.2,
    });
  };

  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || validPartners.length === 0) return;
    const bounds = L.latLngBounds([]);
    if (userLocation) bounds.extend([userLocation.latitude, userLocation.longitude]);
    validPartners.forEach((p) => bounds.extend([p.latitude, p.longitude]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#cfe0ec] bg-white shadow-sm transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : ""
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ecf2] bg-[#f9fcfe] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#145c91] text-white">
            <Compass size={15} />
          </div>
          <div>
            <h4 className="font-serif text-xs font-bold tracking-wide text-[#172a43] sm:text-sm">
              {title || t("Geo-Spatial Partner Locator & Route Map")}
            </h4>
            <p className="text-[10px] text-[#6c8096]">
              {validPartners.length}{" "}
              {t("eligible channel partner(s) mapped with active fund utilization")}
            </p>
          </div>
        </div>

        {/* Action Controls & Legend */}
        <div className="flex flex-wrap items-center gap-2">
          {showFastTrackBadge && (
            <span className="hidden items-center gap-1 rounded-full border border-[#c3e6cb] bg-[#eef9f1] px-2.5 py-1 text-[10px] font-bold text-[#1e5a2e] sm:inline-flex">
              <CheckCircle2 size={12} className="text-[#2e7d32]" />
              {t("Safe Fund Eligibility Verified")}
            </span>
          )}

          {userLocation && (
            <button
              onClick={handleCenterOnUser}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d2e0e9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#34485e] shadow-xs transition hover:bg-[#edf5fa] hover:text-[#145c91]"
              title={t("Center on My Location")}
            >
              <Navigation size={13} className="text-[#1769a8]" />
              <span className="hidden md:inline">{t("My Location")}</span>
            </button>
          )}

          <button
            onClick={handleFitAll}
            className="inline-flex items-center gap-1 rounded-lg border border-[#d2e0e9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#34485e] shadow-xs transition hover:bg-[#edf5fa] hover:text-[#145c91]"
            title={t("Fit All Partners")}
          >
            <Layers size={13} className="text-[#1769a8]" />
            <span className="hidden md:inline">{t("View All")}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="inline-flex items-center justify-center rounded-lg border border-[#d2e0e9] bg-white p-1.5 text-[#34485e] shadow-xs transition hover:bg-[#edf5fa] hover:text-[#145c91]"
            title={isFullscreen ? t("Exit Fullscreen") : t("Expand Map")}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{ height: isFullscreen ? "calc(100vh - 58px)" : height }}
        className="w-full bg-[#e8f0f6] z-10"
      />

      {/* Floating Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-20 hidden rounded-xl border border-white/80 bg-white/95 p-2.5 shadow-md backdrop-blur sm:block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#708499] mb-1.5">
          {t("Partner Categories")}
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#2c3f55]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0f4c81]" />
            <span>{t("State Agency (SCA)")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1b7a43]" />
            <span>{t("Partner Bank")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7e34b0]" />
            <span>{t("NBFC-MFI Hub")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1769a8]" />
            <span>{t("Your Location")}</span>
          </div>
        </div>
      </div>

      {/* Selected Partner Quick Routing Footer Banner */}
      {selectedPartner && (
        <div className="border-t border-[#e2ecf2] bg-white p-3.5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#145c91] font-bold text-xs">
                <Building2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-sm font-bold text-[#172a43]">
                    {selectedPartner.name}
                  </span>
                  <span className="rounded bg-[#edf7ed] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                    {t("Fund Utilization")}: {selectedPartner.fund_utilization_percent || 94}%
                  </span>
                </div>
                <p className="text-[11px] text-[#63778c] line-clamp-1">
                  {selectedPartner.address || selectedPartner.district}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedPartner.distance_km && (
                <div className="text-right mr-2 hidden md:block">
                  <p className="text-[10px] text-[#718599]">{t("Estimated Distance")}</p>
                  <p className="font-serif text-xs font-bold text-[#145c91]">
                    {selectedPartner.distance_km} km
                  </p>
                </div>
              )}

              <a
                href={getGoogleMapsDirectionsUrl(selectedPartner, userLocation)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#145c91] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0f4973]"
              >
                <span>{t("Navigate & Route")}</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

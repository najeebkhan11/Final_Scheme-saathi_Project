/**
 * Scheme Saathi - Scheme and Form Helper Utilities
 */

export function normalizeMatchScore(score) {
  if (score === null || score === undefined || score === "") {
    return null;
  }

  const numericScore = Number(score);
  if (Number.isNaN(numericScore)) {
    return null;
  }

  const percentage = numericScore <= 1 ? numericScore * 100 : numericScore;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `₹${numericValue.toLocaleString("en-IN")}`;
}

export function formatValue(value) {
  if (!value) {
    return "Not provided";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isWomenFocusedScheme(scheme) {
  if (!scheme) return false;

  if (
    scheme.female_only === true ||
    scheme.femaleOnly === true ||
    scheme.gender_rule?.female_only === true ||
    scheme.gender_status?.female_only === true
  ) {
    return true;
  }

  const name = String(scheme.name || scheme.scheme_name || "").toLowerCase();
  if (name.includes("mahila")) {
    return true;
  }

  const messages = [
    scheme.gender_status?.message,
    scheme.gender_message,
    scheme.gender_requirement,
    scheme.preference_message,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");

  return (
    messages.includes("women only") ||
    messages.includes("women exclusively") ||
    messages.includes("female only") ||
    messages.includes("female-only") ||
    messages.includes("exclusively reserved for female")
  );
}

export function isFemaleApplicant(formData) {
  return String(formData?.gender || "").toLowerCase() === "female";
}

export function shouldExcludeForGender(scheme, formData) {
  return isWomenFocusedScheme(scheme) && !isFemaleApplicant(formData);
}

export function getGenderFailureReason(scheme) {
  if (scheme?.gender_status?.message) {
    return String(scheme.gender_status.message);
  }
  return "This scheme has a women-focused fund allocation and is not recommended for male / non-female applicants.";
}

export function calculateFallbackMatchScore(scheme, formData) {
  if (!scheme) return 0;
  if (shouldExcludeForGender(scheme, formData)) return 0;

  const reasons = Array.isArray(scheme.reasons) ? scheme.reasons : [];
  let score = 0;

  const hasCommunityMatch = reasons.some((reason) =>
    String(reason).toLowerCase().includes("community requirement satisfied")
  );
  const hasIncomeMatch = reasons.some((reason) =>
    String(reason).toLowerCase().includes("annual family income is within")
  );
  const hasPurposeMatch = reasons.some((reason) =>
    String(reason).toLowerCase().includes("requirement type is compatible")
  );
  const hasProjectMatch = reasons.some((reason) =>
    String(reason).toLowerCase().includes("project cost falls within")
  );

  if (hasCommunityMatch) score += 20;
  if (hasIncomeMatch) score += 20;
  if (hasPurposeMatch) score += 20;
  if (hasProjectMatch) score += 20;

  if (
    scheme?.gender_status?.rule_type === "women_target" &&
    formData?.gender === "female"
  ) {
    score += 20;
  }

  return Math.min(100, Math.round(score));
}

export function normalizeSchemeResults(results, formData) {
  const backendPrimaryEligible = Array.isArray(results?.primary?.eligible)
    ? results.primary.eligible
    : [];

  const backendPrimaryIneligible = Array.isArray(results?.primary?.ineligible)
    ? results.primary.ineligible
    : [];

  const backendSecondaryEligible = Array.isArray(results?.secondary?.eligible)
    ? results.secondary.eligible
    : [];

  const allowedPrimaryEligible = [];
  const genderFilteredPrimary = [];

  backendPrimaryEligible.forEach((scheme) => {
    if (shouldExcludeForGender(scheme, formData)) {
      genderFilteredPrimary.push({
        ...scheme,
        eligibility_status: "NOT_ELIGIBLE_GENDER",
        match_score: 0,
        failures: [
          ...(Array.isArray(scheme.failures) ? scheme.failures : []),
          getGenderFailureReason(scheme),
        ],
      });
      return;
    }
    allowedPrimaryEligible.push(scheme);
  });

  const allowedSecondaryEligible = [];
  backendSecondaryEligible.forEach((scheme) => {
    if (shouldExcludeForGender(scheme, formData)) {
      return;
    }
    allowedSecondaryEligible.push(scheme);
  });

  const bestScheme = allowedPrimaryEligible[0] || null;
  const matchScore = bestScheme?.match_score ?? results?.match_score ?? 0;

  return {
    ...results,
    match_score: matchScore,
    best_scheme: bestScheme,
    nearest_partner: results?.nearest_partner || null,
    primary: {
      ...(results?.primary || {}),
      eligible: allowedPrimaryEligible,
      ineligible: [
        ...backendPrimaryIneligible,
        ...genderFilteredPrimary,
      ],
    },
    secondary: {
      ...(results?.secondary || {}),
      eligible: allowedSecondaryEligible,
    },
  };
}

/**
 * Generate accurate Google Maps Directions URL targeting the exact partner landmark and coordinates.
 */
export function getGoogleMapsDirectionsUrl(partner, userLocation = null) {
  if (!partner) return "https://www.google.com/maps";

  // Use verified landmark query or exact coordinates
  const destination = partner.landmark_query
    ? encodeURIComponent(partner.landmark_query)
    : partner.latitude != null && partner.longitude != null
      ? `${partner.latitude},${partner.longitude}`
      : encodeURIComponent(`${partner.name}, ${partner.address || partner.district || ""}`.trim());

  // If real user GPS coordinates are detected, include origin
  if (userLocation && userLocation.isGps && userLocation.latitude != null && userLocation.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destination}&travelmode=driving`;
  }

  // If no GPS detected, omit origin so Google Maps automatically routes from user's current live location!
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Generate accurate Google Maps Place Search / Marker Pin URL
 */
export function getGoogleMapsPlaceUrl(partner) {
  if (!partner) return "https://www.google.com/maps";
  if (partner.landmark_query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partner.landmark_query)}`;
  }
  if (partner.latitude != null && partner.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${partner.latitude},${partner.longitude}`;
  }
  const query = `${partner.name}, ${partner.address || partner.district || ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}


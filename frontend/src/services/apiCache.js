/**
 * Scheme Saathi - Client-Side API & State Cache Service
 * Provides in-memory and storage-backed caching to prevent duplicate API requests.
 */

// In-memory caches for the active session (super-fast, 0ms latency)
const memoryCache = {
  states: null,
  districtsByState: new Map(),
  partnersByQuery: new Map(),
  emiCalculations: new Map(),
  schemeMatchesByProfile: new Map(),
};

// Storage keys
const STORAGE_KEYS = {
  STATES: "ss_cache_states_v1",
  DISTRICTS_PREFIX: "ss_cache_districts_",
  LAST_RESULTS: "scheme_saathi_last_results",
  LAST_FORM_DATA: "scheme_saathi_last_form_data",
  CACHED_GPS: "scheme_saathi_cached_gps",
};

export const apiCache = {
  /**
   * Get cached states list
   */
  getStates() {
    if (memoryCache.states) {
      return memoryCache.states;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEYS.STATES);
      if (stored) {
        memoryCache.states = JSON.parse(stored);
        return memoryCache.states;
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Save states list to cache
   */
  setStates(states) {
    if (!Array.isArray(states)) return;
    memoryCache.states = states;
    try {
      sessionStorage.setItem(STORAGE_KEYS.STATES, JSON.stringify(states));
    } catch {
      // ignore
    }
  },

  /**
   * Get cached districts for a specific state
   */
  getDistricts(state) {
    if (!state) return null;
    const normalized = state.trim().toLowerCase();
    if (memoryCache.districtsByState.has(normalized)) {
      return memoryCache.districtsByState.get(normalized);
    }
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEYS.DISTRICTS_PREFIX}${normalized}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.districtsByState.set(normalized, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Save districts for a specific state
   */
  setDistricts(state, districts) {
    if (!state || !Array.isArray(districts)) return;
    const normalized = state.trim().toLowerCase();
    memoryCache.districtsByState.set(normalized, districts);
    try {
      sessionStorage.setItem(`${STORAGE_KEYS.DISTRICTS_PREFIX}${normalized}`, JSON.stringify(districts));
    } catch {
      // ignore
    }
  },

  /**
   * Get cached partner search results
   */
  getPartners(queryKey) {
    if (!queryKey) return null;
    return memoryCache.partnersByQuery.get(queryKey) || null;
  },

  /**
   * Save partner search results
   */
  setPartners(queryKey, data) {
    if (!queryKey || !data) return;
    memoryCache.partnersByQuery.set(queryKey, data);
  },

  /**
   * Get cached GPS coordinates for the current session
   */
  getCachedGps() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEYS.CACHED_GPS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Cache GPS coordinates for the session
   */
  setCachedGps(coords) {
    if (!coords) return;
    try {
      sessionStorage.setItem(STORAGE_KEYS.CACHED_GPS, JSON.stringify(coords));
    } catch {
      // ignore
    }
  },

  /**
   * Get scheme match by form profile hash
   */
  getSchemeMatch(profileHash) {
    if (!profileHash) return null;
    return memoryCache.schemeMatchesByProfile.get(profileHash) || null;
  },

  /**
   * Cache scheme match by form profile hash
   */
  setSchemeMatch(profileHash, results) {
    if (!profileHash || !results) return;
    memoryCache.schemeMatchesByProfile.set(profileHash, results);
  },

  /**
   * Get last saved scheme recommendation results from persistent storage
   */
  getSavedRecommendations() {
    try {
      const results = localStorage.getItem(STORAGE_KEYS.LAST_RESULTS);
      const formData = localStorage.getItem(STORAGE_KEYS.LAST_FORM_DATA);
      return {
        results: results ? JSON.parse(results) : null,
        formData: formData ? JSON.parse(formData) : null,
      };
    } catch {
      return { results: null, formData: null };
    }
  },

  /**
   * Save scheme recommendation results and form data
   */
  saveRecommendations(results, formData) {
    try {
      if (results) {
        localStorage.setItem(STORAGE_KEYS.LAST_RESULTS, JSON.stringify(results));
      }
      if (formData) {
        localStorage.setItem(STORAGE_KEYS.LAST_FORM_DATA, JSON.stringify(formData));
      }
    } catch {
      // ignore
    }
  },

  /**
   * Get cached EMI calculation
   */
  getEmi(key) {
    return memoryCache.emiCalculations.get(key) || null;
  },

  /**
   * Save EMI calculation
   */
  setEmi(key, emi) {
    memoryCache.emiCalculations.set(key, emi);
  },
};

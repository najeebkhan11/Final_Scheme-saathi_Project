/**
 * Scheme Saathi - Ultra-Fast Multi-Tiered Translation Service
 * Tiers: Static Curated Dictionaries (0ms) -> In-Memory Map (0ms) -> LocalStorage Cache -> Non-blocking Joined Batch Fetch
 */

import { API_BASE_URL } from "../config/api";
import { STATIC_DICTIONARY } from "../data/dictionaryData";
export { API_BASE_URL };

const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single";
const BATCH_DELIMITER = "\n###\n";

// In-memory cache: langCode -> Map(text -> translatedText)
const inMemoryCache = new Map();

// Track in-flight promises to prevent duplicate simultaneous network requests
const inFlightRequests = new Map();

// Failed/untranslatable strings cooldown to prevent repeated network spam
const failedCooldown = new Map(); // key -> timestamp

// Local cache dirty tracker for debounced storage writing (prevents main-thread freeze)
const pendingStorageSaves = new Map(); // lang -> Map of text -> translation
let storageSaveTimeout = null;

// Helper to get persistent cache for a language from localStorage
function getLocalCache(lang) {
  try {
    const raw = localStorage.getItem(`scheme_saathi_trans_${lang}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Load entire localStorage cache into inMemoryCache for 0ms lookup
function warmMemoryCacheForLang(lang) {
  if (inMemoryCache.has(lang)) return inMemoryCache.get(lang);

  const langMap = new Map();
  const local = getLocalCache(lang);
  for (const [key, value] of Object.entries(local)) {
    langMap.set(key, value);
  }
  inMemoryCache.set(lang, langMap);
  return langMap;
}

// Schedule debounced persistent save to prevent synchronous I/O blocking the UI
function scheduleStorageSave(lang, text, translation) {
  if (!pendingStorageSaves.has(lang)) {
    pendingStorageSaves.set(lang, new Map());
  }
  pendingStorageSaves.get(lang).set(text, translation);

  if (storageSaveTimeout) clearTimeout(storageSaveTimeout);
  storageSaveTimeout = setTimeout(() => {
    try {
      pendingStorageSaves.forEach((updates, targetLang) => {
        const key = `scheme_saathi_trans_${targetLang}`;
        const cache = getLocalCache(targetLang);
        updates.forEach((trans, original) => {
          cache[original] = trans;
        });
        // Limit cache size to 2000 items per language
        const keys = Object.keys(cache);
        if (keys.length > 2000) {
          const toRemove = keys.slice(0, keys.length - 2000);
          toRemove.forEach((k) => delete cache[k]);
        }
        localStorage.setItem(key, JSON.stringify(cache));
      });
      pendingStorageSaves.clear();
    } catch {
      // Ignore quota exceeded or storage disabled
    }
  }, 1000);
}

export const translationService = {
  /**
   * Synchronous 0ms cached translation lookup
   */
  getCached(text, targetLang) {
    if (!text || targetLang === "en") return text;
    const trimmed = String(text).trim();
    if (!trimmed) return text;

    // 1. Static curated dictionary lookup (0ms instant)
    if (STATIC_DICTIONARY[targetLang]?.[trimmed]) {
      return STATIC_DICTIONARY[targetLang][trimmed];
    }

    // 2. Check in-memory cache
    const langMap = inMemoryCache.get(targetLang) || warmMemoryCacheForLang(targetLang);
    if (langMap.has(trimmed)) {
      return langMap.get(trimmed);
    }

    return null;
  },

  /**
   * Fast synchronous pre-warming from static dictionary (no network calls)
   */
  warmWithDict(targetLang) {
    if (!targetLang || targetLang === "en") return;
    const dict = STATIC_DICTIONARY[targetLang] || {};
    const langMap = inMemoryCache.get(targetLang) || warmMemoryCacheForLang(targetLang);
    for (const [k, v] of Object.entries(dict)) {
      langMap.set(k, v);
    }
  },

  /**
   * Translate a single phrase with deduplication and caching
   */
  async translate(text, targetLang) {
    if (!text || targetLang === "en") return text;
    const trimmed = String(text).trim();
    if (!trimmed || !isNaN(Number(trimmed)) || trimmed.length === 1) return text;

    // Check synchronous cache first
    const cached = this.getCached(trimmed, targetLang);
    if (cached) return cached;

    // Check cooldown
    const flightKey = `${targetLang}:${trimmed}`;
    const failedTime = failedCooldown.get(flightKey);
    if (failedTime && Date.now() - failedTime < 60000) {
      return trimmed;
    }

    // Check if identical request is already in-flight
    if (inFlightRequests.has(flightKey)) {
      return inFlightRequests.get(flightKey);
    }

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams({
          client: "gtx",
          sl: "auto",
          tl: targetLang,
          dt: "t",
          q: trimmed,
        });

        const response = await fetch(`${TRANSLATE_API}?${params.toString()}`);
        if (!response.ok) {
          failedCooldown.set(flightKey, Date.now());
          return trimmed;
        }

        const data = await response.json();
        const translated = Array.isArray(data?.[0])
          ? data[0].map((part) => part?.[0] || "").join("")
          : trimmed;

        const result = translated.trim() || trimmed;

        // Store in memory map
        const langMap = inMemoryCache.get(targetLang) || warmMemoryCacheForLang(targetLang);
        langMap.set(trimmed, result);

        // Schedule debounced disk save
        scheduleStorageSave(targetLang, trimmed, result);

        return result;
      } catch {
        failedCooldown.set(flightKey, Date.now());
        return trimmed;
      } finally {
        inFlightRequests.delete(flightKey);
      }
    })();

    inFlightRequests.set(flightKey, fetchPromise);
    return fetchPromise;
  },

  /**
   * Fast Joined-Batch Translation:
   * Combines multiple phrases into a single HTTP request using a delimiter.
   * Reduces 25 network roundtrips into 1 roundtrip.
   */
  async translateBatchJoined(texts, targetLang) {
    if (!Array.isArray(texts) || texts.length === 0 || targetLang === "en") return texts;

    const uncached = texts.filter((t) => !this.getCached(t, targetLang));
    if (uncached.length === 0) {
      return texts.map((t) => this.getCached(t, targetLang) || t);
    }

    // Process in batches of up to 20 phrases combined in a single request
    const CHUNK_SIZE = 20;
    for (let i = 0; i < uncached.length; i += CHUNK_SIZE) {
      const chunk = uncached.slice(i, i + CHUNK_SIZE);
      const joinedText = chunk.join(BATCH_DELIMITER);

      try {
        const params = new URLSearchParams({
          client: "gtx",
          sl: "auto",
          tl: targetLang,
          dt: "t",
          q: joinedText,
        });

        const response = await fetch(`${TRANSLATE_API}?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const translatedCombined = Array.isArray(data?.[0])
            ? data[0].map((part) => part?.[0] || "").join("")
            : "";

          if (translatedCombined) {
            const splitParts = translatedCombined.split(/\s*###\s*/);
            const langMap = inMemoryCache.get(targetLang) || warmMemoryCacheForLang(targetLang);

            chunk.forEach((original, idx) => {
              const translated = splitParts[idx]?.trim() || original;
              langMap.set(original, translated);
              scheduleStorageSave(targetLang, original, translated);
            });
            continue;
          }
        }
      } catch {
        // Fallback to individual calls on delimiter parse failure
      }

      // Fallback: translate individually with concurrency cap
      await Promise.allSettled(chunk.map((t) => this.translate(t, targetLang)));
    }

    return texts.map((t) => this.getCached(t, targetLang) || t);
  },

  /**
   * Translate multiple strings in parallel with joined batching
   */
  async translateBatch(texts, targetLang) {
    if (!Array.isArray(texts) || targetLang === "en") return texts;
    const unique = Array.from(new Set(texts.map((t) => (t ? String(t).trim() : ""))));
    const uncached = unique.filter((t) => t && !this.getCached(t, targetLang));

    if (uncached.length > 0) {
      await this.translateBatchJoined(uncached, targetLang);
    }

    return texts.map((t) => this.getCached(t, targetLang) || t);
  },

  /**
   * Pre-warm cache for a set of known common phrases for a target language
   */
  async prefetchCommon(phrases, targetLang) {
    if (targetLang === "en" || !Array.isArray(phrases)) return;
    this.translateBatch(phrases, targetLang).catch(() => {});
  },
};

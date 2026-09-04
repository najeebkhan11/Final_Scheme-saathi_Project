import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { translationService } from "./services/translationService";
import { STATIC_DICTIONARY } from "./data/dictionaryData";
import { LANGUAGES, INDIA_LANGUAGES_LIST } from "./data/languagesData";

export { LANGUAGES, INDIA_LANGUAGES_LIST, STATIC_DICTIONARY };

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem("scheme_saathi_language") || "en";
    } catch {
      return "en";
    }
  });

  const [isTranslating, setIsTranslating] = useState(false);
  const [version, setVersion] = useState(0);

  // Background queue management
  const queueRef = useRef(new Set());
  const batchTimeoutRef = useRef(null);
  const activeBatchCount = useRef(0);

  // Apply language, dir and persist
  useEffect(() => {
    try {
      localStorage.setItem("scheme_saathi_language", language);
    } catch {
      // ignore
    }
    document.documentElement.lang = language;
    document.documentElement.dir = LANGUAGES[language]?.dir || "ltr";

    if (language !== "en") {
      // Synchronously pre-warm static dictionary into memory cache (0ms, no network spam)
      translationService.warmWithDict(language);
    }
  }, [language]);

  const setLanguage = useCallback((newLanguage) => {
    if (!LANGUAGES[newLanguage]) return;
    setLanguageState(newLanguage);
  }, []);

  // Process queued translations in throttled batches
  const processQueue = useCallback(() => {
    if (queueRef.current.size === 0 || language === "en") return;

    const textsToTranslate = Array.from(queueRef.current);
    queueRef.current.clear();

    activeBatchCount.current += 1;
    setIsTranslating(true);

    translationService
      .translateBatch(textsToTranslate, language)
      .then((results) => {
        // Only re-render if at least one translated item differs from original
        const hasNewTranslations = results.some(
          (translated, idx) => translated && translated !== textsToTranslate[idx]
        );
        if (hasNewTranslations) {
          setVersion((v) => v + 1);
        }
      })
      .finally(() => {
        activeBatchCount.current = Math.max(0, activeBatchCount.current - 1);
        if (activeBatchCount.current === 0) {
          setIsTranslating(false);
        }
      });
  }, [language]);

  /**
   * Ultra-Fast translate function:
   * 1. 0ms instant lookup in static dictionary
   * 2. 0ms instant lookup in translationService memory cache
   * 3. If uncached, return original text immediately and enqueue for non-blocking joined batch fetch
   */
  const t = useCallback(
    (phrase) => {
      void version;
      if (!phrase || language === "en") return phrase;
      const text = String(phrase).trim();
      if (!text || !isNaN(Number(text)) || text.length <= 1) return phrase;

      // 1. Static curated dictionary lookup (0ms)
      if (STATIC_DICTIONARY[language]?.[text]) {
        return STATIC_DICTIONARY[language][text];
      }

      // 2. Memory / persistent cache lookup (0ms)
      const cached = translationService.getCached(text, language);
      if (cached) return cached;

      // 3. Uncached: Enqueue for debounced background batch
      queueRef.current.add(text);
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(processQueue, 100);

      return phrase;
    },
    [language, processQueue, version]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isTranslating,
      languages: LANGUAGES,
      languagesList: INDIA_LANGUAGES_LIST,
    }),
    [language, setLanguage, t, isTranslating]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: "en",
      setLanguage: () => {},
      t: (s) => s,
      isTranslating: false,
      languages: LANGUAGES,
      languagesList: INDIA_LANGUAGES_LIST,
    };
  }
  return context;
}

export const useTranslation = useLanguage;
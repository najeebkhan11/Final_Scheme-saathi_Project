import React, { useState, useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LanguageProvider } from "./i18n";
import ErrorBoundary from "./components/common/ErrorBoundary";
import AppNavbar from "./components/AppNavbar";
import { apiCache } from "./services/apiCache";
import { API_BASE_URL } from "./config/api";

// Lazy-loaded views with idle prefetching for rapid navigation
const LandingPage = lazy(() => import("./components/LandingPage"));
const ExploreSchemes = lazy(() => import("./components/ExploreSchemes"));
const AuthPage = lazy(() => import("./components/AuthPage"));
const SchemeFinder = lazy(() => import("./components/SchemeFinder"));
const EMICalculator = lazy(() => import("./components/EMICalculator"));
const PartnerLocator = lazy(() => import("./components/PartnerLocator"));
const AIAssistant = lazy(() => import("./components/AIAssistant"));
const DocumentsPage = lazy(() => import("./components/DocumentsPage"));
const TrackApplication = lazy(() => import("./components/TrackApplication"));
const RecommendationsPage = lazy(() => import("./components/RecommendationsPage"));
const AdminPortal = lazy(() => import("./components/AdminPortal"));

// Preload remaining views during browser idle time
if (typeof window !== "undefined") {
  const preloadChunks = () => {
    import("./components/LandingPage");
    import("./components/ExploreSchemes");
    import("./components/SchemeFinder");
    import("./components/EMICalculator");
    import("./components/PartnerLocator");
    import("./components/AIAssistant");
    import("./components/DocumentsPage");
    import("./components/TrackApplication");
    import("./components/RecommendationsPage");
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preloadChunks);
  } else {
    setTimeout(preloadChunks, 1200);
  }
}

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef7fd] text-[#145c91] shadow-sm">
        <Loader2 size={24} className="animate-spin" />
      </div>
      <p className="mt-4 font-serif text-sm font-semibold tracking-wide text-[#172a43]">
        SCHEME SAATHI
      </p>
      <p className="mt-1 text-xs text-[#718096]">Loading feature...</p>
    </div>
  );
}

function AppContent() {
  const [view, setView] = useState("home");

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("scheme_saathi_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    Boolean(localStorage.getItem("scheme_saathi_token"))
  );

  const [lastSchemeResults, setLastSchemeResults] = useState(
    () => apiCache.getSavedRecommendations().results
  );

  const [lastSchemeFormData, setLastSchemeFormData] = useState(
    () => apiCache.getSavedRecommendations().formData
  );

  const [selectedSchemeForPartner, setSelectedSchemeForPartner] = useState("");
  const [aiInitialQuery, setAiInitialQuery] = useState("");
  const [selectedTrackAppId, setSelectedTrackAppId] = useState("");

  // Pre-warm locations in memory during idle time
  useEffect(() => {
    if (!apiCache.getStates()) {
      fetch(`${API_BASE_URL}/api/locations/states`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.states) apiCache.setStates(data.states);
        })
        .catch(() => {});
    }
  }, []);

  const openSchemeFinder = () => {
    if (isLoggedIn) {
      setView("finder");
    } else {
      setView("login");
    }
  };

  const handleLogin = (user) => {
    if (user) {
      setCurrentUser(user);
    }
    setIsLoggedIn(true);
    setView("finder");
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("scheme_saathi_token");
      localStorage.removeItem("scheme_saathi_user");
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsLoggedIn(false);
    setView("home");
  };

  // Keep navbar accessible across all views except focused auth and full-screen wizard
  const showGlobalNavbar = view !== "login" && view !== "signup" && view !== "finder";

  return (
    <div className="min-h-screen bg-white text-[#10213f] flex flex-col">
      {showGlobalNavbar && (
        <AppNavbar
          activeView={view}
          onNavigate={(page) => setView(page)}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLogin={() => setView("login")}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          {view === "home" && (
            <LandingPage
              hideNavbar={true}
              onFindScheme={openSchemeFinder}
              onExplore={() => setView("explore")}
              onLogin={() => setView("login")}
              onNavigate={(page) => setView(page)}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onLogout={handleLogout}
              lastSchemeResults={lastSchemeResults}
              lastSchemeFormData={lastSchemeFormData}
            />
          )}

          {view === "explore" && (
            <ExploreSchemes
              onBack={() => setView("home")}
              onLogin={() => setView("login")}
              onLocatePartner={(schemeCode) => {
                setSelectedSchemeForPartner(schemeCode);
                setView("partner_locator");
              }}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          )}

          {view === "login" && (
            <AuthPage
              mode="login"
              onBack={() => setView("home")}
              onLogin={handleLogin}
              onSignup={() => setView("signup")}
            />
          )}

          {view === "signup" && (
            <AuthPage
              mode="signup"
              onBack={() => setView("home")}
              onLogin={() => setView("login")}
              onSignupSuccess={handleLogin}
            />
          )}

          {view === "finder" && (
            <SchemeFinder
              onBack={() => setView("home")}
              onNavigate={(page) => setView(page)}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onResultsReady={(results, formData) => {
                setLastSchemeResults(results);
                setLastSchemeFormData(formData);
                apiCache.saveRecommendations(results, formData);
              }}
            />
          )}

          {view === "emi_calculator" && (
            <EMICalculator onBack={() => setView("home")} />
          )}

          {view === "partner_locator" && (
            <PartnerLocator
              hideNavbar={true}
              onBack={() => setView("home")}
              onNavigate={(page) => setView(page)}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onLogin={() => setView("login")}
              onLogout={handleLogout}
              initialState=""
              initialDistrict=""
              initialSchemeId={selectedSchemeForPartner || ""}
            />
          )}

          {view === "ai_assistant" && (
            <AIAssistant
              onBack={() => {
                setAiInitialQuery("");
                setView("home");
              }}
              onNavigate={(page) => setView(page)}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              lastSchemeResults={lastSchemeResults}
              lastSchemeFormData={lastSchemeFormData}
              initialQuery={aiInitialQuery}
            />
          )}

          {view === "documents" && (
            <DocumentsPage
              onBack={() => setView("home")}
              onFindScheme={openSchemeFinder}
              lastSchemeResults={lastSchemeResults}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onLogin={() => setView("login")}
              onLogout={handleLogout}
              onNavigate={(page, query = "") => {
                if (query) setAiInitialQuery(query);
                setView(page);
              }}
            />
          )}

          {view === "track_application" && (
            <TrackApplication
              onBack={() => setView("home")}
              initialApplicationId={selectedTrackAppId}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onNavigate={(page, query = "") => {
                if (query) setAiInitialQuery(query);
                setView(page);
              }}
            />
          )}

          {view === "admin_portal" && (
            <AdminPortal
              onBack={() => setView("home")}
              onNavigate={(page) => setView(page)}
            />
          )}

          {view === "recommendations" && (
            <RecommendationsPage
              onBack={() => setView("home")}
              onFindScheme={openSchemeFinder}
              results={lastSchemeResults}
              formData={lastSchemeFormData}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onNavigate={(page, appId = "") => {
                if (appId && page === "track_application") {
                  setSelectedTrackAppId(appId);
                }
                setView(page);
              }}
              onOpenAI={() => setView("ai_assistant")}
              onOpenCalculator={() => setView("emi_calculator")}
              onOpenPartner={() => setView("partner_locator")}
              onSetResults={(newResults, newFormData) => {
                setLastSchemeResults(newResults);
                setLastSchemeFormData(newFormData);
                apiCache.saveRecommendations(newResults, newFormData);
              }}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
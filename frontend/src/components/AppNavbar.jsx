import React, { useState, useMemo } from "react";
import {
  Sparkles,
  UserRound,
  LogIn,
  Menu,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { useLanguage, INDIA_LANGUAGES_LIST } from "../i18n";

const INDIA_LANGUAGES = INDIA_LANGUAGES_LIST.map((lang) => ({
  code: lang.code,
  display: lang.code === "en" ? "English" : `${lang.native} (${lang.name})`,
  name: lang.name,
  native: lang.native,
  dir: lang.dir,
}));

export default function AppNavbar({
  activeView,
  onNavigate,
  isLoggedIn,
  currentUser,
  onLogin,
  onLogout,
}) {
  const { language, setLanguage, isTranslating, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { id: "home", label: t("Home") },
      { id: "explore", label: t("Explore Schemes") },
      { id: "emi_calculator", label: t("Calculator") },
      { id: "partner_locator", label: t("Partner Locator") },
      { id: "documents", label: t("Documents") },
      { id: "track_application", label: t("Track Application") },
      { id: "ai_assistant", label: t("AI Assistant") },
    ],
    [t]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#dce4ec] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[80px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <button
          onClick={() => {
            onNavigate("home");
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 sm:gap-3 text-left transition hover:opacity-90"
        >
          <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center text-[#c6a56b]">
            <div className="absolute inset-1 rotate-45 rounded-[10px] border-[2.5px] sm:border-[3px] border-[#c6a56b]" />
            <Sparkles size={22} strokeWidth={1.8} />
          </div>

          <div>
            <h1 className="font-serif text-[20px] sm:text-[25px] font-bold leading-none tracking-wide text-[#12213c]">
              SCHEME SAATHI
            </h1>
            <p className="mt-1 hidden text-[11px] sm:block sm:text-[12px] font-medium text-[#61738d]">
              {t("Your Government Scheme Companion")}
            </p>
          </div>
        </button>

        <nav className="hidden items-center gap-5 xl:gap-7 lg:flex">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`relative py-3 text-[13px] xl:text-[14px] font-medium transition ${
                  isActive
                    ? "font-semibold text-[#17243b]"
                    : "text-[#4b5d73] hover:text-[#1769a8]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 bg-[#c6a56b]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Select language"
              className="max-w-[130px] sm:max-w-[180px] truncate rounded-lg border border-[#cfd8e3] bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[12px] sm:text-[13px] font-semibold text-[#24344e] outline-none transition hover:bg-[#f5f8fb] focus:border-[#145c91]"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {INDIA_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.display}
                </option>
              ))}
            </select>
            {isTranslating && (
              <Loader2 size={15} className="animate-spin text-[#145c91]" title="Translating..." />
            )}
          </div>

          {isLoggedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex items-center gap-1.5 rounded-lg bg-[#eef7fb] px-3 py-1.5 text-[12px] sm:text-[13px] font-semibold text-[#145c91]">
                <UserRound size={15} />
                <span className="max-w-[100px] truncate">{currentUser?.name || "Account"}</span>
              </div>
              <button
                onClick={onLogout}
                className="rounded-lg border border-[#cfd8e3] px-3 py-1.5 text-[12px] sm:text-[13px] font-semibold text-[#52677d] transition hover:bg-[#f5f8fb] hover:text-[#c53030]"
              >
                {t("Logout")}
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="hidden items-center gap-1.5 rounded-lg border border-[#cfd8e3] px-3.5 py-2 text-[12px] sm:text-[13px] font-semibold text-[#24344e] transition hover:bg-[#f5f8fb] sm:flex"
            >
              <LogIn size={15} />
              {t("Sign In")}
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-[#cfd8e3] text-[#24344e] transition hover:bg-[#f5f8fb] lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-[#e2e8f0] bg-white px-5 py-4 shadow-xl lg:hidden animate-in fade-in duration-200">
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition ${
                    isActive
                      ? "bg-[#eef7fb] font-bold text-[#145c91]"
                      : "text-[#17243b] hover:bg-[#f8fafc]"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <Check size={16} className="text-[#145c91]" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-[#e2e8f0] pt-3">
            {isLoggedIn ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#145c91]">
                  <UserRound size={15} />
                  <span>{currentUser?.name || "Account"}</span>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-lg border border-[#cfd8e3] px-3 py-1.5 text-xs font-semibold text-[#c53030] hover:bg-red-50"
                >
                  {t("Logout")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onLogin();
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#145c91] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#104d7b]"
              >
                <LogIn size={15} />
                {t("Sign In")}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

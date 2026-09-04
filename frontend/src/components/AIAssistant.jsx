import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  UserRound,
  Send,
  Loader2,
  ChevronDown,
  Globe2,
  BookOpen,
  Search,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Calculator,
  MapPin,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "../i18n";
import { API_BASE_URL } from "../config/api";
import { AI_LANGUAGES } from "../data/schemesConstants";

/**
 * Quick prompt suggestions for one-click questions
 */
const QUICK_PROMPTS = [
  { label: "What schemes are available?", query: "What schemes are available in Scheme Saathi?", icon: Sparkles },
  { label: "Income & loan limits", query: "What is the annual income limit and maximum loan amount for schemes?", icon: BookOpen },
  { label: "Women special concessions", query: "What special concessions or benefits exist for women entrepreneurs in Scheme Saathi?", icon: UserRound },
  { label: "Required documents", query: "What documents are required to apply for schemes?", icon: FileText },
  { label: "Calculate loan EMI", query: "How does the EMI calculator work for Scheme Saathi loans?", icon: Calculator },
  { label: "Find nearest Partner", query: "How do I find my nearest Channel Partner or State Channelizing Agency?", icon: MapPin },
];

/**
 * Custom Markdown & rich text formatter for assistant replies
 */
function FormattedContent({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];
  let inBulletList = false;
  let bulletItems = [];
  let inNumberedList = false;
  let numberedItems = [];

  const flushLists = () => {
    if (inBulletList && bulletItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-2 space-y-1.5 pl-0.5">
          {bulletItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#24344d]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#145c91]" />
              <div className="flex-1">{renderInline(item)}</div>
            </li>
          ))}
        </ul>
      );
      bulletItems = [];
      inBulletList = false;
    }
    if (inNumberedList && numberedItems.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-2 space-y-1.5 pl-0.5">
          {numberedItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#24344d]">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#eef7fb] text-[10.5px] font-bold text-[#145c91]">
                {item.num}
              </span>
              <div className="flex-1">{renderInline(item.text)}</div>
            </li>
          ))}
        </ol>
      );
      numberedItems = [];
      inNumberedList = false;
    }
  };

  const renderInline = (text) => {
    if (!text) return null;

    const parts = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Check for link [label](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-semibold text-[#145c91] underline hover:text-[#0c3e66]"
          >
            <span>{linkMatch[1]}</span>
            <ExternalLink size={10} className="inline ml-0.5" />
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Check for bold **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-[#10243d]">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Check for inline code `text`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code key={keyIdx++} className="rounded bg-[#f0f4f8] px-1.5 py-0.5 font-mono text-[12px] text-[#145c91]">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Check for italic *text* or _text_
      const italicMatch = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/);
      if (italicMatch) {
        parts.push(
          <em key={keyIdx++} className="italic text-[#4a5f78]">
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain text chunk
      const nextSpecial = remaining.search(/(\*\*|\*|_|`|\[)/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushLists();
      elements.push(<div key={`empty-${idx}`} className="h-1.5" />);
      return;
    }

    // Horizontal divider
    if (/^---$|^___$|^\*\*\*$/.test(trimmed)) {
      flushLists();
      elements.push(<hr key={`hr-${idx}`} className="my-2.5 border-[#e5ecf0]" />);
      return;
    }

    // Heading level 3
    if (trimmed.startsWith("### ")) {
      flushLists();
      elements.push(
        <h4 key={`h4-${idx}`} className="mt-3 mb-1 font-sans text-[14px] font-bold text-[#14324f]">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    // Heading level 2
    if (trimmed.startsWith("## ")) {
      flushLists();
      elements.push(
        <h3 key={`h3-${idx}`} className="mt-3.5 mb-1.5 font-sans text-[15px] font-bold text-[#10243d]">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    // Heading level 1
    if (trimmed.startsWith("# ")) {
      flushLists();
      elements.push(
        <h2 key={`h2-${idx}`} className="mt-4 mb-2 font-sans text-[16px] font-bold text-[#10243d]">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    // Bullet items
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
    if (bulletMatch) {
      if (inNumberedList) flushLists();
      inBulletList = true;
      bulletItems.push(bulletMatch[1]);
      return;
    }

    // Numbered items
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (inBulletList) flushLists();
      inNumberedList = true;
      numberedItems.push({ num: numMatch[1], text: numMatch[2] });
      return;
    }

    // Regular paragraph
    flushLists();
    elements.push(
      <p key={`p-${idx}`} className="text-[13.5px] leading-relaxed text-[#24344d]">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushLists();

  return <div className="space-y-0.5">{elements}</div>;
}

const detectToolsInText = (text) => {
  if (!text) return {};
  const lower = text.toLowerCase();
  return {
    finder: lower.includes("find my schemes") || lower.includes("check eligibility") || lower.includes("eligibility criteria"),
    explore: lower.includes("explore schemes") || lower.includes("browse all"),
    emi: lower.includes("emi calculator") || lower.includes("calculate emi") || lower.includes("monthly installment"),
    partner: lower.includes("channel partner") || lower.includes("partner locator") || lower.includes("nearest partner") || lower.includes("nearest agency"),
    documents: lower.includes("document checklist") || lower.includes("required documents") || lower.includes("documents page"),
  };
};


export default function AIAssistant({
  onBack,
  onNavigate,
  isLoggedIn,
  currentUser,
  lastSchemeResults,
  lastSchemeFormData,
  initialQuery = "",
}) {
  const { t } = useTranslation();

  const detectNavigationFromText = (responseText) => {
    if (!responseText) return null;
    const navigation = {};
    const lines = responseText.split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-*\u2022\d.]+/, "").trim();
      if (/^find my schemes?$/i.test(cleaned)) {
        navigation.finder = true;
      }
      if (/^explore schemes?$/i.test(cleaned)) {
        navigation.explore = true;
      }
    }
    if (!navigation.finder && !navigation.explore) {
      return null;
    }
    return navigation;
  };

  const getCheckedSchemeNames = () => {
    if (!lastSchemeResults) return [];
    const names = new Set();
    const addSchemes = (list) => {
      if (!Array.isArray(list)) return;
      for (const scheme of list) {
        const name = scheme.scheme_name || scheme.name || "";
        if (name) names.add(name);
      }
    };
    addSchemes(lastSchemeResults.primary?.eligible);
    addSchemes(lastSchemeResults.primary?.ineligible);
    addSchemes(lastSchemeResults.secondary?.eligible);
    addSchemes(lastSchemeResults.secondary?.ineligible);
    return Array.from(names);
  };

  const checkedSchemeNames = getCheckedSchemeNames();
  const hasCheckedSchemes = Boolean(isLoggedIn && lastSchemeResults);

  const buildSchemeContext = () => {
    if (!lastSchemeResults) return null;
    const context = {
      user_profile: lastSchemeFormData
        ? {
            name: currentUser?.name || lastSchemeFormData.fullName || "",
            gender: lastSchemeFormData.gender || "",
            category: lastSchemeFormData.category || "",
            state: lastSchemeFormData.state || "",
            district: lastSchemeFormData.district || "",
            annual_income: lastSchemeFormData.annualIncome || "",
            purpose: lastSchemeFormData.purpose || "",
            business_type: lastSchemeFormData.businessType || "",
            project_cost: lastSchemeFormData.projectCost || "",
            required_loan: lastSchemeFormData.requiredLoan || "",
            education_level: lastSchemeFormData.educationLevel || "",
          }
        : null,
      eligible_schemes: [],
      ineligible_schemes: [],
    };

    if (Array.isArray(lastSchemeResults.primary?.eligible)) {
      context.eligible_schemes = lastSchemeResults.primary.eligible.map((scheme) => ({
        scheme_id: scheme.scheme_id || scheme.id || "",
        scheme_name: scheme.scheme_name || scheme.name || "",
        type: "PRIMARY",
        reasons: scheme.reasons || [],
        financial_terms: scheme.financial_terms || null,
        source: scheme.source || null,
        required_documents: scheme.required_documents || null,
      }));
    }

    if (Array.isArray(lastSchemeResults.primary?.ineligible)) {
      context.ineligible_schemes = lastSchemeResults.primary.ineligible.map((scheme) => ({
        scheme_id: scheme.scheme_id || scheme.id || "",
        scheme_name: scheme.scheme_name || scheme.name || "",
        type: "PRIMARY",
        failures: scheme.failures || [],
      }));
    }

    if (Array.isArray(lastSchemeResults.secondary?.eligible)) {
      context.eligible_schemes = context.eligible_schemes.concat(
        lastSchemeResults.secondary.eligible.map((scheme) => ({
          scheme_id: scheme.scheme_id || scheme.id || "",
          scheme_name: scheme.scheme_name || scheme.name || "",
          type: "SECONDARY_CONNECTED",
          reasons: scheme.reasons || [],
          financial_terms: scheme.financial_terms || null,
          source: scheme.source || null,
          required_documents: scheme.required_documents || null,
        }))
      );
    }

    return context;
  };

  const INITIAL_WELCOME = {
    role: "assistant",
    content:
      "### Welcome to Scheme Saathi AI Assistant! 👋\n\n" +
      "I can help you understand and navigate government concessional schemes under the **National Scheduled Castes Finance and Development Corporation (NSFDC)**, Ministry of Social Justice and Empowerment.\n\n" +
      "You can ask me anything about:\n" +
      "- **Schemes & Credit Limits**: Micro Finance Scheme (MFS), Term Loans (up to ₹45L), Educational Loans (up to ₹40L), Udyam Nidhi, and VISVAS interest subvention\n" +
      "- **Eligibility Criteria**: Family income limits (up to ₹5 Lakh), caste certificate rules, age guidelines\n" +
      "- **Women Entrepreneur Concessions**: Earmarked funds (40% under MFS) and special interest concessions (6% on Term Loans)\n" +
      "- **Financial & EMI Calculations**: Moratorium periods, repayment schedules, and interest rates\n" +
      "- **Application Process & Documents**: How to apply via State Channelizing Agencies (SCAs) and document checklist\n\n" +
      "What would you like to explore today?",
  };

  const [messages, setMessages] = useState([INITIAL_WELCOME]);
  const [input, setInput] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const initialSentRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const handleResetChat = () => {
    setMessages([INITIAL_WELCOME]);
    setError(null);
    setInput("");
  };

  const handleCopy = (text, index) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sendMessage = async (overrideText) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || loading) return;

    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: trimmed,
      },
    ]);

    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);


    try {
      const token = localStorage.getItem("scheme_saathi_token");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/assistant`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          language: selectedLanguage,
          scheme_context: buildSchemeContext(),
        }),
      });

      if (!response.ok) {
        let errorMessage = "AI Assistant is temporarily unavailable.";
        try {
          const errorData = await response.json();
          if (errorData?.detail) {
            errorMessage = String(errorData.detail);
          }
        } catch {
          // Keep default message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const assistantMessage = {
        role: "assistant",
        content: data.reply || "I could not generate a response. Please try again.",
        structured: {
          primary_recommendation: data.primary_recommendation,
          other_eligible_schemes: data.other_eligible_schemes,
          out_of_scope_schemes: data.out_of_scope_schemes,
          emi_projection: data.emi_projection,
          matched_channel_partners: data.matched_channel_partners,
          ineligibility_explanations: data.ineligibility_explanations,
          application_guidance: data.application_guidance,
          disclaimer: data.disclaimer,
        },
        navigation: data.navigation || detectNavigationFromText(data.reply),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.language_used && data.language_used !== selectedLanguage) {
        setSelectedLanguage(data.language_used);
      }
    } catch (err) {
      const isTimeout = err?.name === "AbortError";
      setError(
        isTimeout
          ? t("Request timed out. The AI service took too long to respond. Please try again.")
          : (err instanceof Error
              ? err.message
              : t("Unable to connect to the AI Assistant. Please try again."))
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isTimeout
            ? "Your request timed out. Please try sending a shorter question or try again."
            : "I am unable to process your request at this time. The AI service may be temporarily unavailable. Please try again.",
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialQuery && !initialSentRef.current) {
      initialSentRef.current = true;
      sendMessage(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const currentLanguage =
    AI_LANGUAGES.find((language) => language.code === selectedLanguage)?.display || "English";

  return (
    <div className="flex h-screen flex-col bg-[#f4f8fb]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#dce4ea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft size={16} />
            <span>{t("Back")}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef7fb] text-[#145c91]">
              <Bot size={18} />
            </div>

            <div>
              <p className="font-serif text-[17px] font-bold tracking-wide text-[#172a43]">
                SCHEME SAATHI
              </p>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#8090a0]">
                {t("AI Assistant")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* New Chat button */}
            <button
              onClick={handleResetChat}
              className="flex items-center gap-1.5 rounded-lg border border-[#cfd8e3] bg-white px-3 py-2 text-[12px] font-semibold text-[#45576d] transition hover:bg-[#f5f8fb] hover:text-[#145c91]"
              title={t("Start new chat")}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">{t("New Chat")}</span>
            </button>

            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu((previous) => !previous)}
                className="flex items-center gap-2 rounded-lg border border-[#cfd8e3] bg-white px-3 py-2 text-[12px] font-semibold text-[#24344e] transition hover:bg-[#f5f8fb]"
              >
                <Globe2 size={14} />
                <span className="hidden sm:inline">{currentLanguage}</span>
                <ChevronDown size={12} />
              </button>


            {showLangMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-[320px] w-[220px] overflow-y-auto rounded-xl border border-[#d5e0e7] bg-white shadow-lg">
                {AI_LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      setSelectedLanguage(language.code);
                      setShowLangMenu(false);
                    }}
                    className={[
                      "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] transition hover:bg-[#f0f6fa]",
                      selectedLanguage === language.code
                        ? "bg-[#eef7fb] font-bold text-[#145c91]"
                        : "text-[#34475d]",
                    ].join(" ")}
                  >
                    {selectedLanguage === language.code && (
                      <span className="text-[#145c91]">✓</span>
                    )}
                    <span>{language.display}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>


      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[800px] space-y-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={[
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start",
              ].join(" ")}
            >
              {message.role === "assistant" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#145c91] text-white">
                  <Bot size={18} />
                </div>
              )}

              <div
                className={[
                  "max-w-[75%] rounded-2xl px-5 py-3.5 text-[14px] leading-6",
                  message.role === "user"
                    ? "rounded-br-md bg-[#145c91] text-white"
                    : "rounded-bl-md border border-[#dce4ea] bg-white text-[#1e3048] shadow-sm",
                ].join(" ")}
              >
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{message.content}</div>
                ) : (
                  <div>
                    <FormattedContent content={message.content} />
                    <div className="mt-2.5 flex items-center justify-end border-t border-[#f0f4f7] pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(message.content, index)}
                        className="flex items-center gap-1 text-[11px] font-medium text-[#7a8c9e] hover:text-[#145c91] bg-[#f5f8fb] hover:bg-[#eaf1f7] px-2 py-1 rounded-md transition"
                        title={t("Copy response")}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check size={12} className="text-green-600" />
                            <span className="text-green-600 font-semibold">{t("Copied!")}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>{t("Copy")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}


                {message.role === "assistant" && index === 0 && onNavigate && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate("explore")}
                      className="flex items-center gap-1.5 rounded-lg border border-[#d4e8d4] bg-[#f0f8f0] px-3 py-2 text-[12px] font-semibold text-[#3d7a42] transition hover:bg-[#e4f2e4]"
                    >
                      <BookOpen size={13} />
                      {t("Explore Schemes")}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isLoggedIn) {
                          onNavigate("finder");
                        } else {
                          onNavigate("login");
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-[#dce4ea] bg-[#f7fafc] px-3 py-2 text-[12px] font-semibold text-[#145c91] transition hover:bg-[#eef7fb]"
                    >
                      <Search size={13} />
                      {t("Find My Schemes")}
                    </button>
                  </div>
                )}

                {message.structured && (
                  <div className="mt-4 space-y-3">
                    {/* Best-fit recommendation */}
                    {message.structured.primary_recommendation && (
                      <div className="rounded-xl border border-[#d4e8d4] bg-[#f0f8f0] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d7a42]">
                            {t("Best Fit")}
                          </p>

                          {message.structured.primary_recommendation.score != null && (
                            <span className="rounded-full bg-[#3d7a42] px-2.5 py-0.5 text-[10px] font-bold text-white">
                              AI Score: {message.structured.primary_recommendation.score}/100
                            </span>
                          )}
                        </div>

                        <p className="mt-1 font-serif text-[16px] font-bold text-[#1d3a22]">
                          {message.structured.primary_recommendation.scheme_name}
                        </p>

                        {message.structured.primary_recommendation.reasons?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.structured.primary_recommendation.reasons.map((reason, rIdx) => (
                              <div
                                key={rIdx}
                                className="flex items-start gap-2 text-[12px] text-[#4a6b4e]"
                              >
                                <span className="mt-0.5 shrink-0">✓</span>
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {message.structured.primary_recommendation.official_url && (
                          <a
                            href={message.structured.primary_recommendation.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex text-[11px] text-[#145c91] underline"
                          >
                            {t("Official Website")} ↗
                          </a>
                        )}
                      </div>
                    )}

                    {/* Other eligible schemes */}
                    {message.structured.other_eligible_schemes?.length > 0 && (
                      <div className="rounded-xl border border-[#dce4ea] bg-[#f7fafc] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7a8998]">
                          {t("Other Eligible Options")}
                        </p>

                        <div className="mt-2 space-y-2">
                          {message.structured.other_eligible_schemes.map((scheme, sIdx) => (
                            <div
                              key={sIdx}
                              className="rounded-lg bg-white px-3 py-2 text-[12px]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <span className="font-bold text-[#145c91]">
                                    {scheme.rank || sIdx + 1}.
                                  </span>
                                  <span className="font-semibold text-[#43566f]">
                                    {scheme.scheme_name}
                                  </span>
                                </div>

                                {scheme.score != null && (
                                  <span className="rounded-full bg-[#eef7fb] px-2 py-0.5 text-[10px] font-bold text-[#145c91]">
                                    {scheme.score}/100
                                  </span>
                                )}
                              </div>

                              {scheme.official_url && (
                                <a
                                  href={scheme.official_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-5 mt-1 inline-flex text-[11px] text-[#145c91] underline"
                                >
                                  {t("Official Website")} ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outside scope */}
                    {message.structured.out_of_scope_schemes?.length > 0 && (
                      <div className="rounded-xl border border-[#e8e0d0] bg-[#fdf8f0] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7a50]">
                          {t("Outside Scheme Saathi Scope")}
                        </p>

                        <div className="mt-2 space-y-2">
                          {message.structured.out_of_scope_schemes.map((scheme, oIdx) => (
                            <div
                              key={oIdx}
                              className="rounded-lg bg-white px-3 py-2 text-[12px]"
                            >
                              <p className="font-semibold text-[#43566f]">
                                {scheme.name}
                              </p>
                              {scheme.reason && (
                                <p className="mt-1 text-[11px] text-[#8a7a50]">
                                  {scheme.reason}
                                </p>
                              )}
                              {scheme.official_url && (
                                <a
                                  href={scheme.official_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex text-[11px] text-[#145c91] underline"
                                >
                                  {t("Official Website")} ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* EMI projection */}
                    {message.structured.emi_projection && (
                      <div className="rounded-xl border border-[#d8dde8] bg-[#f7f8fc] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6a7a8e]">
                          {t("EMI Projection")}
                        </p>

                        <div className="mt-2 grid grid-cols-2 gap-3 text-[12px]">
                          <div>
                            <span className="text-[#7a8998]">{t("Monthly EMI")}:</span>{" "}
                            <strong>
                              ₹{message.structured.emi_projection.monthly_emi}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#7a8998]">{t("Total Interest")}:</span>{" "}
                            <strong>
                              ₹{message.structured.emi_projection.total_interest}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#7a8998]">{t("Total Repayment")}:</span>{" "}
                            <strong>
                              ₹{message.structured.emi_projection.total_repayment}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#7a8998]">{t("Tenure")}:</span>{" "}
                            <strong>
                              {message.structured.emi_projection.tenure_months} {t("months")}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Channel partners */}
                    {message.structured.matched_channel_partners?.length > 0 && (
                      <div className="rounded-xl border border-[#e0d8c8] bg-[#faf8f0] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7a50]">
                          {t("Matched Channel Partners")}
                        </p>

                        <div className="mt-2 space-y-2">
                          {message.structured.matched_channel_partners.map((partner, pIdx) => (
                            <div
                              key={pIdx}
                              className="rounded-lg bg-white p-3 text-[12px]"
                            >
                              <p className="font-bold text-[#2d4050]">
                                {partner.name}
                              </p>
                              <p className="mt-0.5 text-[#718096]">
                                {partner.type}
                                {partner.distance_km != null ? ` • ${partner.distance_km} km` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ineligibility explanations */}
                    {message.structured.ineligibility_explanations?.length > 0 && (
                      <div className="rounded-xl border border-[#f0d4d4] bg-[#fdf5f5] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a04040]">
                          {t("Ineligibility Explanation")}
                        </p>

                        <div className="mt-2 space-y-3">
                          {message.structured.ineligibility_explanations.map((explanation, eIdx) => (
                            <div key={eIdx}>
                              <p className="text-[13px] font-bold text-[#3a2020]">
                                {explanation.scheme_name}
                              </p>

                              {explanation.criterion_status?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {explanation.criterion_status.map((criterion, criterionIndex) => (
                                    <div
                                      key={criterionIndex}
                                      className="flex items-start gap-2 text-[12px]"
                                    >
                                      <span
                                        className={
                                          criterion.satisfied ? "text-green-600" : "text-red-600"
                                        }
                                      >
                                        {criterion.satisfied ? "✓" : "✗"}
                                      </span>
                                      <span>
                                        <strong>{criterion.criterion}:</strong>{" "}
                                        {criterion.user_value} → {criterion.message}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {explanation.failure_reasons?.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {explanation.failure_reasons.map((reason, reasonIndex) => (
                                    <div
                                      key={reasonIndex}
                                      className="flex items-start gap-2 text-[12px] text-[#6a3030]"
                                    >
                                      <span>•</span>
                                      <span>{reason}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Application guidance */}
                    {message.structured.application_guidance?.length > 0 && (
                      <div className="rounded-xl border border-[#d4e2e9] bg-[#f0f6fa] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1769a8]">
                          {t("Application Guidance")}
                        </p>

                        <div className="mt-2 space-y-3">
                          {message.structured.application_guidance.map((guidance, gIdx) => (
                            <div key={gIdx} className="rounded-lg bg-white p-3 text-[12px]">
                              <p className="font-bold text-[#2d4050]">
                                {guidance.scheme_name}
                              </p>

                              {guidance.status === "verified" && guidance.application_steps && (
                                <div className="mt-1 space-y-1">
                                  {guidance.application_steps.map((step, stepIndex) => (
                                    <div
                                      key={stepIndex}
                                      className="flex items-start gap-2 text-[#3a5a3a]"
                                    >
                                      <span className="mt-0.5">✓</span>
                                      <span>
                                        {typeof step === "string"
                                          ? step
                                          : step.description || step.step || JSON.stringify(step)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {guidance.status === "channel_partner_needed" && (
                                <div className="mt-2 rounded-lg border border-[#e8e0d0] bg-[#fdf8f0] p-2">
                                  <p className="text-[11px] font-semibold text-[#8a7a50]">
                                    {guidance.message ||
                                      t("Channel Partner assistance recommended.")}
                                  </p>
                                </div>
                              )}

                              {guidance.status === "partial" && (
                                <p className="mt-1 text-[11px] text-[#718096]">
                                  {guidance.message ||
                                    t("Limited application information available.")}
                                </p>
                              )}

                              {guidance.official_url && (
                                <a
                                  href={guidance.official_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex text-[11px] text-[#145c91] underline"
                                >
                                  {t("Official Website")} ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI disclaimer */}
                    {message.structured.disclaimer && (
                      <div className="rounded-lg border border-[#e3e8ed] bg-[#f8fafb] p-3 text-[10px] leading-4 text-[#8a97a3]">
                        {message.structured.disclaimer}
                      </div>
                    )}
                  </div>
                )}

                {message.role === "assistant" && index === 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasCheckedSchemes && (
                      <button
                        onClick={() => sendMessage("Show me my previous scheme results")}
                        className="rounded-lg border border-[#e0d8c8] bg-[#faf8f0] px-3 py-2 text-[12px] font-semibold text-[#8a7a50] transition hover:bg-[#f5f0e0]"
                      >
                        {t("Previous Results")}
                      </button>
                    )}

                    {hasCheckedSchemes && checkedSchemeNames.length > 0 && (
                      <div className="mt-2 w-full">
                        <p className="mb-1.5 text-[11px] font-semibold text-[#718096]">
                          {t("You previously checked:")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {checkedSchemeNames.map((name) => (
                            <button
                              key={name}
                              onClick={() => sendMessage(`Tell me about ${name}`)}
                              className="rounded-full border border-[#c8d8e8] bg-[#f0f6fb] px-3 py-1.5 text-[11px] font-semibold text-[#145c91] transition hover:bg-[#dceaf5]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isLoggedIn && !hasCheckedSchemes && (
                      <div className="w-full rounded-lg border border-[#e3e8ed] bg-[#f8fafb] px-3 py-2 text-[11px] text-[#718096]">
                        {t("You have not checked any schemes yet. Use Find My Schemes to check your eligibility.")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {message.role === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f3f8] text-[#145c91]">
                  <UserRound size={18} />
                </div>
              )}

              {message.role === "assistant" && onNavigate && (() => {
                const tools = detectToolsInText(message.content);
                const showExplore = message.navigation?.explore || tools.explore;
                const showFinder = message.navigation?.finder || tools.finder;
                const showEmi = tools.emi;
                const showPartner = tools.partner;
                const showDocs = tools.documents;

                if (!showExplore && !showFinder && !showEmi && !showPartner && !showDocs) {
                  return null;
                }

                return (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {showExplore && (
                      <button
                        type="button"
                        onClick={() => onNavigate("explore")}
                        className="flex items-center gap-1.5 rounded-lg border border-[#d4e8d4] bg-[#f0f8f0] px-3 py-1.5 text-[12px] font-semibold text-[#3d7a42] transition hover:bg-[#e4f2e4] shadow-2xs"
                      >
                        <BookOpen size={13} />
                        <span>{t("Explore Schemes")}</span>
                      </button>
                    )}

                    {showFinder && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isLoggedIn) {
                            onNavigate("finder");
                          } else {
                            onNavigate("login");
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#dce4ea] bg-[#f7fafc] px-3 py-1.5 text-[12px] font-semibold text-[#145c91] transition hover:bg-[#eef7fb] shadow-2xs"
                      >
                        <Search size={13} />
                        <span>{t("Find My Schemes")}</span>
                      </button>
                    )}

                    {showEmi && (
                      <button
                        type="button"
                        onClick={() => onNavigate("emi_calculator")}
                        className="flex items-center gap-1.5 rounded-lg border border-[#d8dde8] bg-[#f7f8fc] px-3 py-1.5 text-[12px] font-semibold text-[#4d5e80] transition hover:bg-[#edf0f8] shadow-2xs"
                      >
                        <Calculator size={13} />
                        <span>{t("EMI Calculator")}</span>
                      </button>
                    )}

                    {showPartner && (
                      <button
                        type="button"
                        onClick={() => onNavigate("partner_locator")}
                        className="flex items-center gap-1.5 rounded-lg border border-[#e0d8c8] bg-[#faf8f0] px-3 py-1.5 text-[12px] font-semibold text-[#8a7a50] transition hover:bg-[#f5f0e0] shadow-2xs"
                      >
                        <MapPin size={13} />
                        <span>{t("Partner Locator")}</span>
                      </button>
                    )}

                    {showDocs && (
                      <button
                        type="button"
                        onClick={() => onNavigate("documents")}
                        className="flex items-center gap-1.5 rounded-lg border border-[#dce4ea] bg-[#f7fafc] px-3 py-1.5 text-[12px] font-semibold text-[#34475d] transition hover:bg-[#eef7fb] shadow-2xs"
                      >
                        <FileText size={13} />
                        <span>{t("Documents Page")}</span>
                      </button>
                    )}
                  </div>
                );
              })()}

            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#145c91] text-white">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-[#dce4ea] bg-white px-5 py-3.5 shadow-sm">
                <Loader2 size={16} className="animate-spin text-[#145c91]" />
                <span className="text-[13px] text-[#718096]">{t("Thinking...")}</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
              <span className="mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#dce4ea] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[800px]">
          {/* Quick Action Prompt Chips */}
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PROMPTS.map((qp, qIdx) => {
              const IconComponent = qp.icon;
              return (
                <button
                  key={qIdx}
                  type="button"
                  onClick={() => sendMessage(qp.query)}
                  disabled={loading}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#d3dfe7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#2d4763] shadow-2xs transition hover:border-[#145c91] hover:bg-[#f0f6fb] hover:text-[#145c91] disabled:opacity-50 cursor-pointer"
                >
                  <IconComponent size={12} className="text-[#145c91]" />
                  <span>{t(qp.label)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-end gap-3 rounded-2xl border border-[#ced9e1] bg-white p-2 shadow-sm focus-within:border-[#1769a8] focus-within:ring-4 focus-within:ring-[#1769a8]/10">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("Ask any question about schemes, eligibility, loans, EMI, partners...")}
              rows={1}
              disabled={loading}
              className="min-h-[44px] max-h-[120px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] text-[#1e3048] outline-none placeholder:text-[#a1acb6] disabled:opacity-60"
            />


            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                input.trim() && !loading
                  ? "bg-[#145c91] text-white shadow-md hover:bg-[#104d7b]"
                  : "bg-[#eef3f6] text-[#b6bec7]",
              ].join(" ")}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[10px] text-[#a1acb6]">
              Scheme Saathi AI Assistant
            </p>
            <p className="text-[10px] text-[#a1acb6]">
              Multilingual support
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

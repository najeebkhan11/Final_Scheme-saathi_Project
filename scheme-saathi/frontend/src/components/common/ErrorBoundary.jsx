import React from "react";
import { AlertTriangle, RotateCcw, Home, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Scheme Saathi Application Error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  handleClearCacheAndReset = () => {
    try {
      localStorage.removeItem("scheme_saathi_last_results");
      localStorage.removeItem("scheme_saathi_last_form_data");
      sessionStorage.clear();
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || String(this.state.error) || "Unknown error";
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || "";

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7fafc] px-6 py-12 text-center text-[#10213f]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
            <AlertTriangle size={34} />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold text-[#172a43]">
            Something unexpected occurred
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#61738d]">
            Unable to display this view right now. Your session and saved data are safe. Please choose an option below to continue.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#114b77]"
            >
              <RotateCcw size={16} />
              <span>Reload Application</span>
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex items-center gap-2 rounded-lg border border-[#cbd8e2] bg-white px-5 py-2.5 text-sm font-semibold text-[#30485f] shadow-sm transition hover:bg-[#f1f6fa]"
            >
              <Home size={16} />
              <span>Back to Home</span>
            </button>

            <button
              type="button"
              onClick={this.handleClearCacheAndReset}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
              <span>Clear Cache & Reset</span>
            </button>
          </div>

          {/* Technical Details Collapsible */}
          <div className="mt-8 w-full max-w-xl text-left">
            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              className="flex w-full items-center justify-between rounded-xl border border-[#d8e3ea] bg-white px-4 py-2.5 text-xs font-semibold text-[#5a7086] hover:bg-[#f8fbfd] transition"
            >
              <span>Error Diagnosis: {errorMessage.slice(0, 50)}...</span>
              {this.state.showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {this.state.showDetails && (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50/50 p-4 text-xs font-mono text-red-800 overflow-x-auto max-h-60">
                <p className="font-bold text-red-900 mb-1">{errorMessage}</p>
                {errorStack && (
                  <pre className="text-[11px] text-red-700 whitespace-pre-wrap">{errorStack}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


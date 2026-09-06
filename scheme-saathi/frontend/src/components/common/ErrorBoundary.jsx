import React from "react";
import { AlertTriangle, RotateCcw, Home, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Scheme Saathi Application Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    try {
      window.location.href = window.location.origin;
    } catch {
      window.location.reload();
    }
  };

  handleClearCacheAndReset = () => {
    try {
      localStorage.removeItem("scheme_saathi_recommendations");
      localStorage.removeItem("scheme_saathi_applications");
      sessionStorage.clear();
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || String(this.state.error || "Unknown Application Error");
      const errorStack = this.state.error?.stack || "";

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7fafc] px-6 py-12 text-center text-[#10213f]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
            <AlertTriangle size={34} />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold text-[#172a43]">
            Something unexpected occurred
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#61738d]">
            Unable to display this view right now. Your session and saved data are safe. Please reload or return to home.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-lg bg-[#145c91] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#114b77] cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Reload Application</span>
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="flex items-center gap-2 rounded-lg border border-[#cfdbe3] bg-white px-5 py-3 text-sm font-semibold text-[#253b52] shadow-sm transition hover:bg-[#f7fafc] cursor-pointer"
            >
              <Home size={16} />
              <span>Back to Home</span>
            </button>
            <button
              type="button"
              onClick={this.handleClearCacheAndReset}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-5 py-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100/60 cursor-pointer"
            >
              <Trash2 size={16} />
              <span>Clear Cache & Reset</span>
            </button>
          </div>

          {/* Collapsible Error Diagnosis */}
          <div className="mt-8 w-full max-w-xl text-left">
            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              className="flex w-full items-center justify-between rounded-xl border border-[#d8e3ea] bg-white px-4 py-2.5 text-xs font-semibold text-[#5a7086] hover:bg-[#f8fbfd] transition cursor-pointer"
            >
              <span>Error Details: {errorMessage.slice(0, 60)}</span>
              {this.state.showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {this.state.showDetails && (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs font-mono text-red-800 overflow-x-auto max-h-60">
                <p className="font-bold text-red-900 mb-2">{errorMessage}</p>
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


import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7fafc] px-6 text-center text-[#10213f]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
            <AlertTriangle size={34} />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold text-[#172a43]">
            Something unexpected occurred
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#61738d]">
            Unable to display this view right now. Your session and saved data are safe. Please reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-6 flex items-center gap-2 rounded-lg bg-[#145c91] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#114b77]"
          >
            <RotateCcw size={16} />
            <span>Reload Application</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

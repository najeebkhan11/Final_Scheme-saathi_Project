/**
 * Scheme Saathi - Centralized API Configuration
 * Automatically resolves the backend URL based on environment or window location.
 */

const getApiBaseUrl = () => {
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Local Vite dev server (e.g. port 5173 or 3000) connecting to backend on 8000
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      if (window.location.port && window.location.port !== "8000" && window.location.port !== "80") {
        return `http://${hostname}:8000`;
      }
      return "";
    }
    // Production deployments (Vercel, custom domain, Docker) - use relative origin
    return "";
  }

  return "";
};

export const API_BASE_URL = getApiBaseUrl();

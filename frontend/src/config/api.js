/**
 * Scheme Saathi - Centralized API Configuration
 * Automatically resolves the backend URL based on environment or window location.
 */

const getApiBaseUrl = () => {
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }

  // Match hostname to prevent cross-origin or mixed localhost/127.0.0.1 issues
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:8000`;
    }
  }

  return "http://localhost:8000";
};

export const API_BASE_URL = getApiBaseUrl();

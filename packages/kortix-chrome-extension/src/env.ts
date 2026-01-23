/**
 * Centralized Environment Variable Handler for Kortix Extension
 * 
 * This file pulls variables from Vite (import.meta.env) and provides
 * a typed, validated interface for the rest of the application.
 */

export const ENV = {
    // These MUST be provided at build time via .env or environment variables
    FRONTEND_URL: '__FRONTEND_URL__',
    BACKEND_URL: '__BACKEND_URL__',
    IS_DEV: !chrome.runtime.getManifest().update_url,
};

// Validation/Derivation helpers
export const getApiUrl = () => {
    const url = ENV.BACKEND_URL;
    if (!url) return '';
    return url.endsWith('/v1') ? url.slice(0, -3) : url;
};

export const getWsUrl = () => {
    if (!ENV.BACKEND_URL) return '';
    return ENV.BACKEND_URL.replace(/^http/, 'ws') + '/ws/extension';
};

export const getFrontendOrigin = () => {
    try {
        if (!ENV.FRONTEND_URL) return '';
        return new URL(ENV.FRONTEND_URL).origin;
    } catch {
        return ENV.FRONTEND_URL;
    }
};

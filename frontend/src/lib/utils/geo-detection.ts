/**
 * Geo-detection utilities for language detection based on location
 * Uses timezone as a proxy for geographic location (no API calls needed)
 */

// Hardcoded values since i18n module was removed
export const locales = ['en'] as const;
export const defaultLocale = 'en';
export type Locale = (typeof locales)[number];

/**
 * Maps timezone regions to likely languages
 * This is a heuristic - users can always override manually
 */
/**
 * Maps timezone regions to likely languages
 * This is a heuristic - users can always override manually
 */
// const TIMEZONE_TO_LOCALE_MAP: Record<string, Locale> = { ... } // Removed for single-language support

/**
 * Detects locale based on browser timezone
 * Returns null if no match found
 */
export function detectLocaleFromTimezone(): Locale | null {
  // Since we only support English, we can just return the default locale
  return defaultLocale;
}

/**
 * Detects locale from browser language (Accept-Language header)
 */
export function detectLocaleFromBrowser(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Log browser language info for debugging
    console.log('🌍 Browser navigator.language:', navigator.language);
    console.log('🌍 Browser navigator.languages:', navigator.languages);

    const browserLang = navigator.language.split('-')[0].toLowerCase();
    if (locales.includes(browserLang as Locale)) {
      console.log('🌍 Matched browser language:', browserLang);
      return browserLang as Locale;
    }

    // Try full language code (e.g., "de-DE", "it-IT")
    const fullLang = navigator.language.toLowerCase();
    for (const locale of locales) {
      if (fullLang.startsWith(locale)) {
        console.log('🌍 Matched browser language (full code):', locale);
        return locale;
      }
    }

    console.log('🌍 No match found for browser language');
    return null;
  } catch (error) {
    console.warn('Failed to detect locale from browser:', error);
    return null;
  }
}

/**
 * Gets the best locale match based on multiple detection methods
 * Priority: timezone > browser language > default
 */
export function detectBestLocale(): Locale {
  // Try timezone first (more accurate for geo-detection)
  const timezoneLocale = detectLocaleFromTimezone();
  if (timezoneLocale) {
    return timezoneLocale;
  }

  // Fallback to browser language
  const browserLocale = detectLocaleFromBrowser();
  if (browserLocale) {
    return browserLocale;
  }

  // Default fallback
  return defaultLocale;
}


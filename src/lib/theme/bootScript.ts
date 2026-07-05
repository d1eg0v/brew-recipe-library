/**
 * Inline boot script. Runs synchronously in <head> before first paint so the
 * correct `data-theme` attribute is on <html> by the time the browser styles
 * the page. Wrapped in an IIFE so it doesn't leak a `theme` global.
 *
 * Keep this string in lock-step with `resolveInitialTheme` from
 * `src/lib/theme/themes.ts`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k="brew-theme";var s=window.localStorage;var v=null;if(s){try{v=s.getItem(k)}catch(e){v=null}}var ok=v==="light"||v==="sepia"||v==="dark"||v==="midnight";if(!ok){var m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)");v=m&&m.matches?"dark":"light"}document.documentElement.setAttribute("data-theme",v)}catch(e){}})();`;
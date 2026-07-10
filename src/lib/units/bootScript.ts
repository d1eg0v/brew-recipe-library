/**
 * Inline boot script. Runs synchronously in <head> before first paint so the
 * correct `data-units` attribute is on <html> by the time the browser styles
 * the page and so client components can read the stored preference during
 * their mount-time effect. Wrapped in an IIFE so it doesn't leak globals.
 *
 * Keep this string in lock-step with `resolveInitialUnitSystem` from
 * `./units.ts`.
 */
export const UNIT_BOOT_SCRIPT = `(function(){try{var k="brew-units";var s=window.localStorage;var v=null;if(s){try{v=s.getItem(k)}catch(e){v=null}}var ok=v==="metric"||v==="imperial";if(!ok){v="metric"}document.documentElement.setAttribute("data-units",v)}catch(e){}})();`;
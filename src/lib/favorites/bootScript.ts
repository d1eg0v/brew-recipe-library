/**
 * Inline boot script for the favorites set (BRE-46). Runs synchronously in
 * `<head>` before first paint so the server-rendered card grid can render
 * without a flash of "wrong" stars. We don't have any DOM mutation to do
 * here (no `data-favorites` attribute is read by CSS), but the script primes
 * a defensive guard so the first paint matches what React will hydrate:
 *   - Sets `<html data-favorites-count>` to the size of the stored set so a
 *     hypothetical CSS hook can hide / show overlay state.
 *   - Wraps everything in a `try { … } catch {}` so a broken localStorage
 *     (private mode, sandboxed iframe) doesn't block page boot.
 *
 * Keep this string in lock-step with `readFavorites` in `./favorites.ts`.
 */
export const FAVORITES_BOOT_SCRIPT = `(function(){try{var k="brew-favorites";var s=window.localStorage;var raw=null;if(s){try{raw=s.getItem(k)}catch(e){raw=null}}var ids=[];if(raw){try{var p=JSON.parse(raw);if(p&&Array.isArray(p)){var seen={};for(var i=0;i<p.length;i++){var v=p[i];if(typeof v==="string"){var t=v.trim();if(t&&!seen[t]){seen[t]=true;ids.push(t}}}}}catch(e){ids=[]}}document.documentElement.setAttribute("data-favorites-count",String(ids.length))}catch(e){}})();`;

/** Storage that cannot take the site down.
 *
 *  In an iOS in-app webview (Discord, GroupMe, iMessage), in Safari Private
 *  Browsing and under Lockdown Mode, merely READING window.localStorage can
 *  throw a SecurityError. Any module that touches it at import time, or during
 *  the first render, kills hydration: the server HTML is still on screen, so
 *  the page looks fine while every button is dead.
 *
 *  This installs an in-memory fallback the first moment it is safe to do so,
 *  before any application or vendor module runs. Losing persistence is
 *  acceptable. A dead site is not. */
export const SAFE_STORAGE_SNIPPET = `(function(){
  try {
    // iOS 15.0 to 15.3 lack Object.hasOwn, which the router calls on every
    // route match. Without it the first navigation throws.
    if (typeof Object.hasOwn !== 'function') {
      Object.defineProperty(Object, 'hasOwn', {
        configurable: true, writable: true,
        value: function(o, k){ return Object.prototype.hasOwnProperty.call(Object(o), k); }
      });
    }
    function memory(){
      var m = Object.create(null);
      return {
        get length(){ return Object.keys(m).length; },
        key: function(i){ var k = Object.keys(m); return i in k ? k[i] : null; },
        getItem: function(k){ return k in m ? m[k] : null; },
        setItem: function(k, v){ m[k] = String(v); },
        removeItem: function(k){ delete m[k]; },
        clear: function(){ m = Object.create(null); }
      };
    }
    ['localStorage','sessionStorage'].forEach(function(name){
      var ok = false;
      try {
        var s = window[name];
        var probe = '__pcu_probe__';
        s.setItem(probe, '1');
        s.removeItem(probe);
        ok = true;
      } catch (e) { ok = false; }
      if (!ok) {
        try {
          Object.defineProperty(window, name, {
            configurable: true,
            value: memory()
          });
        } catch (e) { /* nothing further we can do; callers must still guard */ }
      }
    });
  } catch (e) { /* never let the shim itself break the page */ }
})();`;

/** Guarded accessors for app code. Returns null when storage is unusable. */
export function safeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function safeGet(kind: "local" | "session", key: string): string | null {
  try {
    return safeStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSet(kind: "local" | "session", key: string, value: string): void {
  try {
    safeStorage(kind)?.setItem(key, value);
  } catch {
    /* quota, private mode, or a blocked webview: the value is simply lost */
  }
}

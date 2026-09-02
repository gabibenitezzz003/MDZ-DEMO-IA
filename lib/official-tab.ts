/** Keep a handle to an official-site tab opened during a user gesture (survives popup blockers). */

let officialWin: Window | null = null;

declare global {
  interface Window {
    __demoLastOfficialOpen?: { url: string; at: number };
  }
}

function markOpened(url: string) {
  window.__demoLastOfficialOpen = { url, at: Date.now() };
}

export function primeOfficialTab() {
  if (typeof window === "undefined") return;
  try {
    // Must run in the same tick as a click / keypress.
    const w = window.open("about:blank", "demo-agricultura-oficial");
    if (w) {
      officialWin = w;
      try {
        w.document.title = "Abriendo sitio oficial…";
      } catch {
        // cross-origin once navigated
      }
    } else {
      officialWin = null;
    }
  } catch {
    officialWin = null;
  }
}

/**
 * Open (or navigate) the official tab.
 * Returns false when the browser blocked the popup — caller should show a clickable CTA.
 */
export function navigateOfficialTab(url: string): boolean {
  if (typeof window === "undefined" || !url) return false;
  const recent = window.__demoLastOfficialOpen;
  if (recent?.url === url && Date.now() - recent.at < 8_000) return true;

  try {
    if (officialWin && !officialWin.closed) {
      officialWin.location.href = url;
      officialWin.focus();
      markOpened(url);
      return true;
    }
  } catch {
    officialWin = null;
  }

  try {
    const named = window.open(url, "demo-agricultura-oficial");
    if (named) {
      officialWin = named;
      markOpened(url);
      try {
        named.focus();
      } catch {
        // ignore
      }
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

/** Call from a real click handler (toast / tour choice) — most reliable. */
export function openOfficialFromUserGesture(url: string): boolean {
  if (typeof window === "undefined" || !url) return false;
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    // Algunos navegadores devuelven null por noopener aunque abren la pestaña.
    markOpened(url);
    if (w) {
      officialWin = w;
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

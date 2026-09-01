/** Keep a handle to an official-site tab opened during a user gesture (survives popup blockers). */

let officialWin: Window | null = null;

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

  try {
    if (officialWin && !officialWin.closed) {
      officialWin.location.href = url;
      officialWin.focus();
      return true;
    }
  } catch {
    officialWin = null;
  }

  try {
    const named = window.open(url, "demo-agricultura-oficial");
    if (named) {
      officialWin = named;
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

  try {
    const blank = window.open(url, "_blank");
    if (blank) {
      officialWin = blank;
      try {
        blank.focus();
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
    if (w) {
      officialWin = w;
      return true;
    }
  } catch {
    // ignore
  }
  // Last resort: top-level navigation via temporary anchor (still needs gesture).
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

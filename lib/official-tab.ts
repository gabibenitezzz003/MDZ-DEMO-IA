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

/*
 * Acá vivía primeOfficialTab(): abría un about:blank en el mismo tick del click
 * para reservar la pestaña antes de que el bloqueador de popups pudiera
 * impedirlo. El costo era peor que el problema — aparecía una pestaña en blanco
 * cada vez que alguien tocaba "Demo 3 min" o un chip, aunque el recorrido no
 * terminara saliendo al sitio oficial nunca.
 *
 * Se eliminó en vez de sólo dejar de llamarla: ya había vuelto una vez, porque
 * quitar una de las tres llamadas dejó las otras dos vivas. Sin la función, no
 * hay dónde reintroducirla por descuido.
 *
 * El camino bueno ya existía: si navigateOfficialTab() devuelve false porque el
 * navegador bloqueó el popup, se emite `demo:official-toast` con blocked:true y
 * OfficialToast muestra el CTA, que abre desde un click real.
 */

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

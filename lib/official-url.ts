/** Dominios HTTPS permitidos para open_external y validación server-side. */

import catalog from "@/content/site-catalog.json";

const OFFICIAL_SUFFIXES = ["mendoza.gov.ar", "mendoza.gob.ar"];

const CATALOG_URLS = new Set<string>(
  [
    catalog.sourceUrl,
    ...catalog.sections.map((s) =>
      "externalUrl" in s && s.externalUrl ? String(s.externalUrl) : ""
    ),
  ]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, ""))
);

function normalizeUrl(raw: string) {
  return raw.replace(/\/$/, "");
}

/** URLs del catálogo de la demo (incluye Looker, NotebookLM, etc.). */
export function isCatalogExternalUrl(raw: unknown): boolean {
  try {
    const url = new URL(String(raw || ""));
    const norm = normalizeUrl(url.toString());
    for (const allowed of CATALOG_URLS) {
      const base = normalizeUrl(allowed);
      if (norm === base || norm.startsWith(`${base}/`) || norm.startsWith(`${base}#`)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function isAllowedOfficialUrl(raw: unknown): boolean {
  if (isCatalogExternalUrl(raw)) return true;
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "wa.me" ||
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com")
    ) {
      return true;
    }
    return OFFICIAL_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

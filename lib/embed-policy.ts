/** Mendoza portals block iframes — never show an empty fullscreen visor for them. */

const BLOCKED_HOST_PARTS = [
  "mendoza.gob.ar",
  "mendoza.gov.ar",
  "sia.mendoza",
];

export function isUnembeddableOfficial(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_PARTS.some((p) => host.includes(p));
  } catch {
    return true;
  }
}

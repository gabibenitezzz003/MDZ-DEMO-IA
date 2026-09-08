/** Open official resources without trapping the user in a blank iframe wall. */

import { isUnembeddableOfficial } from "@/lib/embed-policy";
import { navigateOfficialTab } from "@/lib/official-tab";

declare global {
  interface Window {
    __demoResourceViewerOpen?: boolean;
    __demoResourceViewerUrl?: string;
  }
}

/** El usuario pide explícitamente abrir un recurso externo. */
const RECURSO_OFICIAL =
  /\b(abri|abrir|abrime|abre|abrimelo|mostrame|muestrame|muestreme|llevame|lleveme|mandame|mandemelo|pasame)\b.{0,18}\b(el\s+)?(link|enlace|sitio|pagina|página|portal|recurso|oficial|informe|informes)\b/;

/** Reintento cuando el navegador bloqueó la pestaña. */
const NO_SE_ABRIO =
  /(no se abrio|no se abrió|no abrio|no abrió|no aparecio|no apareció|no se pudo abrir|se abrio nada|se abrió nada)/;

export function wantsOpenResource(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\b(rut|wizard|declaracion)\b/.test(text) &&
    !/informe|sia|oficial|whatsapp|wsp|wasap/.test(text)
  ) {
    return false;
  }
  return (
    NO_SE_ABRIO.test(text) ||
    RECURSO_OFICIAL.test(text) ||
    /\brecurso oficial\b/.test(text)
  );
}

export function closeResourceViewer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("demo:close-resource"));
}

export function resourceViewerIsOpen() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__demoResourceViewerOpen);
}

export type OpenResourceResult = "embed" | "tab" | "blocked" | "noop";

/**
 * Mendoza portals block iframes → always open a real tab + toast.
 * Never leave the user on a blank fullscreen wall.
 */
export function openResourceUrl(
  url: string,
  opts?: {
    redirect?: boolean;
    sectionId?: string;
    title?: string;
    forceTab?: boolean;
  }
): OpenResourceResult {
  if (!url || typeof window === "undefined") return "noop";

  const title =
    opts?.title ||
    (opts?.sectionId ? `Oficial · ${opts.sectionId}` : "Sitio oficial");

  const useTab =
    opts?.forceTab !== false &&
    (opts?.forceTab === true ||
      opts?.redirect !== false ||
      isUnembeddableOfficial(url));

  if (useTab || isUnembeddableOfficial(url)) {
    const opened = navigateOfficialTab(url);
    window.dispatchEvent(
      new CustomEvent("demo:official-toast", {
        detail: {
          url,
          title,
          sectionId: opts?.sectionId,
          blocked: !opened,
        },
      })
    );
    closeResourceViewer();
    return opened ? "tab" : "blocked";
  }

  window.dispatchEvent(
    new CustomEvent("demo:open-resource", {
      detail: {
        url,
        sectionId: opts?.sectionId,
        title,
      },
    })
  );
  return "embed";
}

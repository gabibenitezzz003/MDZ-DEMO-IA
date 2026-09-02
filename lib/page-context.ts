export type ClientPageContext = {
  pathname?: string;
  hash?: string;
  sectionId?: string;
  sectionTitle?: string;
  sectionBlurb?: string;
  rutStep?: number;
  viewerOpen?: boolean;
  viewerUrl?: string;
  viewerSectionId?: string;
  officialToastOpen?: boolean;
};

export function sectionHashUrl(pathname: string | undefined, target: string) {
  const path = pathname || "/";
  return path === "/" ? `/#${target}` : `${path}#${target}`;
}

export function formatPageContext(ctx?: ClientPageContext | null): string {
  if (!ctx) return "Sin contexto de página.";
  const parts = [
    `pathname=${ctx.pathname || "/"}`,
    `hash=${ctx.hash || "(ninguno)"}`,
    `seccionVisible=${ctx.sectionId || "(desconocida)"}`,
  ];
  if (ctx.sectionTitle) parts.push(`titulo=${ctx.sectionTitle}`);
  if (ctx.sectionBlurb) parts.push(`resumen=${ctx.sectionBlurb}`);
  if (ctx.rutStep) parts.push(`rutPaso=${ctx.rutStep}`);
  parts.push(`visorAbierto=${ctx.viewerOpen ? "si" : "no"}`);
  if (ctx.viewerOpen) {
    parts.push(`visorUrl=${ctx.viewerUrl || "?"}`);
    parts.push(`visorSeccion=${ctx.viewerSectionId || "?"}`);
  }
  return parts.join(" | ");
}

function textOf(el: Element | null | undefined, max = 220): string | undefined {
  const t = el?.textContent?.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function readBrowserPageContext(): ClientPageContext {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.replace(/^#/, "") || undefined;
  const pathname = window.location.pathname;
  const viewerOpen = Boolean(window.__demoResourceViewerOpen);

  let sectionId = hash;
  let sectionTitle: string | undefined;
  let sectionBlurb: string | undefined;

  const highlighted = document.querySelector<HTMLElement>(".agent-highlight");
  const byId = sectionId
    ? document.querySelector<HTMLElement>(
        `[data-section-id="${sectionId}"], #${CSS.escape(sectionId)}`
      )
    : null;
  // El hash expresa la última navegación confirmada; un highlight anterior
  // puede seguir animándose unos segundos y no debe pisar ese contexto.
  const root = byId || highlighted;

  if (root) {
    sectionId =
      root.dataset.sectionId || root.id || sectionId || undefined;
    sectionTitle = textOf(root.querySelector("h1,h2,h3"), 80);
    sectionBlurb = textOf(
      root.querySelector("p, .text-sm, [data-demo-blurb]"),
      200
    );
  }

  let rutStep: number | undefined;
  if (pathname.startsWith("/ingenieria")) {
    sectionId = sectionId || "ingenieria";
    sectionTitle = sectionTitle || "Ingeniería · ODK Central";
    sectionBlurb =
      sectionBlurb ||
      "Vista técnica: QR de Collect, formularios de Central y tablero simulado.";
  }

  if (pathname.startsWith("/rut")) {
    const active = document.querySelector<HTMLElement>(
      "[data-rut-step].bg-mza-blue, button[aria-current='step']"
    );
    const fromData = active?.dataset?.rutStep;
    const fromText = active?.textContent?.match(/Paso\s*(\d)/i)?.[1];
    const n = Number(fromData || fromText || 0);
    if (n >= 1 && n <= 5) rutStep = n;
    sectionId = sectionId || "rut";
    sectionTitle = sectionTitle || `Wizard RUT · paso ${rutStep || "?"}`;
  }

  return {
    pathname,
    hash,
    sectionId,
    sectionTitle,
    sectionBlurb,
    rutStep,
    viewerOpen,
    viewerUrl: window.__demoResourceViewerUrl,
    viewerSectionId: window.__demoResourceViewerSectionId,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUnembeddableOfficial } from "@/lib/embed-policy";
import { navigateOfficialTab } from "@/lib/official-tab";

type ViewerState = {
  url: string;
  title?: string;
  sectionId?: string;
};

declare global {
  interface Window {
    __demoResourceViewerOpen?: boolean;
    __demoResourceViewerUrl?: string;
    __demoResourceViewerSectionId?: string;
  }
}

/**
 * In-demo iframe only when the remote site allows it.
 * Mendoza portals are handled as real tabs + OfficialToast (never a blank wall).
 */
export function ResourceViewerHost() {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const backStack = useRef<ViewerState[]>([]);
  const forwardStack = useRef<ViewerState[]>([]);

  const syncChrome = useCallback(() => {
    setCanBack(backStack.current.length > 0);
    setCanForward(forwardStack.current.length > 0);
  }, []);

  const syncFlag = useCallback((next: ViewerState | null) => {
    if (typeof window === "undefined") return;
    window.__demoResourceViewerOpen = Boolean(next);
    window.__demoResourceViewerUrl = next?.url;
    window.__demoResourceViewerSectionId = next?.sectionId;
  }, []);

  const closeViewer = useCallback(() => {
    backStack.current = [];
    forwardStack.current = [];
    setViewer(null);
    setLoading(false);
    syncFlag(null);
    syncChrome();
  }, [syncChrome, syncFlag]);

  const show = useCallback(
    (next: ViewerState, opts?: { fromBack?: boolean; fromForward?: boolean }) => {
      // Hard guard: never fullscreen-blank gobierno sites.
      if (isUnembeddableOfficial(next.url)) {
        navigateOfficialTab(next.url);
        window.dispatchEvent(
          new CustomEvent("demo:official-toast", {
            detail: next,
          })
        );
        closeViewer();
        return;
      }

      setViewer((current) => {
        if (current?.url && current.url !== next.url) {
          if (opts?.fromBack) forwardStack.current.push(current);
          else if (opts?.fromForward) backStack.current.push(current);
          else {
            backStack.current.push(current);
            forwardStack.current = [];
          }
        }
        return next;
      });
      setLoading(true);
      syncFlag(next);
      queueMicrotask(() => syncChrome());
    },
    [closeViewer, syncChrome, syncFlag]
  );

  const goBackInViewer = useCallback(() => {
    const prev = backStack.current.pop();
    if (!prev) {
      closeViewer();
      return;
    }
    show(prev, { fromBack: true });
  }, [closeViewer, show]);

  const goForwardInViewer = useCallback(() => {
    const next = forwardStack.current.pop();
    if (!next) return;
    show(next, { fromForward: true });
  }, [show]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ViewerState>).detail;
      if (!detail?.url) return;
      show({
        url: detail.url,
        title: detail.title,
        sectionId: detail.sectionId,
      });
    };
    const onClose = () => closeViewer();
    const onBack = () => goBackInViewer();
    const onForward = () => goForwardInViewer();

    window.addEventListener("demo:open-resource", onOpen);
    window.addEventListener("demo:close-resource", onClose);
    window.addEventListener("demo:resource-back", onBack);
    window.addEventListener("demo:resource-forward", onForward);
    return () => {
      window.removeEventListener("demo:open-resource", onOpen);
      window.removeEventListener("demo:close-resource", onClose);
      window.removeEventListener("demo:resource-back", onBack);
      window.removeEventListener("demo:resource-forward", onForward);
      syncFlag(null);
    };
  }, [closeViewer, goBackInViewer, goForwardInViewer, show, syncFlag]);

  if (!viewer) return null;

  const label =
    viewer.title ||
    (viewer.sectionId ? `Recurso · ${viewer.sectionId}` : "Recurso oficial");

  return (
    <div
      id="demo-resource-viewer"
      className="fixed inset-0 z-[55] flex flex-col bg-slate-100"
      role="dialog"
      aria-label="Visor de recurso"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-mza-blue px-3 py-2 text-white shadow">
        <button
          type="button"
          onClick={goBackInViewer}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
        >
          ← Atrás
        </button>
        <button
          type="button"
          disabled={!canForward}
          onClick={goForwardInViewer}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 disabled:opacity-40"
        >
          Adelante →
        </button>
        <button
          type="button"
          onClick={closeViewer}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
        >
          Cerrar visor
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="truncate text-[10px] text-sky-100">{viewer.url}</p>
        </div>
        <a
          href={viewer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          Abrir en pestaña
        </a>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="absolute inset-x-0 top-0 z-10 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
            Cargando…
          </div>
        ) : null}
        <iframe
          key={viewer.url}
          title={label}
          src={viewer.url}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}

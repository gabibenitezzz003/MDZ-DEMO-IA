"use client";

import { useEffect, useState } from "react";
import { openOfficialFromUserGesture } from "@/lib/official-tab";

type Toast = {
  url: string;
  title?: string;
  sectionId?: string;
  blocked?: boolean;
};

/** Premium floating chip when we open (or need the user to open) the gobierno tab. */
export function OfficialToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Toast>).detail;
      if (!detail?.url) return;
      setToast(detail);
      if (timer) window.clearTimeout(timer);
      // Keep blocked toasts longer so the user can click.
      timer = window.setTimeout(
        () => setToast(null),
        detail.blocked ? 45000 : 18000
      );
    };
    window.addEventListener("demo:official-toast", onToast);
    return () => {
      window.removeEventListener("demo:official-toast", onToast);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  const label =
    toast.title ||
    (toast.sectionId ? `Oficial · ${toast.sectionId}` : "Sitio oficial");

  const openNow = () => {
    openOfficialFromUserGesture(toast.url);
    setToast((prev) => (prev ? { ...prev, blocked: false } : prev));
  };

  return (
    <div
      className={`official-toast fixed bottom-28 left-4 z-[58] w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl ${
        toast.blocked
          ? "border-amber-400 shadow-amber-500/30 ring-2 ring-amber-300/80"
          : "border-white/40 shadow-mza-blue/20"
      }`}
      data-official-toast="1"
    >
      <div className="h-1 w-full bg-gradient-to-r from-mza-blue via-mza-gold to-emerald-500" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mza-blue text-sm font-bold text-white">
            MZA
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-mza-gold">
              Recurso oficial
            </p>
            <p className="truncate text-sm font-semibold text-mza-blue-dark">
              {label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {toast.blocked
                ? "El navegador bloqueó la ventana automática. Tocá el botón azul para abrir el portal real."
                : "Portal del Gobierno. Si no ves la pestaña, tocá Abrir sitio oficial. El asistente sigue acá."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openNow}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-mza-blue-dark ${
              toast.blocked
                ? "animate-pulse bg-amber-600 hover:bg-amber-700"
                : "bg-mza-blue"
            }`}
          >
            Abrir sitio oficial
          </button>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { openOfficialFromUserGesture } from "@/lib/official-tab";

type Toast = {
  url: string;
  title?: string;
  sectionId?: string;
  blocked?: boolean;
};

function isWhatsAppUrl(url: string) {
  return /wa\.me|whatsapp\.com/i.test(url);
}

/** Floating chip when we open (or need the user to open) an external tab. */
export function OfficialToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Toast>).detail;
      if (!detail?.url) return;
      setToast(detail);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(
        () => setToast(null),
        detail.blocked ? 60_000 : 18_000
      );
    };
    window.addEventListener("demo:official-toast", onToast);
    return () => {
      window.removeEventListener("demo:official-toast", onToast);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  const whatsapp = isWhatsAppUrl(toast.url);
  const label =
    toast.title ||
    (whatsapp
      ? "RUT por WhatsApp"
      : toast.sectionId
        ? `Oficial · ${toast.sectionId}`
        : "Sitio oficial");

  const openNow = () => {
    openOfficialFromUserGesture(toast.url);
    setToast((prev) => (prev ? { ...prev, blocked: false } : prev));
  };

  return (
    <div
      className={`official-toast fixed bottom-28 left-4 z-[58] w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl ${
        toast.blocked
          ? whatsapp
            ? "border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-300/80"
            : "border-amber-400 shadow-amber-500/30 ring-2 ring-amber-300/80"
          : "border-white/40 shadow-mza-blue/20"
      }`}
      data-official-toast="1"
    >
      <div
        className={`h-1 w-full bg-gradient-to-r ${
          whatsapp
            ? "from-emerald-500 via-green-400 to-emerald-600"
            : "from-mza-blue via-mza-gold to-emerald-500"
        }`}
      />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
              whatsapp ? "bg-emerald-600" : "bg-mza-blue"
            }`}
          >
            {whatsapp ? "WA" : "MZA"}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                whatsapp ? "text-emerald-700" : "text-mza-gold"
              }`}
            >
              {whatsapp ? "WhatsApp Web" : "Recurso oficial"}
            </p>
            <p className="truncate text-sm font-semibold text-mza-blue-dark">
              {label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {toast.blocked
                ? whatsapp
                  ? "El navegador bloqueó la ventana. Tocá el botón verde «Abrir WhatsApp» — con ese clic sí abre."
                  : "El navegador bloqueó la ventana. Tocá el botón azul «Abrir sitio oficial»."
                : whatsapp
                  ? "WhatsApp listo. Si no ves la pestaña, tocá Abrir WhatsApp."
                  : "Portal del Gobierno. Si no ves la pestaña, tocá Abrir sitio oficial."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openNow}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-md ${
              toast.blocked
                ? whatsapp
                  ? "animate-pulse bg-emerald-600 hover:bg-emerald-700"
                  : "animate-pulse bg-amber-600 hover:bg-amber-700"
                : whatsapp
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-mza-blue hover:bg-mza-blue-dark"
            }`}
          >
            {whatsapp ? "Abrir WhatsApp" : "Abrir sitio oficial"}
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

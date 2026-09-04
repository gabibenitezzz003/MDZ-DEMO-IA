"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Estado = "ok" | "sim" | "off";

type Servicio = {
  id: string;
  nombre: string;
  detalle: string;
  estado: Estado;
};

const BOOT = [
  "Inicializando consola de campo…",
  "Conectando con el agente de WhatsApp…",
  "Cargando catálogo ODK · proyecto 4…",
  "Memoria de sesión y notas: listas.",
  "Sistema operativo. Buenas, ingeniero.",
];

const COLOR: Record<Estado, string> = {
  ok: "bg-emerald-400",
  sim: "bg-amber-400",
  off: "bg-slate-600",
};

const ETIQUETA: Record<Estado, string> = {
  ok: "activo",
  sim: "simulado",
  off: "sin datos",
};

/** Reloj de Mendoza: el técnico está en campo, no en UTC. */
function useRelojMendoza() {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setHora(
        new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/Argentina/Mendoza",
        }).format(new Date())
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return hora;
}

/** Escribe el boot línea por línea. Da la sensación de sistema que arranca. */
function useBootSequence(lineas: readonly string[]) {
  const [visibles, setVisibles] = useState<string[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisibles([...lineas]);
      setListo(true);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setVisibles(lineas.slice(0, i));
      if (i >= lineas.length) {
        window.clearInterval(id);
        setListo(true);
      }
    }, 420);
    return () => window.clearInterval(id);
  }, [lineas]);

  return { visibles, listo };
}

/**
 * La consola y el chat de campo son hermanos dentro de un server component,
 * así que se hablan por evento del DOM en vez de subir estado — mismo patrón
 * que ya usa la demo (`demo:open-resource`, `demo:official-toast`).
 */
function emitirComando(texto: string) {
  window.dispatchEvent(new CustomEvent("campo:comando", { detail: { texto } }));
  document
    .querySelector('[data-section-id="odk-whatsapp"]')
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function FieldConsole({
  formsPublicados,
  onComando = emitirComando,
}: {
  formsPublicados: number;
  onComando?: (texto: string) => void;
}) {
  const hora = useRelojMendoza();
  const { visibles, listo } = useBootSequence(BOOT);
  const [fichas, setFichas] = useState<number | null>(null);
  const [pulso, setPulso] = useState(false);
  const previas = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/odk-inbox", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: unknown[] };
      setFichas(data.items?.length ?? 0);
    } catch {
      // La consola sigue mostrando el resto aunque la bandeja no responda.
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const id = window.setInterval(() => void refrescar(), 4000);
    return () => window.clearInterval(id);
  }, [refrescar]);

  // Destello cuando entra una ficha nueva: el cambio tiene que notarse aunque
  // el ingeniero esté mirando el chat y no el contador.
  useEffect(() => {
    if (fichas == null) return;
    if (previas.current != null && fichas > previas.current) {
      setPulso(true);
      const id = window.setTimeout(() => setPulso(false), 1600);
      previas.current = fichas;
      return () => window.clearTimeout(id);
    }
    previas.current = fichas;
  }, [fichas]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [visibles]);

  const servicios = useMemo<Servicio[]>(
    () => [
      {
        id: "agente",
        nombre: "Agente de campo",
        detalle: "WhatsApp · voz y texto",
        estado: "ok",
      },
      {
        id: "odk",
        nombre: "Catálogo ODK",
        detalle: `${formsPublicados} XForms · proyecto 4`,
        estado: "ok",
      },
      {
        id: "bandeja",
        nombre: "Bandeja de fichas",
        detalle:
          fichas == null
            ? "consultando…"
            : `${fichas} ${fichas === 1 ? "ficha" : "fichas"} en sesión`,
        estado: fichas == null ? "off" : "sim",
      },
      {
        id: "central",
        nombre: "Escritura en Central",
        detalle: "deshabilitada por diseño",
        estado: "off",
      },
    ],
    [formsPublicados, fichas]
  );

  const comandos = [
    "Encontré un olivo abandonado en Rivadavia",
    "Visita de ciruela en floración, Tunuyán",
    "Alta de finca en Maipú, durazno",
    "¿Qué me falta para cerrar la ficha?",
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-900/70 bg-slate-950/80 shadow-[0_0_60px_-25px_rgba(56,189,248,0.5)]">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-900/60 bg-slate-900/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
          </span>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            Consola de campo · ODK
          </p>
        </div>
        <p
          className="font-mono text-[11px] tabular-nums text-slate-400"
          suppressHydrationWarning
        >
          {hora ? `Mendoza ${hora}` : "—"}
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Log de arranque */}
        <div className="border-b border-sky-900/40 p-4 lg:border-b-0 lg:border-r">
          <div
            ref={logRef}
            className="h-[132px] overflow-y-auto rounded-lg bg-black/50 p-3 font-mono text-[12px] leading-relaxed"
          >
            {visibles.map((linea) => (
              <p key={linea} className="text-emerald-300">
                <span className="text-slate-600">›</span> {linea}
              </p>
            ))}
            {listo ? (
              <p className="text-sky-300">
                <span className="text-slate-600">›</span> Decime qué encontraste
                en el lote<span className="animate-pulse">▊</span>
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {comandos.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onComando?.(c)}
                disabled={!onComando}
                className="rounded-full border border-sky-800/80 bg-sky-950/50 px-2.5 py-1 text-[10px] text-sky-200 transition hover:border-sky-500 hover:bg-sky-900/50 disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Estado de servicios */}
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Estado del sistema
          </p>
          <ul className="mt-2.5 space-y-2">
            {servicios.map((s) => (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
                  s.id === "bandeja" && pulso
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {s.nombre}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{s.detalle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${COLOR[s.estado]}`} />
                  <span className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                    {ETIQUETA[s.estado]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

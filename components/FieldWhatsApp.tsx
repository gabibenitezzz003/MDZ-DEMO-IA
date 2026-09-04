"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OdkCampoSubmission } from "@/lib/odk-campo-responder";

type Estado = "enviando" | "enviado" | "recibido" | "leido";
type Adjunto =
  | { tipo: "foto"; etiqueta: string }
  | { tipo: "ubicacion"; lat: number; lon: number; etiqueta: string }
  | { tipo: "audio"; segundos: number };

type Mensaje = {
  id: string;
  autor: "tecnico" | "agente";
  texto: string;
  hora: string;
  estado?: Estado;
  adjunto?: Adjunto;
};

const SUGERENCIAS = [
  "Encontré un olivo abandonado en Rivadavia, al lado de vid",
  "Visita de ciruela industria en floración, Tunuyán",
  "Alta de finca Los Álamos, durazno, orientación norte, Maipú",
];

const hora = () =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Mendoza",
  }).format(new Date());

let contador = 0;
const nuevoId = () => `m${(contador += 1)}`;

/** Doble tilde de WhatsApp: gris al entregar, celeste al leer. */
function Ticks({ estado }: { estado: Estado }) {
  if (estado === "enviando") {
    return (
      <svg viewBox="0 0 16 15" className="h-3.5 w-3.5 text-slate-400/70" aria-label="enviando">
        <circle cx="8" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 4.5v3.2l2 1.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  const leido = estado === "leido";
  return (
    <svg
      viewBox="0 0 18 12"
      className={`h-3.5 w-4 ${leido ? "text-[#53bdeb]" : "text-slate-400/80"}`}
      aria-label={leido ? "leído" : "entregado"}
    >
      <path d="M1 6.2 4.1 9.4 10.2 2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {estado !== "enviado" ? (
        <path d="M6.6 6.2 9.7 9.4 15.8 2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-lg rounded-tl-none bg-[#1f2c34] px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

function AdjuntoVista({ adjunto }: { adjunto: Adjunto }) {
  if (adjunto.tipo === "foto") {
    return (
      <div className="mb-1.5 overflow-hidden rounded-md">
        {/* Miniatura sintética: la demo no sube archivos reales. */}
        <div className="relative h-28 w-44 bg-gradient-to-br from-emerald-800 via-lime-900 to-stone-800">
          <div className="absolute inset-0 opacity-40" aria-hidden>
            <svg viewBox="0 0 176 112" className="h-full w-full">
              <circle cx="40" cy="42" r="17" fill="#3f6212" />
              <circle cx="62" cy="34" r="13" fill="#4d7c0f" />
              <circle cx="120" cy="50" r="20" fill="#365314" />
              <rect y="86" width="176" height="26" fill="#57534e" />
            </svg>
          </div>
          <span className="absolute bottom-1 right-1.5 text-[10px] text-white/80">
            {adjunto.etiqueta}
          </span>
        </div>
      </div>
    );
  }
  if (adjunto.tipo === "ubicacion") {
    return (
      <div className="mb-1.5 overflow-hidden rounded-md">
        <div className="relative h-24 w-44 bg-[#2a3942]">
          <svg viewBox="0 0 176 96" className="h-full w-full" aria-hidden>
            <rect width="176" height="96" fill="#3b4a54" />
            <path d="M0 60 H176 M0 30 H176 M60 0 V96 M118 0 V96" stroke="#4b5c68" strokeWidth="2" />
            <circle cx="88" cy="46" r="7" fill="#00a884" />
            <circle cx="88" cy="46" r="14" fill="#00a884" opacity="0.25" />
          </svg>
          <span className="absolute bottom-1 left-1.5 font-mono text-[9px] text-white/90">
            {adjunto.lat.toFixed(4)}, {adjunto.lon.toFixed(4)}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-1 flex w-44 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00a884] text-slate-950">
        ▶
      </span>
      <svg viewBox="0 0 100 20" className="h-5 flex-1" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => {
          const h = 3 + ((i * 7) % 11);
          return (
            <rect
              key={i}
              x={i * 3.8}
              y={10 - h / 2}
              width="1.8"
              height={h}
              rx="0.9"
              fill="#8696a0"
            />
          );
        })}
      </svg>
      <span className="text-[10px] text-slate-400">0:{String(adjunto.segundos).padStart(2, "0")}</span>
    </div>
  );
}

function Burbuja({ m }: { m: Mensaje }) {
  const mio = m.autor === "tecnico";
  return (
    <div className={`flex ${mio ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[13.5px] leading-[1.35] shadow-sm ${
          mio
            ? "rounded-tr-none bg-[#005c4b] text-slate-50"
            : "rounded-tl-none bg-[#1f2c34] text-slate-100"
        }`}
      >
        {/* Cola de la burbuja: es lo que hace que se lea como WhatsApp. */}
        <span
          aria-hidden
          className={`absolute top-0 h-3 w-3 ${
            mio
              ? "right-[-8px] [clip-path:polygon(0_0,100%_0,0_100%)] bg-[#005c4b]"
              : "left-[-8px] [clip-path:polygon(0_0,100%_0,100%_100%)] bg-[#1f2c34]"
          }`}
        />
        {m.adjunto ? <AdjuntoVista adjunto={m.adjunto} /> : null}
        {m.texto ? <p className="whitespace-pre-wrap pr-12">{m.texto}</p> : null}
        <span className="float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10.5px] text-slate-300/70">
          {m.hora}
          {mio && m.estado ? <Ticks estado={m.estado} /> : null}
        </span>
      </div>
    </div>
  );
}

export function FieldWhatsApp() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: nuevoId(),
      autor: "agente",
      texto:
        "Hablame como en la finca. Una frase alcanza: olivo, visita o cuartel. Mandá foto y ubicación si tenés. Armo una ficha simulada — no es el formulario real de Central.",
      hora: hora(),
    },
  ]);
  const [entrada, setEntrada] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const [stateJson, setStateJson] = useState("");
  const [fichas, setFichas] = useState<OdkCampoSubmission[]>([]);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const refrescarBandeja = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/odk-inbox", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: OdkCampoSubmission[] };
      setFichas(data.items || []);
    } catch {
      // La bandeja puede fallar sin romper el chat.
    }
  }, []);

  useEffect(() => {
    void refrescarBandeja();
    const id = window.setInterval(() => void refrescarBandeja(), 4000);
    return () => window.clearInterval(id);
  }, [refrescarBandeja]);

  useEffect(() => {
    void fetch("/api/agent/whatsapp-odk", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string | null } | null) => setWhatsappUrl(d?.url || ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [mensajes, escribiendo]);

  const marcar = useCallback((id: string, estado: Estado) => {
    setMensajes((prev) => prev.map((m) => (m.id === id ? { ...m, estado } : m)));
  }, []);

  const enviar = useCallback(
    async (texto: string, adjunto?: Adjunto) => {
      const limpio = texto.trim();
      if ((!limpio && !adjunto) || ocupado) return;

      const id = nuevoId();
      setMensajes((prev) => [
        ...prev,
        { id, autor: "tecnico", texto: limpio, hora: hora(), estado: "enviando", adjunto },
      ]);
      setEntrada("");
      setOcupado(true);

      // Progresión de tildes: da la sensación de que el mensaje viaja.
      const t1 = window.setTimeout(() => marcar(id, "enviado"), 220);
      const t2 = window.setTimeout(() => marcar(id, "recibido"), 520);
      const t3 = window.setTimeout(() => {
        marcar(id, "leido");
        setEscribiendo(true);
      }, 780);

      try {
        const res = await fetch("/api/agent/odk-campo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: "demo-campo-ui",
            text: limpio || (adjunto?.tipo === "foto" ? "foto del lote" : "ubicación"),
            stateJson,
            inputType:
              adjunto?.tipo === "foto"
                ? "image"
                : adjunto?.tipo === "ubicacion"
                  ? "location"
                  : "text",
            lat: adjunto?.tipo === "ubicacion" ? adjunto.lat : undefined,
            lon: adjunto?.tipo === "ubicacion" ? adjunto.lon : undefined,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          stateJson?: string;
          submission?: OdkCampoSubmission | null;
        };
        if (data.stateJson) setStateJson(data.stateJson);

        // Espera proporcional al largo: contestar al instante delata al bot.
        const respuesta = data.reply || "Listo.";
        const pensar = Math.min(1500, 320 + respuesta.length * 11);
        await new Promise((r) => window.setTimeout(r, pensar));

        setEscribiendo(false);
        setMensajes((prev) => [
          ...prev,
          { id: nuevoId(), autor: "agente", texto: respuesta, hora: hora() },
        ]);

        if (data.submission) {
          setFichas((prev) => [data.submission as OdkCampoSubmission, ...prev]);
          setFichaAbierta(data.submission.id);
        }
      } catch {
        setEscribiendo(false);
        setMensajes((prev) => [
          ...prev,
          {
            id: nuevoId(),
            autor: "agente",
            texto: "Se cortó el chat de campo. Probá de nuevo.",
            hora: hora(),
          },
        ]);
      } finally {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
        setOcupado(false);
      }
    },
    [ocupado, stateJson, marcar]
  );

  // Comandos disparados desde la consola de arriba.
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => {
    const onComando = (ev: Event) => {
      const texto = (ev as CustomEvent<{ texto?: string }>).detail?.texto;
      if (texto) void enviarRef.current(texto);
    };
    window.addEventListener("campo:comando", onComando);
    return () => window.removeEventListener("campo:comando", onComando);
  }, []);

  const subtitulo = useMemo(() => {
    if (escribiendo) return "escribiendo…";
    if (ocupado) return "en línea";
    return enLinea ? "en línea" : "últ. vez hoy";
  }, [escribiendo, ocupado, enLinea]);

  return (
    <section
      id="odk-whatsapp"
      data-section-id="odk-whatsapp"
      className="border-b border-emerald-900/80 bg-gradient-to-b from-emerald-950/80 to-slate-950 px-4 py-10"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          WhatsApp de campo
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          El formulario se habla. No se rellena.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          El ingeniero manda una frase, una foto o la ubicación. El flujo arma
          una ficha simulada y la bandeja se enciende. No usamos los XForms
          reales ni escribimos en Central.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ── Teléfono ─────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-emerald-900/70 bg-[#0b141a] shadow-2xl">
            <header className="flex items-center gap-3 bg-[#202c33] px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#00a884] text-sm font-bold text-slate-950">
                AM
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-slate-100">
                  Campo · Agricultura Mendoza
                </p>
                <p
                  className={`truncate text-[11px] ${
                    escribiendo ? "text-[#00a884]" : "text-slate-400"
                  }`}
                >
                  {subtitulo}
                </p>
              </div>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-[#00a884]/15 px-2.5 py-1 text-[10px] font-semibold text-[#00a884] hover:bg-[#00a884]/25"
                >
                  Abrir real
                </a>
              ) : null}
            </header>

            {/* Fondo tipo WhatsApp: trama sutil sobre verde oscuro. */}
            <div
              ref={scroller}
              className="h-[400px] space-y-1.5 overflow-y-auto px-3 py-3"
              style={{
                backgroundColor: "#0b141a",
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.022) 1px, transparent 1px), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.022) 1px, transparent 1px)",
                backgroundSize: "34px 34px, 46px 46px",
              }}
            >
              <div className="mx-auto w-fit rounded-md bg-[#182229] px-2.5 py-1 text-[10.5px] text-slate-400">
                HOY
              </div>
              <div className="mx-auto w-fit rounded-md bg-[#182229]/80 px-2.5 py-1 text-center text-[10px] leading-snug text-amber-200/80">
                Chat de demostración · las fichas son simuladas
              </div>

              {mensajes.map((m) => (
                <Burbuja key={m.id} m={m} />
              ))}
              {escribiendo ? <TypingDots /> : null}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-slate-800/80 bg-[#0b141a] px-2.5 py-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void enviar(s)}
                  className="rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-[10px] text-emerald-100 transition hover:border-emerald-500 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-1.5 bg-[#202c33] px-2 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void enviar(entrada);
              }}
            >
              <button
                type="button"
                title="Mandar foto del lote"
                disabled={ocupado}
                onClick={() =>
                  void enviar("", { tipo: "foto", etiqueta: "olivar" })
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
              >
                📎
              </button>
              <button
                type="button"
                title="Compartir ubicación"
                disabled={ocupado}
                onClick={() =>
                  void enviar("", {
                    tipo: "ubicacion",
                    lat: -33.196,
                    lon: -68.468,
                    etiqueta: "Rivadavia",
                  })
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
              >
                📍
              </button>
              <input
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onFocus={() => setEnLinea(true)}
                placeholder="Escribí un mensaje"
                className="min-w-0 flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-[13.5px] text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={ocupado || !entrada.trim()}
                title="Enviar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#00a884] text-slate-950 transition disabled:bg-[#2a3942] disabled:text-slate-500"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px]" fill="currentColor">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </div>

          {/* ── Bandeja ──────────────────────────────────────────────── */}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Bandeja de fichas
              </h3>
              <p className="text-[11px] text-slate-400">
                {fichas.length} {fichas.length === 1 ? "simulada" : "simuladas"}
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {fichas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  Todavía no hay fichas. Mandá una frase en el chat y confirmá:
                  acá aparece el paquete simulado.
                </p>
              ) : (
                fichas.map((f) => (
                  <article
                    key={f.id}
                    className="rounded-lg border border-emerald-800/80 bg-slate-900/80 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{f.formName}</p>
                      <p className="font-mono text-[10px] text-emerald-300">
                        {f.formId} · v{f.version}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-400">
                      {f.channel} · simulada
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                      {Object.entries(f.data).map(([k, v]) => (
                        <li key={k}>
                          <span className="text-slate-500">{k}:</span> {v}
                        </li>
                      ))}
                      {f.hasPhoto ? <li>foto: recibida</li> : null}
                      {f.geo ? (
                        <li>
                          gps: {f.geo.lat.toFixed(4)}, {f.geo.lon.toFixed(4)}
                        </li>
                      ) : null}
                    </ul>
                    <button
                      type="button"
                      onClick={() =>
                        setFichaAbierta((c) => (c === f.id ? null : f.id))
                      }
                      className="mt-3 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      {fichaAbierta === f.id ? "Ocultar ficha" : "Ver ficha simulada"}
                    </button>
                    {fichaAbierta === f.id ? (
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/60 p-2 text-[10px] leading-relaxed text-emerald-100">
                        {f.xml}
                      </pre>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

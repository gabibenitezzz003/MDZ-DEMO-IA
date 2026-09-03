"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OdkCampoSubmission } from "@/lib/odk-campo-responder";

type Bubble = { role: "user" | "assistant"; text: string };

const STARTERS = [
  "Encontré un olivo abandonado en Rivadavia, al lado de vid",
  "Visita de ciruela industria en floración, Tunuyán",
  "Alta de finca Los Álamos, durazno, orientación norte, Maipú",
];

export function FieldWhatsApp() {
  const [log, setLog] = useState<Bubble[]>([
    {
      role: "assistant",
      text: "Hablame como en la finca. Una frase alcanza: olivo, visita o cuartel. Foto y ubicación si las tenés. Yo armo una ficha simulada: no es el formulario real de Central.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stateJson, setStateJson] = useState("");
  const [items, setItems] = useState<OdkCampoSubmission[]>([]);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [openXml, setOpenXml] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const refreshInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/odk-inbox", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: OdkCampoSubmission[] };
      setItems(data.items || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshInbox();
    const timer = window.setInterval(() => void refreshInbox(), 4000);
    return () => window.clearInterval(timer);
  }, [refreshInbox]);

  useEffect(() => {
    void fetch("/api/agent/whatsapp-odk", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string | null } | null) => {
        setWhatsappUrl(data?.url || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [log]);

  const send = useCallback(
    async (
      text: string,
      extra?: { inputType?: string; lat?: number; lon?: number }
    ) => {
      const trimmed = text.trim();
      if ((!trimmed && extra?.inputType !== "image" && extra?.inputType !== "location") || busy) {
        return;
      }
      const shown =
        extra?.inputType === "image"
          ? "📷 Foto de campo"
          : extra?.inputType === "location"
            ? "📍 Ubicación compartida"
            : trimmed;
      setLog((prev) => [...prev, { role: "user", text: shown }]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/agent/odk-campo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: "demo-campo-ui",
            text: trimmed || shown,
            stateJson,
            inputType: extra?.inputType || "text",
            lat: extra?.lat,
            lon: extra?.lon,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          stateJson?: string;
          submission?: OdkCampoSubmission | null;
        };
        if (data.stateJson) setStateJson(data.stateJson);
        setLog((prev) => [
          ...prev,
          { role: "assistant", text: data.reply || "Listo." },
        ]);
        if (data.submission) {
          setItems((prev) => [data.submission as OdkCampoSubmission, ...prev]);
          setOpenXml(data.submission.id);
        }
      } catch {
        setLog((prev) => [
          ...prev,
          { role: "assistant", text: "Se cortó el chat de campo. Probá de nuevo." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, stateJson]
  );

  return (
    <section
      id="odk-whatsapp"
      data-section-id="odk-whatsapp"
      className="border-b border-emerald-900/80 bg-gradient-to-b from-emerald-950/80 to-slate-950 px-4 py-10"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          Diferencial · WhatsApp de campo
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          El formulario se habla. No se rellena.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          El ingeniero manda una frase, una foto o la ubicación. El flujo
          arma una ficha simulada y la bandeja se enciende. No usamos los
          XForms reales ni escribimos en Central.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border border-emerald-800 bg-[#0b141a] shadow-xl">
            <div className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
              <div>
                <p className="text-sm font-semibold">Campo · Agricultura Mendoza</p>
                <p className="text-[11px] text-emerald-100">
                  Olivo · Visita · Finca · sin casilleros
                </p>
              </div>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold hover:bg-white/25"
                >
                  Abrir WhatsApp real
                </a>
              ) : (
                <span className="text-[11px] text-emerald-100">Chat de demo</span>
              )}
            </div>
            <div
              ref={scroller}
              className="max-h-[360px] space-y-2 overflow-y-auto bg-[#0b141a] px-3 py-3"
            >
              {log.map((row, index) => (
                <div
                  key={`${index}-${row.text.slice(0, 12)}`}
                  className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    row.role === "user"
                      ? "ml-auto bg-[#005c4b] text-white"
                      : "bg-[#1f2c34] text-slate-100"
                  }`}
                >
                  {row.text}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-slate-800 bg-[#0b141a] px-3 py-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(starter)}
                  className="rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-[10px] text-emerald-100 hover:border-emerald-500 disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("foto del olivar", { inputType: "image" })}
                className="rounded-full border border-slate-600 px-2.5 py-1 text-[10px] text-slate-200"
              >
                📷 Foto
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void send("ubicación", {
                    inputType: "location",
                    lat: -33.196,
                    lon: -68.468,
                  })
                }
                className="rounded-full border border-slate-600 px-2.5 py-1 text-[10px] text-slate-200"
              >
                📍 GPS Rivadavia
              </button>
            </div>
            <form
              className="flex gap-2 border-t border-slate-800 bg-[#202c33] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribí como en el campo…"
                className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm text-white outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Bandeja de paquetes
              </h3>
              <p className="text-[11px] text-slate-400">
                {items.length} fichas simuladas
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  Todavía no hay fichas. Mandá una frase en el chat y
                  confirmá: acá aparece el paquete simulado.
                </p>
              ) : (
                items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-emerald-800/80 bg-slate-900/80 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {item.formName}
                      </p>
                      <p className="font-mono text-[10px] text-emerald-300">
                        {item.formId} · v{item.version}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-400">
                      {item.channel} · simulada
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                      {Object.entries(item.data).map(([key, value]) => (
                        <li key={key}>
                          <span className="text-slate-500">{key}:</span> {value}
                        </li>
                      ))}
                      {item.hasPhoto ? <li>foto: recibida</li> : null}
                      {item.geo ? (
                        <li>
                          gps: {item.geo.lat.toFixed(4)}, {item.geo.lon.toFixed(4)}
                        </li>
                      ) : null}
                    </ul>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenXml((current) =>
                          current === item.id ? null : item.id
                        )
                      }
                      className="mt-3 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      {openXml === item.id ? "Ocultar ficha" : "Ver ficha simulada"}
                    </button>
                    {openXml === item.id ? (
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/60 p-2 text-[10px] leading-relaxed text-emerald-100">
                        {item.xml}
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

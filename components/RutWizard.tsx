"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONDICIONES_TIERRA,
  getDocChecklist,
  type CondicionTierra,
} from "@/lib/rut-docs";

const STEPS = [
  { n: 1, title: "Titular / Productor" },
  { n: 2, title: "Establecimiento" },
  { n: 3, title: "Agrícolas" },
  { n: 4, title: "Archivos" },
  { n: 5, title: "Terminar" },
];

type FormState = {
  cuit: string;
  tipoPersona: string;
  razonSocial: string;
  condicionTierra: CondicionTierra;
  telefono: string;
  email: string;
  renspa: string;
  esPropietario: boolean;
  nombreEstablecimiento: string;
  catastro: string;
  irrigacion: string;
  departamento: string;
  localidad: string;
  superficie: string;
  especie: string;
  variedad: string;
  superficieLote: string;
  sistemaRiego: string;
  anioImplantacion: string;
  hasVid: boolean;
  enviado: boolean;
};

const INITIAL: FormState = {
  cuit: "20-00000000-0",
  tipoPersona: "Persona humana",
  razonSocial: "Productor Demo",
  condicionTierra: "Titular",
  telefono: "261-0000000",
  email: "demo@ejemplo.com",
  renspa: "",
  esPropietario: true,
  nombreEstablecimiento: "Finca DEMO",
  catastro: "00-00-00-0000",
  irrigacion: "Padrón riego DEMO",
  departamento: "Maipú",
  localidad: "Russell",
  superficie: "12.500",
  especie: "Ciruela",
  variedad: "D'Agen",
  superficieLote: "8.000",
  sistemaRiego: "Goteo",
  anioImplantacion: "2015",
  hasVid: false,
  enviado: false,
};

function Field({
  id,
  label,
  value,
  onChange,
  focusField,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  focusField?: string | null;
  hint?: string;
}) {
  const focused = focusField === id;
  return (
    <label
      data-rut-field={id}
      className={`block rounded-lg border p-3 ${
        focused ? "agent-highlight border-mza-gold" : "border-slate-200"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mza-blue"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

export function RutWizard({ initialStep = 1 }: { initialStep?: number }) {
  const [step, setStep] = useState(
    Math.min(5, Math.max(1, initialStep || 1))
  );
  const [form, setForm] = useState<FormState>(INITIAL);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [status, setStatus] = useState<"borrador" | "esperando" | "corregir" | "aceptada">(
    "borrador"
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("demo-rut-form");
      if (raw) setForm({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("demo-rut-form", JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    const onStep = (e: Event) => {
      const detail = (e as CustomEvent).detail as { step?: number };
      if (detail?.step) setStep(Math.min(5, Math.max(1, detail.step)));
    };
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent).detail as { field?: string };
      if (detail?.field) {
        setFocusField(detail.field);
        const el = document.querySelector<HTMLElement>(
          `[data-rut-field="${detail.field}"]`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    const onFill = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        fields?: Record<string, string>;
        mode?: string;
        step?: number;
      };
      if (detail?.step) setStep(Math.min(5, Math.max(1, detail.step)));
      const fields = detail?.fields ?? {};
      if (!Object.keys(fields).length) return;
      setForm((f) => ({ ...f, ...fields }));
      const keys = Object.keys(fields);
      let i = 0;
      const tick = () => {
        const key = keys[i];
        if (!key) return;
        setFocusField(key);
        const el = document.querySelector<HTMLElement>(
          `[data-rut-field="${key}"]`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        i += 1;
        if (i < keys.length) window.setTimeout(tick, 280);
      };
      window.setTimeout(tick, 80);
    };
    const onChecklist = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        condicion_tierra?: string;
        has_vid?: boolean;
      };
      setStep(4);
      if (detail?.condicion_tierra) {
        const match = CONDICIONES_TIERRA.find(
          (c) => c.toLowerCase() === detail.condicion_tierra!.toLowerCase()
        );
        if (match) {
          setForm((f) => ({ ...f, condicionTierra: match }));
        }
      }
      if (typeof detail?.has_vid === "boolean") {
        setForm((f) => ({ ...f, hasVid: detail.has_vid! }));
      }
    };

    window.addEventListener("demo:rut-set-step", onStep);
    window.addEventListener("demo:rut-focus-field", onFocus);
    window.addEventListener("demo:rut-show-checklist", onChecklist);
    window.addEventListener("demo:rut-fill", onFill);
    return () => {
      window.removeEventListener("demo:rut-set-step", onStep);
      window.removeEventListener("demo:rut-focus-field", onFocus);
      window.removeEventListener("demo:rut-show-checklist", onChecklist);
      window.removeEventListener("demo:rut-fill", onFill);
    };
  }, []);

  const checklist = useMemo(
    () =>
      getDocChecklist(
        form.condicionTierra,
        form.hasVid,
        Boolean(form.renspa.trim())
      ),
    [form.condicionTierra, form.hasVid, form.renspa]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-mza-blue">
            Wizard DEMO · RUT Digital
          </p>
          <h1 className="text-2xl font-bold text-mza-blue-dark md:text-3xl">
            Declaración Jurada guiada
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Simulación local. No se envían datos al SIA. Usá datos de ejemplo.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          ← Volver al inicio
        </Link>
      </div>

      <ol className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-5">
        {STEPS.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              data-rut-step={s.n}
              aria-current={step === s.n ? "step" : undefined}
              onClick={() => setStep(s.n)}
              className={`w-full rounded-lg border px-2 py-3 text-left text-xs md:text-sm ${
                step === s.n
                  ? "border-mza-blue bg-mza-blue text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <span className="font-bold">Paso {s.n}</span>
              <br />
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="cuit"
              label="CUIT"
              value={form.cuit}
              onChange={(v) => update("cuit", v)}
              focusField={focusField}
              hint="De quien hace uso de la tierra"
            />
            <label
              data-rut-field="tipoPersona"
              className={`block rounded-lg border p-3 ${
                focusField === "tipoPersona"
                  ? "agent-highlight border-mza-gold"
                  : "border-slate-200"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo de persona
              </span>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={form.tipoPersona}
                onChange={(e) => update("tipoPersona", e.target.value)}
              >
                {[
                  "Persona humana",
                  "Sucesiones",
                  "Sociedades Sección IV",
                  "Sociedades Comerciales",
                  "Cooperativas",
                  "Asociaciones Civiles",
                  "Fideicomisos",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <Field
              id="razonSocial"
              label="Razón Social"
              value={form.razonSocial}
              onChange={(v) => update("razonSocial", v)}
              focusField={focusField}
            />
            <label
              data-rut-field="condicionTierra"
              className={`block rounded-lg border p-3 ${
                focusField === "condicionTierra"
                  ? "agent-highlight border-mza-gold"
                  : "border-slate-200"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Condición frente a la tierra
              </span>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={form.condicionTierra}
                onChange={(e) =>
                  update("condicionTierra", e.target.value as CondicionTierra)
                }
              >
                {CONDICIONES_TIERRA.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <Field
              id="telefono"
              label="Teléfono"
              value={form.telefono}
              onChange={(v) => update("telefono", v)}
              focusField={focusField}
            />
            <Field
              id="email"
              label="Correo"
              value={form.email}
              onChange={(v) => update("email", v)}
              focusField={focusField}
            />
            <Field
              id="renspa"
              label="RENSPA (opcional)"
              value={form.renspa}
              onChange={(v) => update("renspa", v)}
              focusField={focusField}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="col-span-full flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={form.esPropietario}
                onChange={(e) => update("esPropietario", e.target.checked)}
              />
              El titular (Paso 1) es propietario del establecimiento
            </label>
            <Field
              id="nombreEstablecimiento"
              label="Nombre del establecimiento"
              value={form.nombreEstablecimiento}
              onChange={(v) => update("nombreEstablecimiento", v)}
              focusField={focusField}
            />
            <Field
              id="catastro"
              label="Catastro"
              value={form.catastro}
              onChange={(v) => update("catastro", v)}
              focusField={focusField}
              hint="De la boleta de Impuesto Inmobiliario ATM"
            />
            <Field
              id="irrigacion"
              label="Irrigación / Pozo"
              value={form.irrigacion}
              onChange={(v) => update("irrigacion", v)}
              focusField={focusField}
            />
            <Field
              id="departamento"
              label="Departamento"
              value={form.departamento}
              onChange={(v) => update("departamento", v)}
              focusField={focusField}
            />
            <Field
              id="localidad"
              label="Localidad"
              value={form.localidad}
              onChange={(v) => update("localidad", v)}
              focusField={focusField}
            />
            <Field
              id="superficie"
              label="Superficie utilizada (ha)"
              value={form.superficie}
              onChange={(v) => update("superficie", v)}
              focusField={focusField}
            />
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              <strong>Ubicación geográfica (mock):</strong> en el SIA real se dibuja
              el polígono en el mapa. En esta DEMO solo se menciona el paso.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="especie"
              label="Especie *"
              value={form.especie}
              onChange={(v) => update("especie", v)}
              focusField={focusField}
            />
            <Field
              id="variedad"
              label="Variedad *"
              value={form.variedad}
              onChange={(v) => update("variedad", v)}
              focusField={focusField}
            />
            <Field
              id="superficieLote"
              label="Superficie del lote (ha) *"
              value={form.superficieLote}
              onChange={(v) => update("superficieLote", v)}
              focusField={focusField}
            />
            <Field
              id="sistemaRiego"
              label="Sistema de riego *"
              value={form.sistemaRiego}
              onChange={(v) => update("sistemaRiego", v)}
              focusField={focusField}
            />
            <Field
              id="anioImplantacion"
              label="Año de implantación *"
              value={form.anioImplantacion}
              onChange={(v) => update("anioImplantacion", v)}
              focusField={focusField}
            />
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={form.hasVid}
                onChange={(e) => update("hasVid", e.target.checked)}
              />
              Incluye vid (requiere censo/DJ INV en Archivos)
            </label>
            <p className="col-span-full text-xs text-slate-500">
              Un lote queda definido por especie + variedad + superficie + riego +
              conducción + año. Si cambia alguno, se crea un lote nuevo.
            </p>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="mb-4 text-sm text-slate-600">
              Documentación según condición frente a la tierra:{" "}
              <strong>{form.condicionTierra}</strong>. En la DEMO no se suben
              archivos reales.
            </p>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" disabled />
                    <div>
                      <p className="font-medium text-slate-800">
                        {item.label}{" "}
                        {item.required ? (
                          <span className="text-xs text-red-600">*</span>
                        ) : (
                          <span className="text-xs text-slate-500">(opcional)</span>
                        )}
                      </p>
                      {"detail" in item && item.detail ? (
                        <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Revisá que la carga de datos y documentación sea correcta. En
              producción, al enviar, un administrador examina el trámite.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {(
                [
                  ["esperando", "Esperando", "En proceso de revisión"],
                  ["corregir", "Corregir", "Hay que modificar o completar"],
                  ["aceptada", "Aceptada", "Podés descargar la Constancia RUT"],
                ] as const
              ).map(([key, title, desc]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`rounded-xl border p-4 text-left ${
                    status === key
                      ? "border-mza-blue bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-semibold text-mza-blue-dark">{title}</p>
                  <p className="mt-1 text-xs text-slate-600">{desc}</p>
                </button>
              ))}
            </div>
            {!form.enviado ? (
              <button
                type="button"
                onClick={() => {
                  update("enviado", true);
                  setStatus("esperando");
                }}
                className="rounded-full bg-mza-blue px-6 py-3 text-sm font-semibold text-white hover:bg-mza-blue-dark"
              >
                Enviar (simulado)
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Envío simulado con estado: <strong>{status}</strong>. La Constancia
                del RUT debe renovarse anualmente.{" "}
                <a
                  className="underline"
                  href="https://sia.mendoza.gov.ar/account/login"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir SIA oficial
                </a>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={step === 5}
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            className="rounded-full bg-mza-blue px-5 py-2 text-sm font-semibold text-white hover:bg-mza-blue-dark disabled:opacity-40"
          >
            Guardar y siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

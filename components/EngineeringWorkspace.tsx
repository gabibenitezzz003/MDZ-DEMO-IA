import { FieldWhatsApp } from "@/components/FieldWhatsApp";
import {
  ODK_ENGINEERING_PROJECT_ID,
  ODK_ENGINEERING_PROJECT_NAME,
  ODK_ENGINEERING_SERVER_HOST,
  ODK_OFFICIAL_FORMS,
  ODK_SIMULATED_BOARD,
} from "@/lib/odk-engineering";

function KpiCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
        {value}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function BarChart({
  title,
  rows,
  caption,
}: {
  title: string;
  rows: ReadonlyArray<{ label: string; value: number }>;
  caption: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <figcaption className="text-sm font-semibold text-white">{title}</figcaption>
      <svg
        viewBox={`0 0 360 ${rows.length * 36 + 8}`}
        className="mt-3 w-full"
        role="img"
        aria-label={title}
      >
        {rows.map((row, index) => {
          const width = (row.value / max) * 220;
          const y = index * 36 + 4;
          return (
            <g key={row.label}>
              <text x="0" y={y + 14} fill="#94a3b8" fontSize="11">
                {row.label}
              </text>
              <rect
                x="110"
                y={y}
                width={width}
                height="22"
                rx="3"
                fill="#38bdf8"
              />
              <text
                x={118 + width}
                y={y + 15}
                fill="#e2e8f0"
                fontSize="11"
              >
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[11px] text-slate-500">{caption}</p>
    </figure>
  );
}

function WeekChart() {
  const max = Math.max(...ODK_SIMULATED_BOARD.weeklySends.map((d) => d.value));
  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <figcaption className="text-sm font-semibold text-white">
        Envíos simulados por día
      </figcaption>
      <svg viewBox="0 0 280 140" className="mt-3 w-full" role="img">
        {ODK_SIMULATED_BOARD.weeklySends.map((day, index) => {
          const h = (day.value / max) * 90;
          const x = 24 + index * 36;
          return (
            <g key={day.day}>
              <rect
                x={x}
                y={108 - h}
                width="22"
                height={h}
                rx="3"
                fill="#22c55e"
              />
              <text
                x={x + 11}
                y="124"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
              >
                {day.day}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-500">
        Fuente: {ODK_SIMULATED_BOARD.note} · {ODK_SIMULATED_BOARD.period}
      </p>
    </figure>
  );
}

export function EngineeringWorkspace() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <section
        id="ingenieria"
        data-section-id="ingenieria"
        className="border-b border-slate-800 px-4 py-10"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
            Vista ingeniería · ODK Central
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Formularios de campo · {ODK_ENGINEERING_PROJECT_NAME}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
            El diferencial: el ingeniero habla por WhatsApp y se arma una
            ficha simulada. No usamos los XForms reales de Central. Collect
            queda solo como referencia; este chat no escribe en{" "}
            {ODK_ENGINEERING_SERVER_HOST}.
          </p>
        </div>
      </section>

      <FieldWhatsApp />

      <section
        id="odk-tablero"
        data-section-id="odk-tablero"
        className="px-4 py-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-lg font-semibold text-white">
            Tablero operativo (simulado)
          </h2>
          <p className="mt-1 text-sm text-slate-400">{ODK_SIMULATED_BOARD.note}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ODK_SIMULATED_BOARD.kpis.map((kpi) => (
              <KpiCard key={kpi.id} {...kpi} />
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <WeekChart />
            <BarChart
              title="Registros simulados por área"
              rows={ODK_SIMULATED_BOARD.byArea.map((row) => ({
                label: row.area,
                value: row.value,
              }))}
              caption={`Fuente: ${ODK_SIMULATED_BOARD.note}`}
            />
          </div>
        </div>
      </section>

      <section
        id="odk-collect"
        data-section-id="odk-collect"
        className="border-y border-slate-800 px-4 py-8"
      >
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-slate-700 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/odk/odk-collect-oficial.png"
              alt="QR oficial de app user para ODK Collect, proyecto Agricultura Mendoza"
              width={208}
              height={208}
              className="mx-auto h-[208px] w-[208px]"
            />
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-700">
              Escanear solo con ODK Collect
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              QR de app user · proyecto {ODK_ENGINEERING_PROJECT_ID}
            </h2>
            <dl className="mt-3 grid gap-2 text-sm text-slate-300">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Servidor
                </dt>
                <dd className="font-mono text-xs">{ODK_ENGINEERING_SERVER_HOST}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Proyecto
                </dt>
                <dd>
                  {ODK_ENGINEERING_PROJECT_NAME} · id {ODK_ENGINEERING_PROJECT_ID}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Collect
                </dt>
                <dd>
                  form_update_mode = match_exactly · autosend = wifi_and_cellular
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              El código lleva una clave de app user embebida. No abras este QR
              con la cámara ni con WhatsApp: Collect lo descomprime (zlib +
              Base64) y crea el proyecto. La cámara común no entiende ese
              payload.
            </p>
          </div>
        </div>
      </section>

      <section
        id="odk-flujo"
        data-section-id="odk-flujo"
        className="px-4 py-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-lg font-semibold text-white">Flujo en campo</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ["1", "Hablar la ficha", "WhatsApp o el chat de campo. Una frase: olivo, visita o finca."],
              ["2", "Foto y GPS", "El ingeniero manda media y ubicación. No abre casilleros."],
              ["3", "Ficha simulada", "El flujo arma un paquete de demo. No es el XForm real."],
              ["4", "Bandeja", "Aparece acá, en vivo. No se envía a Central."],
              ["5", "Collect", "Queda como referencia. Esta demo no lo usa para cargar."],
            ].map(([n, title, body]) => (
              <li
                key={n}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
              >
                <p className="text-xs font-bold text-sky-400">Paso {n}</p>
                <p className="mt-1 font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="odk-forms"
        data-section-id="odk-forms"
        className="border-t border-slate-800 px-4 py-8 pb-16"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-lg font-semibold text-white">
            Formularios publicados
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Referencia de lo publicado en Central (solo lectura). La carga por
            WhatsApp usa fichas simuladas, no estos XForms.
          </p>
          <div className="mt-5 grid gap-4">
            {ODK_OFFICIAL_FORMS.map((form) => (
              <article
                key={form.id}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">{form.name}</h3>
                  <p className="font-mono text-[11px] text-slate-400">
                    {form.id} · v{form.version}
                  </p>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-sky-400">
                  {form.area}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {form.purpose}
                </p>
                {"steps" in form ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
                    {form.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                ) : null}
                {"crops" in form ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Cultivos: {form.crops.join(" · ")}
                  </p>
                ) : null}
                {"states" in form ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Estados: {form.states.join(" · ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

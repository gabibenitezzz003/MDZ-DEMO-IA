import { FieldWhatsApp } from "@/components/FieldWhatsApp";
import { FieldConsole } from "@/components/FieldConsole";
import { OdkDashboard } from "@/components/OdkDashboard";
import {
  ODK_ENGINEERING_PROJECT_ID,
  ODK_ENGINEERING_PROJECT_NAME,
  ODK_ENGINEERING_SERVER_HOST,
  ODK_OFFICIAL_FORMS,
} from "@/lib/odk-engineering";

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
            Acá el ingeniero habla por WhatsApp y se arma una
            ficha simulada. No usamos los XForms reales de Central. Collect
            queda solo como referencia; este chat no escribe en{" "}
            {ODK_ENGINEERING_SERVER_HOST}.
          </p>

          <div className="mt-6">
            <FieldConsole formsPublicados={ODK_OFFICIAL_FORMS.length} />
          </div>
        </div>
      </section>

      <FieldWhatsApp />

      <section
        id="odk-tablero"
        data-section-id="odk-tablero"
        className="px-4 py-8"
      >
        <div className="mx-auto max-w-6xl">
          <OdkDashboard />
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

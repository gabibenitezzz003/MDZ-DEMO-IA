import Link from "next/link";
import { SectionBlock } from "@/components/SectionBlock";
import { SectionCard } from "@/components/SectionCard";
import { catalog } from "@/lib/section-ids";

function cardsByGroup(group: string) {
  return catalog.sections.filter(
    (s) => s.group === group && "summary" in s && s.summary
  );
}

export function LandingSections() {
  const publicaciones = cardsByGroup("publicaciones");
  const fruticolas = catalog.sections.filter((s) =>
    ["durazno", "ciruela", "cereza", "vid", "fenologia"].includes(s.id)
  );
  const horticolas = catalog.sections.filter((s) =>
    ["ajo", "tomate", "cinturon-verde"].includes(s.id)
  );
  const herramientas = cardsByGroup("herramientas");
  const precios = catalog.sections.find((s) => s.id === "precios");
  const caps = catalog.sections.filter((s) =>
    ["capacitacion-bpa", "encargado-finca"].includes(s.id)
  );

  return (
    <>
      <SectionBlock
        id="tramites"
        title="Trámites"
        subtitle="Accesos a gestiones productivas. En esta DEMO el RUT incluye un wizard guiado por voz."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            id="rut"
            data-section-id="rut"
            className="rounded-xl border border-sky-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-xl font-semibold text-mza-blue-dark">RUT</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Registro Único de Tierras. Inscripción y declaración jurada a través
              del Sistema de Información Agrícola (SIA).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/rut"
                data-demo-primary="wizard"
                className="rounded-full bg-mza-blue px-4 py-2 text-sm font-semibold text-white hover:bg-mza-blue-dark"
              >
                Abrir wizard DEMO
              </Link>
              <a
                href="https://sia.mendoza.gov.ar/account/login"
                target="_blank"
                rel="noopener noreferrer"
                data-demo-external="sia"
                className="rounded-full border border-mza-blue px-4 py-2 text-sm font-semibold text-mza-blue hover:bg-sky-50"
              >
                Ir al SIA oficial
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-700">
              Consultas con IA
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Pedile al asistente un cultivo, mapas, precios, el RUT o “qué es el
              QR”. Te marca la sección y te lo explica en simple.
            </p>
          </div>

          <div
            id="odk-collect"
            data-section-id="odk-collect"
            className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm md:col-span-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Campo · celular
                </p>
                <h3 className="mt-1 text-xl font-semibold text-mza-blue-dark">
                  ODK Collect · QR
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  El código QR <strong>no es un link web</strong>: configura el
                  proyecto en la app <strong>ODK Collect</strong> (Android) para
                  cargar formularios en el campo sin tipear el servidor a mano.
                </p>
              </div>
            </div>

            <div className="mt-6 grid items-start gap-8 md:grid-cols-[200px_1fr]">
              <div className="justify-self-center rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-sm md:justify-self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/odk/demo-odk-collect.png"
                  alt="QR DEMO educativo para ODK Collect — facsímil, no oficial"
                  width={168}
                  height={168}
                  className="mx-auto h-[168px] w-[168px]"
                />
                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Facsímil DEMO
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-mza-blue-dark">
                    Cómo usarlo
                  </h4>
                  <ol className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
                    <li className="flex gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-950">
                        1
                      </span>
                      <span>Instalá ODK Collect (Android)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-950">
                        2
                      </span>
                      <span>
                        En la app tocá <strong>Agregar proyecto</strong>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-950">
                        3
                      </span>
                      <span>
                        Elegí <strong>Escanear código QR</strong>
                      </span>
                    </li>
                  </ol>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-mza-blue-dark">
                    Qué configura el QR
                  </h4>
                  <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
                    <li>
                      <strong className="text-slate-900">server_url</strong>
                      <span className="block text-slate-600">
                        Servidor de formularios ODK
                      </span>
                    </li>
                    <li>
                      <strong className="text-slate-900">
                        usuario / protocolo
                      </strong>
                      <span className="block text-slate-600">
                        Cómo se autentica la app
                      </span>
                    </li>
                    <li>
                      <strong className="text-slate-900">proyecto</strong>
                      <span className="block text-slate-600">
                        Nombre que queda listo en Collect
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs leading-relaxed text-amber-950 sm:col-span-2">
                  Este QR es un <strong>facsímil educativo</strong> (
                  <a
                    href="/odk/demo-odk-payload.json"
                    className="font-semibold underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ver payload JSON
                  </a>
                  ). En el portal oficial a veces falla o no está publicado; el
                  oficial apuntaría al servidor real de la Dirección.
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        id="publicaciones-ia"
        title="Publicaciones oficiales"
        subtitle="Informes y consultas por temática."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicaciones.map((s) => (
            <SectionCard
              key={s.id}
              id={s.id}
              title={s.title}
              summary={s.summary}
              href={
                "externalUrl" in s && s.externalUrl
                  ? s.externalUrl
                  : catalog.sourceUrl
              }
            />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        id="cultivos-fruticolas"
        title="Cultivos Frutícolas"
        subtitle="Informes, tableros e índices tecnológicos por cultivo."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fruticolas.map((s) => (
            <SectionCard
              key={s.id}
              id={s.id}
              title={s.title}
              summary={s.summary}
              accent="green"
              href={
                "externalUrl" in s && s.externalUrl
                  ? s.externalUrl
                  : catalog.sourceUrl
              }
            />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        id="cultivos-horticolas"
        title="Cultivos Hortícolas"
        subtitle="Datos productivos de hortalizas clave de Mendoza."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {horticolas.map((s) => (
            <SectionCard
              key={s.id}
              id={s.id}
              title={s.title}
              summary={s.summary}
              accent="green"
              href={
                "externalUrl" in s && s.externalUrl
                  ? s.externalUrl
                  : catalog.sourceUrl
              }
            />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        id="monitoreo"
        title="Monitoreo"
        subtitle="Heladas y catas: herramientas de seguimiento para el productor."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            id="monitoreo-heladas"
            title="Monitoreo de heladas"
            summary="Herramientas y tableros de monitoreo de heladas."
            accent="amber"
            href={catalog.sourceUrl}
          />
          <SectionCard
            id="monitoreo-catas"
            title="Monitoreo de Catas"
            summary="Control sugerido y legislación relacionada a catas."
            accent="amber"
            href={catalog.sourceUrl}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        id="herramientas"
        title="Herramientas digitales agrícolas"
        subtitle="Mapas, clima, radar y recursos para la toma de decisiones."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {herramientas.map((s) => (
            <SectionCard
              key={s.id}
              id={s.id}
              title={s.title}
              summary={s.summary}
              href={
                "externalUrl" in s && s.externalUrl
                  ? s.externalUrl
                  : catalog.sourceUrl
              }
            />
          ))}
        </div>
      </SectionBlock>

      {precios ? (
        <SectionBlock
          id="precios"
          title="Relevamiento de precios"
          subtitle={precios.summary}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">
              Destinado a informar al consumidor final. Los informes se renuevan
              cada semana en el portal oficial.
            </p>
          </div>
        </SectionBlock>
      ) : null}

      <SectionBlock
        id="capacitaciones"
        title="Capacitaciones"
        subtitle="Inscripción por correo a direcciondeagricultura@mendoza.gov.ar"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {caps.map((s) => (
            <SectionCard
              key={s.id}
              id={s.id}
              title={s.title}
              summary={s.summary}
              accent="amber"
              href={
                "externalUrl" in s && s.externalUrl
                  ? s.externalUrl
                  : catalog.sourceUrl
              }
            />
          ))}
        </div>
      </SectionBlock>
    </>
  );
}

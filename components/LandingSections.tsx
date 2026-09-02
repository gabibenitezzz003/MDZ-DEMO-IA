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
        subtitle="Accesos a gestiones productivas. En esta DEMO el registro RUT se deriva a WhatsApp con un agente especializado."
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
              Pedile al asistente un cultivo, mapas, precios o el RUT. Si sos
              del equipo técnico, pedile la vista de ingeniería.
            </p>
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

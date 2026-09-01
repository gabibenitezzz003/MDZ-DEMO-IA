import { catalog } from "@/lib/section-ids";

export function Hero() {
  const { org } = catalog;
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-mza-blue via-mza-blue-light to-sky-700 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-sky-200">
            Gobierno de Mendoza · Producción
          </p>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            {org.name}
          </h1>
          <p className="mt-4 text-base text-sky-50 md:text-lg">{org.tagline}</p>
          <p className="mt-3 text-sm text-sky-100/90 md:text-base">{org.about}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#rut"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-mza-blue shadow hover:bg-sky-50"
            >
              Trámite RUT
            </a>
            <a
              href="#herramientas"
              className="rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Herramientas digitales
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
          <p className="text-sm uppercase tracking-wide text-sky-200">
            Asistente de navegación IA
          </p>
          <p className="mt-2 text-xl font-semibold">
            Hablá con el asistente y te guía por la página
          </p>
          <ul className="mt-4 space-y-2 text-sm text-sky-50">
            <li>• Encontrá informes por cultivo (ciruela, ajo, vid…)</li>
            <li>• Ubicá mapas, radar y estaciones meteorológicas</li>
            <li>• Recorré el RUT paso a paso sin perderte</li>
          </ul>
          <p className="mt-4 text-xs text-sky-200">
            Usá el chat de la derecha: voz institucional + control de la página.
          </p>
        </div>
      </div>
    </section>
  );
}

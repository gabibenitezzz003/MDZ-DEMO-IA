import { catalog } from "@/lib/section-ids";

export function Footer() {
  const { org } = catalog;
  return (
    <footer className="border-t border-slate-200 bg-mza-blue-dark text-sky-100">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-bold text-white">Dirección de Agricultura</p>
          <p className="mt-2 text-sm">{org.address}</p>
          <a
            className="mt-2 inline-block text-sm underline"
            href={`mailto:${org.email}`}
          >
            {org.email}
          </a>
        </div>
        <div>
          <p className="font-bold text-white">Sitio oficial</p>
          <a
            className="mt-2 inline-block text-sm underline"
            href={catalog.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            sitios.mendoza.gob.ar
          </a>
          <p className="mt-2 text-sm">{org.footerAddress}</p>
        </div>
        <div>
          <p className="font-bold text-white">Aviso DEMO</p>
          <p className="mt-2 text-sm">
            Esta página es una demostración de integración de IA por voz. No
            reemplaza trámites oficiales ni almacena datos en sistemas del
            gobierno.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-3 text-center text-xs text-sky-200">
        Mendoza Gobierno — Réplica DEMO con fines de presentación.
      </div>
    </footer>
  );
}

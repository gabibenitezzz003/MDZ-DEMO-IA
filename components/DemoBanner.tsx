export function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <strong>DEMO</strong> — Réplica con asistente de voz IA.{" "}
      <span className="font-normal">
        No es el sitio oficial del Gobierno de Mendoza.{" "}
        <a
          href="https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Ir al sitio oficial
        </a>
      </span>
    </div>
  );
}

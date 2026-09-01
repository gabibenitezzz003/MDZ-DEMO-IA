import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-mza-blue text-xs font-bold text-white">
            MZA
          </div>
          <div>
            <p className="text-lg font-bold tracking-wide text-mza-blue">
              MENDOZA
            </p>
            <p className="text-xs text-slate-500">Dirección de Agricultura · DEMO</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 md:flex">
          <a href="#autoridades" className="hover:text-mza-blue">
            Institucional
          </a>
          <a href="#tramites" className="hover:text-mza-blue">
            Trámites
          </a>
          <a href="#cultivos-fruticolas" className="hover:text-mza-blue">
            Cultivos
          </a>
          <a href="#herramientas" className="hover:text-mza-blue">
            Herramientas
          </a>
          <a href="#capacitaciones" className="hover:text-mza-blue">
            Capacitaciones
          </a>
          <Link
            href="/rut"
            className="rounded-full bg-mza-blue px-4 py-2 text-white hover:bg-mza-blue-dark"
          >
            RUT DEMO
          </Link>
        </nav>
      </div>
    </header>
  );
}

import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  summary?: string;
  href?: string;
  children?: ReactNode;
  accent?: "blue" | "green" | "amber";
};

const accents = {
  blue: "border-sky-200 bg-white hover:border-mza-blue",
  green: "border-emerald-200 bg-white hover:border-emerald-600",
  amber: "border-amber-200 bg-white hover:border-amber-500",
};

export function SectionCard({
  id,
  title,
  summary,
  href,
  children,
  accent = "blue",
}: Props) {
  const className = `block rounded-xl border p-5 shadow-sm transition ${accents[accent]}`;

  const inner = (
    <>
      <h3 className="text-lg font-semibold text-mza-blue-dark">{title}</h3>
      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary}</p>
      ) : null}
      {children}
      {href ? (
        <p className="mt-3 text-xs font-medium text-mza-blue">
          Abrir recurso oficial →
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        id={id}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        data-section-id={id}
        data-demo-primary="official"
      >
        {inner}
      </a>
    );
  }

  return (
    <div id={id} className={className} data-section-id={id}>
      {inner}
    </div>
  );
}

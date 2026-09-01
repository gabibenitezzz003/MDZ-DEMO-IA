import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionBlock({ id, title, subtitle, children }: Props) {
  return (
    <section id={id} data-section-id={id} className="scroll-mt-24 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-mza-blue-dark md:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

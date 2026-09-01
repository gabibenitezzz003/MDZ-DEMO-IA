"use client";

import { useEffect, useState } from "react";
import { catalog } from "@/lib/section-ids";

const tabs = [
  { id: "autoridades", label: "Autoridades" },
  { id: "mision", label: "Misión" },
  { id: "vision", label: "Visión" },
  { id: "funcion", label: "Función" },
  { id: "normativa", label: "Normativa Legal" },
] as const;

export function Institucional() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("autoridades");
  const { director, institucional, org } = catalog;

  useEffect(() => {
    const onActivate = (event: Event) => {
      const id = (event as CustomEvent<{ sectionId?: string }>).detail?.sectionId;
      if (id && tabs.some((tab) => tab.id === id)) {
        setActive(id as (typeof tabs)[number]["id"]);
      }
    };
    window.addEventListener("demo:section-activate", onActivate);
    return () => window.removeEventListener("demo:section-activate", onActivate);
  }, []);

  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              id={tab.id}
              data-section-id={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                active === tab.id
                  ? "bg-mza-blue text-white shadow"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {active === "autoridades" && (
            <div data-section-id="autoridades">
              <h3 className="text-xl font-semibold text-mza-blue-dark">
                {director.title} — {director.name}
              </h3>
              <p className="mt-3 text-slate-600">{director.bio}</p>
              <p className="mt-4 text-sm text-slate-500">
                {org.address} ·{" "}
                <a className="text-mza-blue underline" href={`mailto:${org.email}`}>
                  {org.email}
                </a>
              </p>
            </div>
          )}
          {active === "mision" && (
            <p className="text-slate-700">{institucional.mision}</p>
          )}
          {active === "vision" && (
            <p className="text-slate-700">{institucional.vision}</p>
          )}
          {active === "funcion" && (
            <ul className="list-disc space-y-2 pl-5 text-slate-700">
              {institucional.funciones.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          {active === "normativa" && (
            <div className="grid gap-4 md:grid-cols-2">
              {institucional.normativa.map((group) => (
                <div
                  key={group.grupo}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                >
                  <p className="font-semibold text-mza-blue-dark">{group.grupo}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {group.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

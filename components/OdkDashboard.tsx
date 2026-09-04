"use client";

import { useMemo, useState } from "react";
import { ODK_SIMULATED_BOARD } from "@/lib/odk-engineering";

type Area = (typeof ODK_SIMULATED_BOARD.byArea)[number]["area"];

/** Qué KPI pertenece a qué área, para poder cruzar tarjetas con gráficos. */
const AREA_DE_KPI: Record<string, Area | null> = {
  forms: null,
  fincas: "Fenología",
  visitas: "Fenología",
  olivos: "Olivo",
  verificar: "Olivo",
  equipos: "Teledetección",
};

const COLOR_AREA: Record<Area, string> = {
  Fenología: "#38bdf8",
  Olivo: "#22c55e",
  Teledetección: "#f59e0b",
};

function KpiCard({
  label,
  value,
  unit,
  hint,
  activo,
  atenuado,
  onClick,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  activo: boolean;
  atenuado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-lg border p-4 text-left transition ${
        activo
          ? "border-sky-400 bg-sky-500/10 shadow-[0_0_24px_-8px_rgba(56,189,248,0.6)]"
          : atenuado
            ? "border-slate-800 bg-slate-900/40 opacity-45"
            : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
        {value}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </button>
  );
}

function GraficoSemanal({ areaSel }: { areaSel: Area | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const datos = ODK_SIMULATED_BOARD.weeklySends;
  const max = Math.max(...datos.map((d) => d.value));
  const color = areaSel ? COLOR_AREA[areaSel] : "#22c55e";

  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <figcaption className="flex items-baseline justify-between text-sm font-semibold text-white">
        <span>Envíos simulados por día</span>
        <span className="font-mono text-[11px] font-normal tabular-nums text-slate-400">
          {hover != null
            ? `${datos[hover].day}: ${datos[hover].value}`
            : `total ${datos.reduce((a, d) => a + d.value, 0)}`}
        </span>
      </figcaption>

      {/* viewBox ancho a propósito: el SVG se estira al ancho del contenedor y
          con un viewBox chico el texto se escalaba al doble del resto de la UI. */}
      <svg
        viewBox="0 0 620 210"
        className="mt-3 w-full"
        role="img"
        aria-label="Envíos simulados por día de la semana"
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1="30"
            x2="600"
            y1={164 - f * 130}
            y2={164 - f * 130}
            stroke="#1e293b"
            strokeWidth="1"
          />
        ))}
        {datos.map((d, i) => {
          const h = (d.value / max) * 130;
          const x = 44 + i * 79;
          const activo = hover === i;
          return (
            <g
              key={d.day}
              onMouseEnter={() => setHover(i)}
              className="cursor-pointer"
            >
              {/* Zona de hover generosa: las barras finas son difíciles de apuntar. */}
              <rect x={x - 14} y="20" width="72" height="150" fill="transparent" />
              <rect
                x={x}
                y={164 - h}
                width="44"
                height={h}
                rx="4"
                fill={color}
                opacity={hover == null || activo ? 1 : 0.4}
              />
              {activo ? (
                <text
                  x={x + 22}
                  y={156 - h}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="15"
                  fontWeight="600"
                >
                  {d.value}
                </text>
              ) : null}
              <text
                x={x + 22}
                y="190"
                textAnchor="middle"
                fill={activo ? "#e2e8f0" : "#64748b"}
                fontSize="14"
              >
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-500">
        {ODK_SIMULATED_BOARD.note}
      </p>
    </figure>
  );
}

function GraficoAreas({
  areaSel,
  onSelect,
}: {
  areaSel: Area | null;
  onSelect: (a: Area | null) => void;
}) {
  const filas = ODK_SIMULATED_BOARD.byArea;
  const max = Math.max(...filas.map((f) => f.value));

  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <figcaption className="text-sm font-semibold text-white">
        Registros simulados por área
      </figcaption>
      <svg
        viewBox={`0 0 620 ${filas.length * 62 + 14}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Registros simulados por área"
      >
        {filas.map((fila, i) => {
          const w = (fila.value / max) * 340;
          const y = i * 62 + 6;
          const activo = areaSel === fila.area;
          return (
            <g
              key={fila.area}
              className="cursor-pointer"
              onClick={() => onSelect(activo ? null : (fila.area as Area))}
            >
              <rect x="0" y={y - 6} width="620" height="52" fill="transparent" />
              <text
                x="0"
                y={y + 26}
                fill={activo ? "#e2e8f0" : "#94a3b8"}
                fontSize="15"
                fontWeight={activo ? "600" : "400"}
              >
                {fila.area}
              </text>
              <rect
                x="190"
                y={y + 8}
                width={w}
                height="30"
                rx="4"
                fill={COLOR_AREA[fila.area as Area]}
                opacity={areaSel == null || activo ? 1 : 0.35}
              />
              <text x={202 + w} y={y + 29} fill="#e2e8f0" fontSize="15">
                {fila.value}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[11px] text-slate-500">
        Tocá un área para cruzarla con las tarjetas.
      </p>
    </figure>
  );
}

export function OdkDashboard() {
  const [areaSel, setAreaSel] = useState<Area | null>(null);

  const total = useMemo(
    () =>
      areaSel
        ? ODK_SIMULATED_BOARD.byArea.find((a) => a.area === areaSel)?.value ?? 0
        : ODK_SIMULATED_BOARD.byArea.reduce((a, f) => a + f.value, 0),
    [areaSel]
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Tablero operativo (simulado)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {areaSel
              ? `Filtrando por ${areaSel} · ${total} registros`
              : `${total} registros simulados · ${ODK_SIMULATED_BOARD.period}`}
          </p>
        </div>
        {areaSel ? (
          <button
            type="button"
            onClick={() => setAreaSel(null)}
            className="rounded-full border border-sky-700 px-3 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-950"
          >
            Quitar filtro
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ODK_SIMULATED_BOARD.kpis.map((kpi) => {
          const area = AREA_DE_KPI[kpi.id] ?? null;
          return (
            <KpiCard
              key={kpi.id}
              {...kpi}
              activo={areaSel != null && area === areaSel}
              atenuado={areaSel != null && area !== areaSel}
              onClick={() => setAreaSel(area === areaSel ? null : area)}
            />
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <GraficoSemanal areaSel={areaSel} />
        <GraficoAreas areaSel={areaSel} onSelect={setAreaSel} />
      </div>
    </div>
  );
}

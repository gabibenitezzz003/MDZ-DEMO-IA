import { FIELD_LABELS } from "@/lib/form-extract";
import { normalizeRutFields } from "@/lib/rut-conversation";

export type FieldConflict = {
  key: string;
  previous: string;
  incoming: string;
  label: string;
};

export type MergeFieldsResult = {
  merged: Record<string, string>;
  conflicts: FieldConflict[];
  changed: string[];
};

export function mergeFieldsWithConflicts(
  previous: Record<string, string>,
  incoming: Record<string, string>
): MergeFieldsResult {
  const base = normalizeRutFields(previous);
  const next = normalizeRutFields(incoming);
  const merged = { ...base };
  const conflicts: FieldConflict[] = [];
  const changed: string[] = [];

  for (const [key, value] of Object.entries(next)) {
    if (!value?.trim()) continue;
    const prev = base[key]?.trim();
    const incomingValue = value.trim();
    if (!prev) {
      merged[key] = incomingValue;
      changed.push(key);
      continue;
    }
    const same =
      prev.toLowerCase() === incomingValue.toLowerCase() ||
      prev.replace(/\D/g, "") === incomingValue.replace(/\D/g, "");
    if (same) {
      merged[key] = incomingValue;
      continue;
    }
    conflicts.push({
      key,
      previous: prev,
      incoming: incomingValue,
      label: FIELD_LABELS[key] || key,
    });
    // Por defecto conservamos el valor nuevo (el usuario acaba de dictarlo),
    // pero reportamos el conflicto para que el cerebro lo aclare.
    merged[key] = incomingValue;
    changed.push(key);
  }

  return { merged, conflicts, changed };
}

export function conflictSpoken(conflicts: FieldConflict[]): string {
  if (!conflicts.length) return "";
  if (conflicts.length === 1) {
    const c = conflicts[0];
    return `Antes tenía ${c.label} ${c.previous} y ahora indicó ${c.incoming}. Dejé el nuevo. Si no era correcto, indíquelo nuevamente.`;
  }
  const bits = conflicts
    .slice(0, 2)
    .map((c) => `${c.label}`)
    .join(" y ");
  return `Hubo diferencias en ${bits}. Dejé lo último que indicó. Si desea corregir, pase el dato nuevamente.`;
}

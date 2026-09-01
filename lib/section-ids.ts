import catalog from "@/content/site-catalog.json";

export const SECTION_IDS = catalog.sections.map((s) => s.id);

export function isValidSectionId(id: string): boolean {
  return SECTION_IDS.includes(id);
}

export function getSection(id: string) {
  return catalog.sections.find((s) => s.id === id);
}

export { catalog };

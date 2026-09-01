const WORD_NUM: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function countWord(raw: string): number {
  const n = WORD_NUM[raw.toLowerCase()];
  if (n) return n;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applySpokenLetters(chunk: string): string {
  return chunk
    .replace(
      /\b([a-z]*?)z+\s+con\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(zetas?|setas?)\b/gi,
      (_full, base: string, num: string) => {
        const count = Math.min(Math.max(countWord(num), 1), 10);
        return `${base}${"z".repeat(count)}`;
      }
    )
    .replace(
      /\bcon\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(zetas?|setas?|equis)\b/gi,
      (_full, num: string, letterWord: string) => {
        const count = Math.min(Math.max(countWord(num), 1), 10);
        const letter = /equis/.test(letterWord) ? "x" : "z";
        return letter.repeat(count);
      }
    );
}

function normalizeEmail(local: string, domain: string): string | null {
  let d = domain.replace(/[^a-z0-9.]/g, "");
  const l = local.replace(/[^a-z0-9._+\-]/g, "");
  if (/^gmail(\.com)?$/.test(d) || d === "gmailcom") d = "gmail.com";
  else if (/^hotmail(\.com)?$/.test(d) || d === "hotmailcom") d = "hotmail.com";
  else if (/^yahoo(\.com)?$/.test(d) || d === "yahoocom") d = "yahoo.com";
  else if (/^outlook(\.com)?$/.test(d)) d = "outlook.com";
  else if (d && !d.includes(".") && d.length > 2) d = `${d}.com`;
  if (!l || l.length < 2 || !d.includes(".")) return null;
  return `${l}@${d}`;
}

export function extractSpokenEmail(raw: string): string | null {
  const direct = raw.match(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/i);
  if (direct) return direct[0].toLowerCase();

  const lower = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!lower.includes("arroba") && !/(mail|correo|email|e-mail)/.test(lower)) {
    return null;
  }

  let chunk = lower;
  const tagged = lower.match(
    /(?:mi\s+)?(?:mail|correo(?:\s+electronico)?|email|e-mail)\s*(?:es|sera|:)?\s*(.+)$/i
  );
  if (tagged?.[1]) chunk = tagged[1].trim();

  chunk = chunk.split(/\s+(?:soy|cuit|telefono|celu|finca|titular)\b/i)[0] || chunk;
  chunk = applySpokenLetters(chunk);

  if (chunk.includes("arroba")) {
    const parts = chunk.split("arroba");
    const left = parts[0] ?? "";
    const right = parts.slice(1).join("arroba");
    if (!left.trim() || !right.trim()) return null;
    const localPart = left.trim().replace(/\s+/g, "");
    const domainPart = right
      .trim()
      .replace(/\bpunto\b/g, ".")
      .replace(/\bdot\b/g, ".")
      .replace(/\s+/g, "");
    return normalizeEmail(localPart, domainPart);
  }

  const at = chunk.indexOf("@");
  if (at < 0) return null;
  return normalizeEmail(chunk.slice(0, at), chunk.slice(at + 1));
}

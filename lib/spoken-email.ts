/** Parse emails dictated in Río de la Plata Spanish (arroba, punto, zetas…). */

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

/**
 * "gabi benitez con 3 zetas 003 arroba gmail punto com"
 * → gabibenitezzz003@gmail.com
 *
 * "benitez con 3 zetas" means the surname ends with three z's (not "benitez" + three more).
 */
export function extractSpokenEmail(raw: string): string | null {
  const direct = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (direct) return direct[0].toLowerCase();

  const lower = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!/(mail|correo|email|e-mail|arroba)/.test(lower)) return null;

  let chunk = lower;
  const tagged = lower.match(
    /(?:mi\s+)?(?:mail|correo(?:\s+electronico)?|email|e-mail)\s*(?:es|sera|:)?\s*(.+)$/i
  );
  if (tagged?.[1]) chunk = tagged[1].trim();

  // "benitez con 3 zetas" → benitezzz (replace trailing z-run with the spoken count)
  chunk = chunk.replace(
    /\b([a-z]*?)z+\s+con\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(zetas?|ces|setas?|eses)\b/gi,
    (_full, base: string, num: string) => {
      const count = Math.min(Math.max(countWord(num), 1), 10);
      return `${base}${"z".repeat(count)}`;
    }
  );

  // Standalone "con 3 zetas" (no letter before) → zzz
  chunk = chunk.replace(
    /\bcon\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(zetas?|ces|setas?|eses|equis)\b/gi,
    (_full, num: string, letterWord: string) => {
      const count = Math.min(Math.max(countWord(num), 1), 10);
      const letter = /zeta|seta/.test(letterWord)
        ? "z"
        : /equis/.test(letterWord)
          ? "x"
          : /ese/.test(letterWord)
            ? "s"
            : "c";
      return letter.repeat(count);
    }
  );

  chunk = chunk
    .replace(/\barroba\b/g, " @ ")
    .replace(/\bpunto\b/g, " . ")
    .replace(/\bdot\b/g, " . ")
    .replace(/\s*\.\s*/g, " . ");

  const at = chunk.indexOf("@");
  if (at < 0) return null;

  const local = chunk.slice(0, at).replace(/[^a-z0-9._+-]+/g, "");
  let domain = chunk
    .slice(at + 1)
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9.]+/g, "");

  // Common spoken domains
  if (/^gmail(\.com)?$/.test(domain) || domain === "gmailcom") {
    domain = "gmail.com";
  } else if (/^hotmail(\.com)?$/.test(domain) || domain === "hotmailcom") {
    domain = "hotmail.com";
  } else if (/^yahoo(\.com)?$/.test(domain) || domain === "yahoocom") {
    domain = "yahoo.com";
  } else if (/^outlook(\.com)?$/.test(domain)) {
    domain = "outlook.com";
  } else if (domain && !domain.includes(".") && domain.length > 2) {
    domain = `${domain}.com`;
  }

  if (local.length < 3 || !domain.includes(".")) return null;
  return `${local}@${domain}`;
}

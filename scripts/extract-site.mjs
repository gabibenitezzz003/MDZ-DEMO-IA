/**
 * One-shot helper to re-extract public text from the official landing.
 * The live site may be JS-rendered; if HTML is thin, keep the curated
 * content/site-catalog.json as source of truth.
 *
 * Usage: node scripts/extract-site.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL =
  "https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/";
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "content");

async function main() {
  mkdirSync(outDir, { recursive: true });
  const res = await fetch(URL, {
    headers: { "User-Agent": "MendozaDemoExtractor/1.0" },
  });
  const html = await res.text();
  writeFileSync(join(__dirname, "source.html"), html, "utf8");
  console.log(`Saved ${html.length} bytes to scripts/source.html`);
  console.log(
    "Review HTML and update content/site-catalog.json manually if needed."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

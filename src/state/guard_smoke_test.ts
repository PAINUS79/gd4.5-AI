import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateSectionsManifest } from "./section_state_machine.guard";

const manifestPath = resolve(process.cwd(), "ai_library/docs/section_roadmap.manifest.json");
const raw = readFileSync(manifestPath, "utf-8");
const manifest = JSON.parse(raw);

const result = validateSectionsManifest(manifest as any);

if (!result.ok) {
  console.error("Manifest errors:");
  for (const e of result.errors) {
    console.error(`- ${e.code}: ${e.detail}`);
  }
  process.exit(1);
}

console.log("Manifest valid.");
if (result.warnings.length) {
  console.log("Warnings:");
  for (const w of result.warnings) {
    console.log(`- ${w.code}: ${w.detail}`);
  }
}
console.log("Topological order:", result.topo_order.join(" -> "));

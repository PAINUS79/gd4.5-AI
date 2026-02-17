#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

function readJson(absPath: string): unknown {
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf-8");
  return JSON.parse(raw);
}

function main(): void {
  const schemaArg = process.argv[2] ?? "schemas/artifacts_manifest.schema.json";
  const manifestArg = process.argv[3] ?? "src/data/artifacts_manifest.json";

  const schemaPath = path.resolve(process.cwd(), schemaArg);
  const manifestPath = path.resolve(process.cwd(), manifestArg);

  try {
    const schema = readJson(schemaPath);
    const data = readJson(manifestPath);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const ok = validate(data);

    if (!ok) {
      console.error("❌ Artifacts manifest validation failed.");
      for (const err of validate.errors ?? []) {
        const at = err.instancePath || "/";
        const msg = err.message ?? "validation error";
        console.error(`- ${at}: ${msg}`);
      }
      process.exit(1);
    }

    console.log("✅ Artifacts manifest is valid.");
    console.log(`Schema: ${schemaPath}`);
    console.log(`Manifest: ${manifestPath}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

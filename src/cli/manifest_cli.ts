#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  validateSectionsManifest,
  assertValidManifest,
  type SectionsManifest
} from "../state/section_state_machine.guard";

/* =========================
 * Types
 * ========================= */

type ArtifactStatus = "draft" | "final" | "failed" | "superseded";

interface ArtifactItem {
  artifact_id: string;
  project_id: string;
  section_id: string;
  task_id: string;
  producer_agent: string;
  artifact_type: string;
  title: string;
  summary?: string;
  status: ArtifactStatus;
  created_at: string;
  updated_at?: string;
  inspect_uri?: string;
  inspect_payload?: Record<string, unknown>;
  tags?: string[];
  related_artifact_ids?: string[];
  verification?: {
    verify_pass: boolean;
    check_count?: number;
    failed_checks?: string[];
  };
  meta?: Record<string, unknown>;
}

interface ArtifactsManifest {
  manifest_version: string;
  project_id: string;
  artifact_types: string[];
  artifacts: ArtifactItem[];
}

interface SectionArtifactAuditRow {
  section_id: string;
  required_types: string[];
  present_final_types: string[];
  missing_types: string[];
  final_count: number;
  total_count: number;
  completeness: number;
}

interface ArtifactAuditResult {
  rows: SectionArtifactAuditRow[];
  summary: {
    included_sections: number;
    all_required_final: number;
    missing_required_total: number;
    final_artifacts_total: number;
  };
}

interface CiGateResult {
  pass: boolean;
  threshold: number;
  reasons: string[];
  failing_sections: Array<{
    section_id: string;
    completeness: number;
    missing_required_types: string[];
  }>;
  warning?: string;
}

/* =========================
 * IO + Utilities
 * ========================= */

function loadJson<T>(filePath: string): T {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const raw = fs.readFileSync(abs, "utf-8");
  return JSON.parse(raw) as T;
}

function loadManifest(filePath: string): SectionsManifest {
  return loadJson<SectionsManifest>(filePath);
}

function loadArtifactsManifest(filePath: string): ArtifactsManifest {
  return loadJson<ArtifactsManifest>(filePath);
}

function writeFileSafe(outPath: string, content: string): string {
  const abs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return abs;
}

function usage(): void {
  console.log(`
manifest-cli commands:
  validate <manifestPath>
  topo <manifestPath>
  list-blockers <manifestPath> <sectionId>
  next <manifestPath> <sectionId>
  doctor <manifestPath>
  export-mermaid <manifestPath> [outputPath]
    [--output <path>]
    [--focus <sectionId>]
    [--depth <n>]
    [--format mmd|markdown]
    [--with-artifacts <artifactsManifestPath>]
    [--ci]
    [--ci-threshold <0-100>]
    [--ci-strict]
    [--ci-json <path>]

Examples:
  tsx src/cli/manifest_cli.ts validate src/data/sections_manifest.json
  tsx src/cli/manifest_cli.ts topo src/data/sections_manifest.json
  tsx src/cli/manifest_cli.ts list-blockers src/data/sections_manifest.json 3.3
  tsx src/cli/manifest_cli.ts next src/data/sections_manifest.json 3.3
  tsx src/cli/manifest_cli.ts doctor src/data/sections_manifest.json

  # full graph
  tsx src/cli/manifest_cli.ts export-mermaid src/data/sections_manifest.json docs/sections_graph.mmd

  # focused graph
  tsx src/cli/manifest_cli.ts export-mermaid src/data/sections_manifest.json --output docs/sections_3_0.mmd --focus 3.0 --depth 2

  # markdown brief + artifacts audit
  tsx src/cli/manifest_cli.ts export-mermaid src/data/sections_manifest.json --output docs/brief_3_0.md --format markdown --focus 3.0 --depth 2 --with-artifacts src/data/artifacts_manifest.json

  # CI gate + JSON report
  tsx src/cli/manifest_cli.ts export-mermaid src/data/sections_manifest.json --output docs/brief_ci.md --format markdown --with-artifacts src/data/artifacts_manifest.json --ci --ci-threshold 100 --ci-json docs/ci_gate.json
`);
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }

  return { positional, flags };
}

function byIdMap(manifest: SectionsManifest): Record<string, SectionsManifest["sections"][number]> {
  return Object.fromEntries(manifest.sections.map((s) => [s.id, s]));
}

function escapeMd(s: string): string {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/* =========================
 * Core Ops
 * ========================= */

function findBlockers(manifest: SectionsManifest, sectionId: string): string[] {
  const byId = byIdMap(manifest);
  const s = byId[sectionId];
  if (!s) return [`Unknown section: ${sectionId}`];

  const blockers: string[] = [];

  for (const d of s.dependencies ?? []) {
    const dep = byId[d];
    if (!dep) blockers.push(`Missing dependency reference: ${d}`);
    else if (dep.status !== "complete") blockers.push(`Dependency not complete: ${d} (${dep.status})`);
  }

  for (const c of s.checklist ?? []) {
    if (c.status !== "pass") blockers.push(`Checklist not passing: ${c.id} (${c.status})`);
  }

  return blockers;
}

function nextSection(manifest: SectionsManifest, sectionId: string): string {
  const byId = byIdMap(manifest);
  const current = byId[sectionId];
  if (!current) return `Unknown section: ${sectionId}`;

  if (current.next_section_id && byId[current.next_section_id]) {
    return current.next_section_id;
  }

  const candidates = manifest.sections.filter((s) => s.status !== "complete");
  for (const c of candidates) {
    const depsOk = (c.dependencies ?? []).every((d) => byId[d]?.status === "complete");
    if (depsOk) return c.id;
  }

  return "No available next section (all complete or blocked).";
}

function computeDoctorReport(manifest: SectionsManifest) {
  const byId = byIdMap(manifest);
  const sections = manifest.sections;

  const summary = {
    total_sections: sections.length,
    completed: sections.filter((s) => s.status === "complete").length,
    in_progress: sections.filter((s) => s.status === "in_progress").length,
    blocked: sections.filter((s) => s.status === "blocked" || s.status === "regression_blocked").length,
    not_started: sections.filter((s) => s.status === "not_started").length
  };

  const blockers_by_section: Record<string, string[]> = {};
  for (const s of sections) {
    const b = findBlockers(manifest, s.id);
    if (b.length) blockers_by_section[s.id] = b;
  }

  const dependency_violations: string[] = [];
  for (const s of sections) {
    if (s.status === "in_progress" || s.status === "complete") {
      for (const d of s.dependencies ?? []) {
        const dep = byId[d];
        if (!dep || dep.status !== "complete") {
          dependency_violations.push(
            `Section ${s.id} is ${s.status} but dependency ${d} is ${dep ? dep.status : "missing"}`
          );
        }
      }
    }
  }

  const parent_child_consistency_issues: string[] = [];
  for (const p of sections.filter((s) => sections.some((k) => k.parent_id === s.id))) {
    const kids = sections.filter((k) => k.parent_id === p.id);
    if (p.status === "complete" && kids.some((k) => k.status !== "complete")) {
      parent_child_consistency_issues.push(`Parent ${p.id} is complete while child sections are incomplete.`);
    }
  }

  const next_pointer_issues: string[] = [];
  for (const s of sections) {
    if (s.next_section_id && !byId[s.next_section_id]) {
      next_pointer_issues.push(`Section ${s.id} points to missing next_section_id ${s.next_section_id}`);
    }
  }

  const ready_now = sections
    .filter((s) => s.status !== "complete")
    .filter((s) => (s.dependencies ?? []).every((d) => byId[d]?.status === "complete"))
    .map((s) => s.id);

  return {
    generated_at: new Date().toISOString(),
    summary,
    ready_now,
    blockers_by_section,
    dependency_violations,
    parent_child_consistency_issues,
    next_pointer_issues
  };
}

function buildAdjacency(manifest: SectionsManifest) {
  const byId = byIdMap(manifest);
  const parentChildren: Record<string, string[]> = {};
  const reverseDeps: Record<string, string[]> = {};
  const reverseNext: Record<string, string[]> = {};

  for (const s of manifest.sections) {
    parentChildren[s.id] = [];
    reverseDeps[s.id] = [];
    reverseNext[s.id] = [];
  }

  for (const s of manifest.sections) {
    if (s.parent_id && byId[s.parent_id]) parentChildren[s.parent_id].push(s.id);
    for (const d of s.dependencies ?? []) if (byId[d]) reverseDeps[d].push(s.id);
    if (s.next_section_id && byId[s.next_section_id]) reverseNext[s.next_section_id].push(s.id);
  }

  return { byId, parentChildren, reverseDeps, reverseNext };
}

function computeFocusedSet(manifest: SectionsManifest, focusId: string, depth: number): Set<string> {
  const { byId, parentChildren, reverseDeps, reverseNext } = buildAdjacency(manifest);
  if (!byId[focusId]) throw new Error(`Unknown focus section: ${focusId}`);

  const visited = new Set<string>();
  const q: Array<{ id: string; d: number }> = [{ id: focusId, d: 0 }];

  while (q.length) {
    const item = q.shift()!;
    if (visited.has(item.id)) continue;
    visited.add(item.id);
    if (item.d >= depth) continue;

    const s = byId[item.id];
    const neighbors = new Set<string>();

    if (s.parent_id && byId[s.parent_id]) neighbors.add(s.parent_id);
    for (const c of parentChildren[item.id] ?? []) neighbors.add(c);

    for (const dep of s.dependencies ?? []) if (byId[dep]) neighbors.add(dep);
    for (const rdep of reverseDeps[item.id] ?? []) neighbors.add(rdep);

    if (s.next_section_id && byId[s.next_section_id]) neighbors.add(s.next_section_id);
    for (const prev of reverseNext[item.id] ?? []) neighbors.add(prev);

    for (const n of neighbors) q.push({ id: n, d: item.d + 1 });
  }

  return visited;
}

/* =========================
 * Mermaid + Markdown
 * ========================= */

function buildMermaid(
  manifest: SectionsManifest,
  options?: { focusId?: string; depth?: number; includeIds?: Set<string> }
): string {
  const byId = byIdMap(manifest);
  const nodeId = (id: string) => `S_${id.replace(/\./g, "_")}`;

  const statusClass = (status: string): string => {
    switch (status) {
      case "complete":
        return "complete";
      case "in_progress":
        return "inprogress";
      case "blocked":
      case "regression_blocked":
        return "blocked";
      default:
        return "notstarted";
    }
  };

  let includeIds: Set<string> | null = options?.includeIds ?? null;
  if (!includeIds && options?.focusId) {
    includeIds = computeFocusedSet(manifest, options.focusId, options.depth ?? 2);
  }

  const include = (id: string) => (includeIds ? includeIds.has(id) : true);

  const lines: string[] = [];
  lines.push("flowchart TD");

  for (const s of manifest.sections) {
    if (!include(s.id)) continue;
    const nid = nodeId(s.id);
    const label = `${s.id} ${s.title}`.replace(/"/g, '\\"');
    lines.push(`  ${nid}["${label}"]`);
    lines.push(`  class ${nid} ${statusClass(s.status)};`);
    if (options?.focusId === s.id) lines.push(`  class ${nid} focus;`);
  }

  for (const s of manifest.sections) {
    if (!include(s.id)) continue;
    if (s.parent_id && byId[s.parent_id] && include(s.parent_id)) {
      lines.push(`  ${nodeId(s.parent_id)} --> ${nodeId(s.id)}:::hierarchy`);
    }
  }

  for (const s of manifest.sections) {
    if (!include(s.id)) continue;
    for (const d of s.dependencies ?? []) {
      if (byId[d] && include(d)) {
        lines.push(`  ${nodeId(d)} -. dep .-> ${nodeId(s.id)}:::dependency`);
      }
    }
  }

  for (const s of manifest.sections) {
    if (!include(s.id)) continue;
    if (s.next_section_id && byId[s.next_section_id] && include(s.next_section_id)) {
      lines.push(`  ${nodeId(s.id)} -->|next| ${nodeId(s.next_section_id)}:::nextptr`);
    }
  }

  lines.push("  classDef complete fill:#1f6f3f,color:#fff,stroke:#14522d,stroke-width:1px;");
  lines.push("  classDef inprogress fill:#1f4f8b,color:#fff,stroke:#163a66,stroke-width:1px;");
  lines.push("  classDef blocked fill:#8b1f2d,color:#fff,stroke:#661621,stroke-width:1px;");
  lines.push("  classDef notstarted fill:#555,color:#fff,stroke:#333,stroke-width:1px;");
  lines.push("  classDef dependency stroke-dasharray: 5 5;");
  lines.push("  classDef nextptr stroke-width:2px;");
  lines.push("  classDef hierarchy stroke-width:1px;");
  lines.push("  classDef focus stroke:#ffd166,stroke-width:3px;");

  return lines.join("\n");
}

function buildArtifactAudit(
  manifest: SectionsManifest,
  artifacts: ArtifactsManifest,
  includeIds: Set<string>
): ArtifactAuditResult {
  const scopedSections = manifest.sections.filter((s) => includeIds.has(s.id));

  const bySectionArtifacts: Record<string, ArtifactItem[]> = {};
  for (const a of artifacts.artifacts ?? []) {
    if (!bySectionArtifacts[a.section_id]) bySectionArtifacts[a.section_id] = [];
    bySectionArtifacts[a.section_id].push(a);
  }

  const rows: SectionArtifactAuditRow[] = scopedSections.map((s) => {
    const all = bySectionArtifacts[s.id] ?? [];
    const finals = all.filter((a) => a.status === "final");
    const presentFinalTypes = Array.from(new Set(finals.map((a) => a.artifact_type)));
    const required = s.required_artifact_types ?? [];
    const missing = required.filter((t) => !presentFinalTypes.includes(t));
    const requiredCount = required.length;
    const metCount = requiredCount - missing.length;
    const completeness = requiredCount === 0 ? 100 : Math.round((metCount / requiredCount) * 100);

    return {
      section_id: s.id,
      required_types: required,
      present_final_types: presentFinalTypes,
      missing_types: missing,
      final_count: finals.length,
      total_count: all.length,
      completeness
    };
  });

  return {
    rows: rows.sort((a, b) => a.section_id.localeCompare(b.section_id)),
    summary: {
      included_sections: rows.length,
      all_required_final: rows.filter((r) => r.missing_types.length === 0).length,
      missing_required_total: rows.reduce((n, r) => n + r.missing_types.length, 0),
      final_artifacts_total: rows.reduce((n, r) => n + r.final_count, 0)
    }
  };
}

function evaluateCiArtifactGate(
  audit: ArtifactAuditResult,
  threshold: number,
  warning?: string,
  strictWarningFail?: boolean
): CiGateResult {
  const failing = audit.rows
    .filter((r) => r.missing_types.length > 0 || r.completeness < threshold)
    .map((r) => ({
      section_id: r.section_id,
      completeness: r.completeness,
      missing_required_types: r.missing_types
    }));

  const reasons: string[] = [];
  if (failing.some((f) => f.missing_required_types.length > 0)) {
    reasons.push("One or more sections are missing required final artifact types.");
  }
  if (failing.some((f) => f.completeness < threshold)) {
    reasons.push(`One or more sections are below CI completeness threshold (${threshold}%).`);
  }

  if (strictWarningFail && warning) {
    reasons.push(`Strict warning failure: ${warning}`);
  }

  return {
    pass: failing.length === 0 && !(strictWarningFail && warning),
    threshold,
    reasons,
    failing_sections: failing,
    warning
  };
}

function buildMarkdownBrief(
  manifest: SectionsManifest,
  options: {
    focusId?: string;
    depth: number;
    includeIds: Set<string>;
    artifactsManifest?: ArtifactsManifest;
    artifactsPath?: string;
    artifactsWarning?: string;
  }
): string {
  const byId = byIdMap(manifest);
  const doctor = computeDoctorReport(manifest);

  const includedSections = manifest.sections
    .filter((s) => options.includeIds.has(s.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const mermaid = buildMermaid(manifest, {
    focusId: options.focusId,
    depth: options.depth,
    includeIds: options.includeIds
  });

  const lines: string[] = [];
  lines.push(`# Milestone Brief${options.focusId ? `: ${options.focusId}` : ""}`);
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Engine target: ${manifest.engine_target}`);
  lines.push(`- Project type: ${manifest.project_type}`);
  lines.push(`- Focus: ${options.focusId ?? "full roadmap"}`);
  lines.push(`- Depth: ${options.depth}`);
  if (options.artifactsPath) lines.push(`- Artifacts source: ${options.artifactsPath}`);
  lines.push("");

  if (options.artifactsWarning) {
    lines.push("> ⚠️ Artifact manifest warning");
    lines.push(">");
    lines.push(`> ${options.artifactsWarning}`);
    lines.push("");
  }

  lines.push("## Graph");
  lines.push("");
  lines.push("```mermaid");
  lines.push(mermaid);
  lines.push("```");
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total sections in manifest: **${doctor.summary.total_sections}**`);
  lines.push(`- Included in this brief: **${includedSections.length}**`);
  lines.push(`- Complete: **${doctor.summary.completed}**`);
  lines.push(`- In progress: **${doctor.summary.in_progress}**`);
  lines.push(`- Blocked: **${doctor.summary.blocked}**`);
  lines.push(`- Not started: **${doctor.summary.not_started}**`);
  lines.push("");

  const readyIncluded = doctor.ready_now.filter((id) => options.includeIds.has(id));
  lines.push("## Ready Now (included scope)");
  lines.push("");
  if (readyIncluded.length === 0) lines.push("- None");
  else readyIncluded.forEach((id) => lines.push(`- ${id} ${byId[id]?.title ?? ""}`));
  lines.push("");

  lines.push("## Included Sections");
  lines.push("");
  lines.push("| ID | Title | Status | Parent | Dependencies | Next |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of includedSections) {
    lines.push(
      `| ${s.id} | ${escapeMd(s.title)} | ${s.status} | ${s.parent_id ?? "-"} | ${(s.dependencies ?? []).join(", ") || "-"} | ${s.next_section_id ?? "-"} |`
    );
  }
  lines.push("");

  lines.push("## Blockers (included scope)");
  lines.push("");
  lines.push("| Section | Blocker |");
  lines.push("|---|---|");
  let blockerCount = 0;
  for (const s of includedSections) {
    const blockers = findBlockers(manifest, s.id);
    if (blockers.length === 0) continue;
    for (const b of blockers) {
      blockerCount++;
      lines.push(`| ${s.id} | ${escapeMd(b)} |`);
    }
  }
  if (blockerCount === 0) lines.push("| - | No blockers detected in included scope |");
  lines.push("");

  if (options.artifactsManifest) {
    const audit = buildArtifactAudit(manifest, options.artifactsManifest, options.includeIds);

    lines.push("## Artifact Completeness Summary");
    lines.push("");
    lines.push(`- Included sections audited: **${audit.summary.included_sections}**`);
    lines.push(`- Sections with all required final artifacts: **${audit.summary.all_required_final}**`);
    lines.push(`- Missing required artifact entries: **${audit.summary.missing_required_total}**`);
    lines.push(`- Final artifacts in scope: **${audit.summary.final_artifacts_total}**`);
    lines.push("");

    lines.push("## Artifact Status by Section");
    lines.push("");
    lines.push("| Section | Required Types | Final Types Present | Missing Required Types | Final/Total | Completeness |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of audit.rows) {
      lines.push(
        `| ${r.section_id} | ${escapeMd(r.required_types.join(", ") || "-")} | ${escapeMd(r.present_final_types.join(", ") || "-")} | ${escapeMd(r.missing_types.join(", ") || "-")} | ${r.final_count}/${r.total_count} | ${r.completeness}% |`
      );
    }
    lines.push("");
  }

  lines.push("## Onboarding Notes");
  lines.push("");
  lines.push("1. Start with **Ready Now** sections first.");
  lines.push("2. Clear blockers before opening new in-progress branches.");
  lines.push("3. Keep minimum artifact coverage per section (task packet, check report, memory entry).");
  lines.push("");

  return lines.join("\n");
}

/* =========================
 * Report Printing
 * ========================= */

function printDoctorReport(report: ReturnType<typeof computeDoctorReport>): void {
  console.log("🩺 Manifest Doctor Report");
  console.log(`Generated: ${report.generated_at}`);
  console.log("");
  console.log("Summary:");
  console.log(`- Total sections: ${report.summary.total_sections}`);
  console.log(`- Complete: ${report.summary.completed}`);
  console.log(`- In Progress: ${report.summary.in_progress}`);
  console.log(`- Blocked: ${report.summary.blocked}`);
  console.log(`- Not Started: ${report.summary.not_started}`);
  console.log("");

  console.log("Ready now:");
  if (report.ready_now.length === 0) console.log("- none");
  else report.ready_now.forEach((id) => console.log(`- ${id}`));
  console.log("");

  if (report.dependency_violations.length) {
    console.log("Dependency violations:");
    report.dependency_violations.forEach((v) => console.log(`- ${v}`));
    console.log("");
  }

  if (report.parent_child_consistency_issues.length) {
    console.log("Parent-child consistency issues:");
    report.parent_child_consistency_issues.forEach((v) => console.log(`- ${v}`));
    console.log("");
  }

  if (report.next_pointer_issues.length) {
    console.log("Next pointer issues:");
    report.next_pointer_issues.forEach((v) => console.log(`- ${v}`));
    console.log("");
  }

  console.log("Blockers by section:");
  const entries = Object.entries(report.blockers_by_section);
  if (entries.length === 0) {
    console.log("- none");
  } else {
    for (const [sid, blockers] of entries) {
      console.log(`- ${sid}`);
      blockers.forEach((b) => console.log(`  - ${b}`));
    }
  }
}

/* =========================
 * Main
 * ========================= */

function main(): void {
  const [, , cmd, ...rawArgs] = process.argv;
  if (!cmd) {
    usage();
    process.exit(1);
  }

  const { positional: args, flags } = parseFlags(rawArgs);

  try {
    switch (cmd) {
      case "validate": {
        const [manifestPath] = args;
        if (!manifestPath) throw new Error("Missing <manifestPath>");

        const manifest = loadManifest(manifestPath);
        const result = validateSectionsManifest(manifest);

        if (!result.ok) {
          console.error("❌ Manifest invalid:");
          result.errors.forEach((e) => console.error(`- [${e.code}] ${e.detail}`));
          if (result.warnings.length) {
            console.error("\nWarnings:");
            result.warnings.forEach((w) => console.error(`- [${w.code}] ${w.detail}`));
          }
          process.exit(1);
        }

        console.log("✅ Manifest valid.");
        if (result.warnings.length) {
          console.log("Warnings:");
          result.warnings.forEach((w) => console.log(`- [${w.code}] ${w.detail}`));
        }
        break;
      }

      case "topo": {
        const [manifestPath] = args;
        if (!manifestPath) throw new Error("Missing <manifestPath>");
        const manifest = loadManifest(manifestPath);
        const order = assertValidManifest(manifest);
        console.log(order.join(" -> "));
        break;
      }

      case "list-blockers": {
        const [manifestPath, sectionId] = args;
        if (!manifestPath || !sectionId) {
          throw new Error("Usage: list-blockers <manifestPath> <sectionId>");
        }
        const manifest = loadManifest(manifestPath);
        assertValidManifest(manifest);

        const blockers = findBlockers(manifest, sectionId);
        if (blockers.length === 0) {
          console.log(`✅ No blockers for ${sectionId}`);
        } else {
          console.log(`⛔ Blockers for ${sectionId}:`);
          blockers.forEach((b) => console.log(`- ${b}`));
        }
        break;
      }

      case "next": {
        const [manifestPath, sectionId] = args;
        if (!manifestPath || !sectionId) {
          throw new Error("Usage: next <manifestPath> <sectionId>");
        }
        const manifest = loadManifest(manifestPath);
        assertValidManifest(manifest);
        console.log(nextSection(manifest, sectionId));
        break;
      }

      case "doctor": {
        const [manifestPath] = args;
        if (!manifestPath) throw new Error("Usage: doctor <manifestPath>");

        const manifest = loadManifest(manifestPath);
        const validation = validateSectionsManifest(manifest);

        if (!validation.ok) {
          console.error("❌ Manifest invalid. Doctor aborted:");
          validation.errors.forEach((e) => console.error(`- [${e.code}] ${e.detail}`));
          if (validation.warnings.length) {
            console.error("Warnings:");
            validation.warnings.forEach((w) => console.error(`- [${w.code}] ${w.detail}`));
          }
          process.exit(1);
        }

        const report = computeDoctorReport(manifest);
        printDoctorReport(report);

        if (
          report.dependency_violations.length > 0 ||
          report.parent_child_consistency_issues.length > 0 ||
          report.next_pointer_issues.length > 0
        ) {
          process.exit(2);
        }

        break;
      }

      case "export-mermaid": {
        const [manifestPath, positionalOutput] = args;
        if (!manifestPath) {
          throw new Error(
            "Usage: export-mermaid <manifestPath> [outputPath] [--output <path>] [--focus <sectionId>] [--depth <n>] [--format mmd|markdown] [--with-artifacts <path>] [--ci] [--ci-threshold <0-100>] [--ci-strict] [--ci-json <path>]"
          );
        }

        const manifest = loadManifest(manifestPath);
        assertValidManifest(manifest);

        const outputFromFlag = typeof flags.output === "string" ? flags.output : undefined;
        const outPathRaw = outputFromFlag ?? positionalOutput;

        const focusId = typeof flags.focus === "string" ? flags.focus : undefined;
        const depth = typeof flags.depth === "string" ? Number(flags.depth) : 2;
        if (Number.isNaN(depth) || depth < 0) {
          throw new Error(`Invalid --depth value: ${String(flags.depth)}. Must be >= 0.`);
        }

        const format = (typeof flags.format === "string" ? flags.format : "mmd").toLowerCase();
        const isMarkdown = format === "markdown" || format === "md";
        if (!["mmd", "markdown", "md"].includes(format)) {
          throw new Error(`Invalid --format value: ${format}. Use mmd or markdown.`);
        }

        const withArtifactsPath = typeof flags["with-artifacts"] === "string" ? flags["with-artifacts"] : undefined;
        const ciMode = flags.ci === true;
        const ciStrict = flags["ci-strict"] === true;
        const ciThresholdRaw = typeof flags["ci-threshold"] === "string" ? Number(flags["ci-threshold"]) : 100;
        const ciThreshold = Number.isNaN(ciThresholdRaw) ? 100 : ciThresholdRaw;
        if (ciThreshold < 0 || ciThreshold > 100) {
          throw new Error(`Invalid --ci-threshold value: ${ciThreshold}. Must be between 0 and 100.`);
        }
        const ciJsonPath = typeof flags["ci-json"] === "string" ? flags["ci-json"] : undefined;

        const includeIds = focusId
          ? computeFocusedSet(manifest, focusId, depth)
          : new Set(manifest.sections.map((s) => s.id));

        let artifactsManifest: ArtifactsManifest | undefined;
        let artifactsWarning: string | undefined;

        if (withArtifactsPath) {
          try {
            artifactsManifest = loadArtifactsManifest(withArtifactsPath);
            if (artifactsManifest.project_id !== manifest.project_type) {
              artifactsWarning =
                `Artifacts project_id "${artifactsManifest.project_id}" differs from sections project_type "${manifest.project_type}". ` +
                `Audit may still be usable; verify your mapping convention.`;
            }
          } catch (err: any) {
            artifactsWarning = `Could not load artifacts manifest "${withArtifactsPath}": ${err.message}`;
          }
        }

        const outPath =
          outPathRaw ||
          (isMarkdown
            ? focusId
              ? `docs/brief_${focusId.replace(".", "_")}.md`
              : "docs/brief_full.md"
            : focusId
              ? `docs/sections_graph_${focusId.replace(".", "_")}.mmd`
              : "docs/sections_graph.mmd");

        const content = isMarkdown
          ? buildMarkdownBrief(manifest, {
              focusId,
              depth,
              includeIds,
              artifactsManifest,
              artifactsPath: withArtifactsPath,
              artifactsWarning
            })
          : buildMermaid(manifest, { focusId, depth, includeIds });

        const abs = writeFileSafe(outPath, content);
        console.log(`✅ ${isMarkdown ? "Markdown brief" : "Mermaid graph"} written: ${abs}`);
        if (focusId) console.log(`Focused view: section ${focusId}, depth ${depth}`);
        if (!isMarkdown && withArtifactsPath) {
          console.log("ℹ️ --with-artifacts is only applied to --format markdown.");
        }
        if (artifactsWarning) {
          console.log(`⚠️ ${artifactsWarning}`);
        }

        if (ciMode) {
          if (!isMarkdown) {
            console.error("❌ CI gate requires --format markdown.");
            process.exit(3);
          }
          if (!withArtifactsPath) {
            console.error("❌ CI gate requires --with-artifacts <path>.");
            process.exit(3);
          }
          if (!artifactsManifest) {
            console.error("❌ CI gate could not load artifacts manifest.");
            if (artifactsWarning) console.error(`Reason: ${artifactsWarning}`);
            process.exit(3);
          }

          const audit = buildArtifactAudit(manifest, artifactsManifest, includeIds);
          const gate = evaluateCiArtifactGate(audit, ciThreshold, artifactsWarning, ciStrict);

          if (ciJsonPath) {
            const ciPayload = {
              generated_at: new Date().toISOString(),
              focus: focusId ?? null,
              depth,
              format: "markdown",
              threshold: ciThreshold,
              strict_warning: ciStrict,
              warning: artifactsWarning ?? null,
              audit_summary: audit.summary,
              failing_sections: gate.failing_sections,
              pass: gate.pass,
              reasons: gate.reasons
            };
            const jsonAbs = writeFileSafe(ciJsonPath, JSON.stringify(ciPayload, null, 2));
            console.log(`🧾 CI JSON report written: ${jsonAbs}`);
          }

          if (!gate.pass) {
            console.error("❌ CI artifact gate failed.");
            gate.reasons.forEach((r) => console.error(`- ${r}`));
            console.error("Failing sections:");
            gate.failing_sections.forEach((s) => {
              console.error(
                `- ${s.section_id}: completeness=${s.completeness}%, missing=[${s.missing_required_types.join(", ") || "-"}]`
              );
            });
            process.exit(2);
          }

          console.log(`✅ CI artifact gate passed (threshold ${ciThreshold}%).`);
        }

        break;
      }

      default:
        usage();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

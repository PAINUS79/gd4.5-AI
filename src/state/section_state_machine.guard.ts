export type SectionStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete"
  | "regression_blocked";

export interface ChecklistItem {
  id: string;
  text: string;
  status: "not_started" | "in_progress" | "pass" | "fail" | "blocked";
}

export interface Section {
  id: string;
  title: string;
  level: number;
  parent_id: string | null;
  status: SectionStatus;
  goal: string;
  dependencies: string[];
  required_artifact_types: string[];
  checklist: ChecklistItem[];
  completion_message: string;
  next_section_id: string | null;
  completion_rule?: string;
}

export interface SectionsManifest {
  manifest_version: string;
  project_type: string;
  engine_target: string;
  status_enum: string[];
  artifact_types: string[];
  completion_policy: {
    default_rule: string;
    requires_memory_entry: boolean;
    requires_dependency_completion: boolean;
  };
  sections: Section[];
  ui_behavior: {
    line_through_on_complete: boolean;
    confetti_on_complete: boolean;
    confetti_duration_ms: number;
    toast_on_complete: boolean;
    auto_select_next_section: boolean;
    blocked_state_requires_remediation_card: boolean;
  };
}

export interface GuardIssue {
  code:
    | "DUPLICATE_ID"
    | "INVALID_ID_FORMAT"
    | "MISSING_DEPENDENCY"
    | "SELF_DEPENDENCY"
    | "CYCLE_DETECTED"
    | "MISSING_NEXT_SECTION"
    | "MISSING_PARENT"
    | "INVALID_PARENT_LEVEL"
    | "ROOT_WITH_PARENT"
    | "NON_ROOT_WITHOUT_PARENT"
    | "ORPHAN_CHILD_LINK"
    | "INVALID_CHECKLIST_ID"
    | "UNREACHABLE_SECTION";
  severity: "error" | "warning";
  sectionId?: string;
  detail: string;
}

export interface GuardResult {
  ok: boolean;
  errors: GuardIssue[];
  warnings: GuardIssue[];
  topo_order: string[];
  dependency_graph: Record<string, string[]>;
}

const SECTION_ID_RE = /^\d+\.\d+$/;
const CHECK_ID_RE = /^\d+\.\d+\.c\d+$/;

function makeIssue(issue: GuardIssue): GuardIssue {
  return issue;
}

function topoSort(ids: string[], depGraph: Record<string, string[]>): { order: string[]; hasCycle: boolean } {
  const inDegree: Record<string, number> = {};
  const reverseAdj: Record<string, string[]> = {};

  for (const id of ids) {
    inDegree[id] = 0;
    reverseAdj[id] = [];
  }

  for (const node of ids) {
    for (const dep of depGraph[node] ?? []) {
      inDegree[node] += 1;
      reverseAdj[dep].push(node);
    }
  }

  const queue: string[] = ids.filter((id) => inDegree[id] === 0).sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of reverseAdj[n]) {
      inDegree[m] -= 1;
      if (inDegree[m] === 0) {
        queue.push(m);
      }
    }
    queue.sort();
  }

  const hasCycle = order.length !== ids.length;
  return { order, hasCycle };
}

function findUnreachableSections(
  sections: Section[],
  depGraph: Record<string, string[]>,
  roots: string[]
): string[] {
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));
  const reverseDeps: Record<string, string[]> = {};
  const children: Record<string, string[]> = {};

  for (const s of sections) {
    reverseDeps[s.id] = [];
    children[s.id] = [];
  }

  for (const s of sections) {
    for (const d of depGraph[s.id] ?? []) {
      reverseDeps[d].push(s.id);
    }
    if (s.parent_id && children[s.parent_id]) {
      children[s.parent_id].push(s.id);
    }
  }

  const visited = new Set<string>();
  const stack = [...roots];

  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) {
      continue;
    }
    visited.add(cur);

    for (const nxt of reverseDeps[cur] ?? []) {
      stack.push(nxt);
    }

    for (const c of children[cur] ?? []) {
      stack.push(c);
    }

    const nextId = byId[cur]?.next_section_id;
    if (nextId) {
      stack.push(nextId);
    }
  }

  return sections.map((s) => s.id).filter((id) => !visited.has(id));
}

export function validateSectionsManifest(manifest: SectionsManifest): GuardResult {
  const errors: GuardIssue[] = [];
  const warnings: GuardIssue[] = [];

  const sections = manifest.sections ?? [];
  const ids = sections.map((s) => s.id);
  const byId: Record<string, Section> = {};
  const depGraph: Record<string, string[]> = {};

  {
    const seen = new Set<string>();

    for (const s of sections) {
      if (!SECTION_ID_RE.test(s.id)) {
        errors.push(
          makeIssue({
            code: "INVALID_ID_FORMAT",
            severity: "error",
            sectionId: s.id,
            detail: `Section id "${s.id}" must match pattern N.N (e.g., 2.4).`
          })
        );
      }

      if (seen.has(s.id)) {
        errors.push(
          makeIssue({
            code: "DUPLICATE_ID",
            severity: "error",
            sectionId: s.id,
            detail: `Duplicate section id "${s.id}".`
          })
        );
      } else {
        seen.add(s.id);
      }

      byId[s.id] = s;
      depGraph[s.id] = [...(s.dependencies ?? [])];
    }
  }

  for (const s of sections) {
    if (s.level === 1 && s.parent_id !== null) {
      errors.push(
        makeIssue({
          code: "ROOT_WITH_PARENT",
          severity: "error",
          sectionId: s.id,
          detail: `Level 1 section "${s.id}" must have parent_id = null.`
        })
      );
    }

    if (s.level > 1 && s.parent_id === null) {
      errors.push(
        makeIssue({
          code: "NON_ROOT_WITHOUT_PARENT",
          severity: "error",
          sectionId: s.id,
          detail: `Non-root section "${s.id}" must have a parent_id.`
        })
      );
    }

    if (s.parent_id !== null) {
      const p = byId[s.parent_id];
      if (!p) {
        errors.push(
          makeIssue({
            code: "MISSING_PARENT",
            severity: "error",
            sectionId: s.id,
            detail: `Section "${s.id}" references missing parent "${s.parent_id}".`
          })
        );
      } else if (s.level <= p.level) {
        errors.push(
          makeIssue({
            code: "INVALID_PARENT_LEVEL",
            severity: "error",
            sectionId: s.id,
            detail: `Section "${s.id}" level (${s.level}) must be greater than parent "${p.id}" level (${p.level}).`
          })
        );
      }
    }

    for (const c of s.checklist ?? []) {
      if (!CHECK_ID_RE.test(c.id)) {
        errors.push(
          makeIssue({
            code: "INVALID_CHECKLIST_ID",
            severity: "error",
            sectionId: s.id,
            detail: `Checklist id "${c.id}" must match pattern N.N.cN (e.g., 2.4.c1).`
          })
        );
      }
    }
  }

  for (const s of sections) {
    for (const d of s.dependencies ?? []) {
      if (d === s.id) {
        errors.push(
          makeIssue({
            code: "SELF_DEPENDENCY",
            severity: "error",
            sectionId: s.id,
            detail: `Section "${s.id}" cannot depend on itself.`
          })
        );
      }

      if (!byId[d]) {
        errors.push(
          makeIssue({
            code: "MISSING_DEPENDENCY",
            severity: "error",
            sectionId: s.id,
            detail: `Section "${s.id}" references missing dependency "${d}".`
          })
        );
      }
    }

    if (s.next_section_id && !byId[s.next_section_id]) {
      errors.push(
        makeIssue({
          code: "MISSING_NEXT_SECTION",
          severity: "error",
          sectionId: s.id,
          detail: `Section "${s.id}" references missing next_section_id "${s.next_section_id}".`
        })
      );
    }
  }

  const topo = topoSort(ids, depGraph);
  if (topo.hasCycle) {
    errors.push(
      makeIssue({
        code: "CYCLE_DETECTED",
        severity: "error",
        detail: "Dependency graph contains one or more cycles."
      })
    );
  }

  for (const s of sections) {
    if (s.parent_id && !byId[s.parent_id]) {
      errors.push(
        makeIssue({
          code: "ORPHAN_CHILD_LINK",
          severity: "error",
          sectionId: s.id,
          detail: `Section "${s.id}" has orphan parent reference "${s.parent_id}".`
        })
      );
    }
  }

  const roots = sections.filter((s) => s.level === 1).map((s) => s.id);
  const unreachable = findUnreachableSections(sections, depGraph, roots);
  for (const u of unreachable) {
    warnings.push(
      makeIssue({
        code: "UNREACHABLE_SECTION",
        severity: "warning",
        sectionId: u,
        detail: `Section "${u}" appears unreachable from root traversal (deps/children/next links).`
      })
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    topo_order: topo.order,
    dependency_graph: depGraph
  };
}

export function assertValidManifest(manifest: SectionsManifest): string[] {
  const result = validateSectionsManifest(manifest);
  if (!result.ok) {
    const lines = result.errors.map((e) => `- [${e.code}] ${e.detail}`);
    throw new Error(`Invalid sections manifest:\n${lines.join("\n")}`);
  }
  return result.topo_order;
}

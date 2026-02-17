/* eslint-disable no-console */

export type SectionStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete"
  | "regression_blocked";

export type ChecklistStatus = "not_started" | "pass" | "fail" | "blocked";

export interface ChecklistItem {
  id: string;
  text: string;
  status: ChecklistStatus;
}

export interface ArtifactRef {
  artifact_id: string;
  artifact_type: string;
  status: "draft" | "final" | "failed" | "superseded";
  verify_pass?: boolean;
}

export interface Section {
  id: string;
  title: string;
  status: SectionStatus;
  goal: string;
  dependencies: string[];
  required_artifact_types: string[];
  checklist: ChecklistItem[];
  completion_rule?: string;
  completion_message?: string;
  next_section_id?: string | null;
  parent_id?: string | null;
  level?: number;
}

export interface SectionStore {
  byId: Record<string, Section>;
  childrenByParent: Record<string, string[]>;
  artifactsBySection: Record<string, ArtifactRef[]>;
}

export type SectionEvent =
  | { type: "SECTION_START"; sectionId: string }
  | { type: "SECTION_BLOCK"; sectionId: string; reason?: string }
  | { type: "SECTION_UNBLOCK"; sectionId: string }
  | { type: "CHECKLIST_SET"; sectionId: string; checklistId: string; status: ChecklistStatus }
  | { type: "ARTIFACT_ADD"; sectionId: string; artifact: ArtifactRef }
  | { type: "ARTIFACT_UPDATE"; sectionId: string; artifactId: string; patch: Partial<ArtifactRef> }
  | { type: "VERIFY_RESULT"; sectionId: string; pass: boolean }
  | { type: "TRY_COMPLETE"; sectionId: string }
  | { type: "REGRESSION_DETECTED"; sectionId: string; reason?: string };

export interface UiEvent {
  type:
    | "NONE"
    | "SHOW_TOAST"
    | "SHOW_CONFETTI"
    | "STRIKETHROUGH_SECTION"
    | "AUTO_SELECT_SECTION"
    | "SHOW_BLOCKED_CARD";
  payload?: Record<string, unknown>;
}

export interface TransitionResult {
  store: SectionStore;
  uiEvents: UiEvent[];
}

function cloneStore(store: SectionStore): SectionStore {
  return {
    byId: JSON.parse(JSON.stringify(store.byId)),
    childrenByParent: JSON.parse(JSON.stringify(store.childrenByParent)),
    artifactsBySection: JSON.parse(JSON.stringify(store.artifactsBySection))
  };
}

function getChildren(store: SectionStore, sectionId: string): Section[] {
  const childIds = store.childrenByParent[sectionId] ?? [];
  return childIds.map((id) => store.byId[id]).filter(Boolean);
}

function allDependenciesComplete(store: SectionStore, section: Section): boolean {
  return section.dependencies.every((depId) => store.byId[depId]?.status === "complete");
}

function allChecklistPass(section: Section): boolean {
  return section.checklist.length > 0 && section.checklist.every((c) => c.status === "pass");
}

function requiredArtifactsPresentAndFinal(
  artifacts: ArtifactRef[],
  requiredTypes: string[]
): boolean {
  const finals = artifacts.filter((a) => a.status === "final");
  return requiredTypes.every((t) => finals.some((a) => a.artifact_type === t));
}

function verifyPassFromArtifacts(artifacts: ArtifactRef[]): boolean {
  const finalChecks = artifacts.filter(
    (a) => a.status === "final" && (a.artifact_type === "check_report" || typeof a.verify_pass === "boolean")
  );
  if (finalChecks.length === 0) return false;
  return finalChecks.some((a) => a.verify_pass === true || a.artifact_type === "check_report");
}

function isParent(section: Section, store: SectionStore): boolean {
  return (store.childrenByParent[section.id] ?? []).length > 0;
}

function allChildrenComplete(store: SectionStore, section: Section): boolean {
  const children = getChildren(store, section.id);
  return children.length > 0 && children.every((c) => c.status === "complete");
}

function canCompleteSection(store: SectionStore, section: Section): { ok: boolean; reason?: string } {
  if (!allDependenciesComplete(store, section)) {
    return { ok: false, reason: "Dependencies incomplete." };
  }

  if (isParent(section, store)) {
    if (!allChildrenComplete(store, section)) {
      return { ok: false, reason: "Child sections not complete." };
    }
    return { ok: true };
  }

  const artifacts = store.artifactsBySection[section.id] ?? [];
  const checklistPass = allChecklistPass(section);
  const artifactsPass = requiredArtifactsPresentAndFinal(artifacts, section.required_artifact_types);
  const verifyPass = verifyPassFromArtifacts(artifacts);

  if (!checklistPass) return { ok: false, reason: "Checklist incomplete or failing." };
  if (!artifactsPass) return { ok: false, reason: "Required final artifacts missing." };
  if (!verifyPass) return { ok: false, reason: "Verification not passed." };

  return { ok: true };
}

function autoCompleteParentChain(store: SectionStore, startingSectionId: string, uiEvents: UiEvent[]): void {
  let current = store.byId[startingSectionId];
  while (current?.parent_id) {
    const parent = store.byId[current.parent_id];
    if (!parent) break;

    const can = canCompleteSection(store, parent);
    if (can.ok && parent.status !== "complete") {
      parent.status = "complete";
      uiEvents.push(
        { type: "STRIKETHROUGH_SECTION", payload: { sectionId: parent.id } },
        { type: "SHOW_CONFETTI", payload: { sectionId: parent.id, durationMs: 2600 } },
        {
          type: "SHOW_TOAST",
          payload: {
            sectionId: parent.id,
            message: parent.completion_message ?? `Congratulations on completing section ${parent.id}!`
          }
        }
      );
    }
    current = parent;
  }
}

const legalTransitions: Record<SectionStatus, SectionStatus[]> = {
  not_started: ["in_progress", "blocked"],
  in_progress: ["blocked", "complete", "regression_blocked"],
  blocked: ["in_progress", "regression_blocked"],
  complete: ["regression_blocked"],
  regression_blocked: ["in_progress", "complete"]
};

function transitionStatus(
  section: Section,
  target: SectionStatus,
  uiEvents: UiEvent[],
  reason?: string
): boolean {
  const allowed = legalTransitions[section.status];
  if (!allowed.includes(target)) {
    uiEvents.push({
      type: "SHOW_TOAST",
      payload: {
        sectionId: section.id,
        message: `Illegal transition ${section.status} -> ${target}`
      }
    });
    return false;
  }

  section.status = target;

  if (target === "blocked" || target === "regression_blocked") {
    uiEvents.push({
      type: "SHOW_BLOCKED_CARD",
      payload: { sectionId: section.id, reason: reason ?? "Blocked by unmet checks/dependencies." }
    });
  }

  return true;
}

export function reduceSectionEvent(store: SectionStore, event: SectionEvent): TransitionResult {
  const next = cloneStore(store);
  const uiEvents: UiEvent[] = [];
  const section = next.byId[(event as any).sectionId];

  if (!section && event.type !== "ARTIFACT_ADD" && event.type !== "ARTIFACT_UPDATE") {
    return {
      store: next,
      uiEvents: [{ type: "SHOW_TOAST", payload: { message: `Unknown section ${String((event as any).sectionId)}` } }]
    };
  }

  switch (event.type) {
    case "SECTION_START": {
      if (!allDependenciesComplete(next, section)) {
        transitionStatus(section, "blocked", uiEvents, "Dependencies incomplete.");
        break;
      }
      transitionStatus(section, "in_progress", uiEvents);
      break;
    }

    case "SECTION_BLOCK": {
      if (section.status === "complete") {
        transitionStatus(section, "regression_blocked", uiEvents, event.reason);
      } else {
        transitionStatus(section, "blocked", uiEvents, event.reason);
      }
      break;
    }

    case "SECTION_UNBLOCK": {
      transitionStatus(section, "in_progress", uiEvents);
      break;
    }

    case "CHECKLIST_SET": {
      const item = section.checklist.find((c) => c.id === event.checklistId);
      if (!item) {
        uiEvents.push({
          type: "SHOW_TOAST",
          payload: { sectionId: section.id, message: `Checklist item not found: ${event.checklistId}` }
        });
        break;
      }
      item.status = event.status;
      if (event.status === "fail" || event.status === "blocked") {
        if (section.status === "complete") {
          transitionStatus(section, "regression_blocked", uiEvents, `Checklist ${item.id} no longer passing.`);
        } else if (section.status !== "blocked") {
          transitionStatus(section, "blocked", uiEvents, `Checklist ${item.id} failed.`);
        }
      }
      break;
    }

    case "ARTIFACT_ADD": {
      const sec = next.byId[event.sectionId];
      if (!sec) {
        uiEvents.push({
          type: "SHOW_TOAST",
          payload: { message: `Unknown section ${event.sectionId}` }
        });
        break;
      }
      if (!next.artifactsBySection[event.sectionId]) {
        next.artifactsBySection[event.sectionId] = [];
      }
      next.artifactsBySection[event.sectionId].push(event.artifact);
      break;
    }

    case "ARTIFACT_UPDATE": {
      const sec = next.byId[event.sectionId];
      if (!sec) {
        uiEvents.push({
          type: "SHOW_TOAST",
          payload: { message: `Unknown section ${event.sectionId}` }
        });
        break;
      }
      const arr = next.artifactsBySection[event.sectionId] ?? [];
      const idx = arr.findIndex((a) => a.artifact_id === event.artifactId);
      if (idx < 0) {
        uiEvents.push({
          type: "SHOW_TOAST",
          payload: { sectionId: event.sectionId, message: `Artifact not found: ${event.artifactId}` }
        });
        break;
      }
      arr[idx] = { ...arr[idx], ...event.patch };
      break;
    }

    case "VERIFY_RESULT": {
      if (!next.artifactsBySection[section.id]) next.artifactsBySection[section.id] = [];
      next.artifactsBySection[section.id].push({
        artifact_id: `verify:${section.id}:${Date.now()}`,
        artifact_type: "check_report",
        status: event.pass ? "final" : "failed",
        verify_pass: event.pass
      });

      if (!event.pass) {
        if (section.status === "complete") {
          transitionStatus(section, "regression_blocked", uiEvents, "Verification failed after completion.");
        } else {
          transitionStatus(section, "blocked", uiEvents, "Verification failed.");
        }
      }
      break;
    }

    case "TRY_COMPLETE": {
      const sec = next.byId[event.sectionId];
      if (!sec) {
        uiEvents.push({ type: "SHOW_TOAST", payload: { message: `Unknown section ${event.sectionId}` } });
        break;
      }

      if (sec.status === "not_started") {
        transitionStatus(sec, "in_progress", uiEvents);
      }

      const can = canCompleteSection(next, sec);
      if (!can.ok) {
        if (sec.status === "complete") {
          transitionStatus(sec, "regression_blocked", uiEvents, can.reason);
        } else {
          transitionStatus(sec, "blocked", uiEvents, can.reason);
        }
        break;
      }

      const moved = transitionStatus(sec, "complete", uiEvents);
      if (!moved) break;

      uiEvents.push(
        { type: "STRIKETHROUGH_SECTION", payload: { sectionId: sec.id } },
        { type: "SHOW_CONFETTI", payload: { sectionId: sec.id, durationMs: 2600 } },
        {
          type: "SHOW_TOAST",
          payload: {
            sectionId: sec.id,
            message: sec.completion_message ?? `🎉 Congratulations on completing section ${sec.id}!`
          }
        }
      );

      if (sec.next_section_id) {
        uiEvents.push({
          type: "AUTO_SELECT_SECTION",
          payload: { sectionId: sec.next_section_id }
        });
      }

      autoCompleteParentChain(next, sec.id, uiEvents);

      break;
    }

    case "REGRESSION_DETECTED": {
      if (section.status === "complete") {
        transitionStatus(section, "regression_blocked", uiEvents, event.reason ?? "Regression detected.");
      } else {
        transitionStatus(section, "blocked", uiEvents, event.reason ?? "Regression risk detected.");
      }
      break;
    }

    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled event ${(event as any).type}`);
    }
  }

  return { store: next, uiEvents };
}

export function computeProgress(store: SectionStore): { total: number; complete: number; percent: number } {
  const sections = Object.values(store.byId);
  const total = sections.length;
  const complete = sections.filter((s) => s.status === "complete").length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return { total, complete, percent };
}

export function initializeStore(sections: Section[]): SectionStore {
  const byId: Record<string, Section> = {};
  const childrenByParent: Record<string, string[]> = {};
  for (const s of sections) {
    byId[s.id] = JSON.parse(JSON.stringify(s));
    if (s.parent_id) {
      if (!childrenByParent[s.parent_id]) childrenByParent[s.parent_id] = [];
      childrenByParent[s.parent_id].push(s.id);
    }
  }
  return {
    byId,
    childrenByParent,
    artifactsBySection: {}
  };
}

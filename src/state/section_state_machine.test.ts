import { describe, it, expect } from "vitest";
import {
  initializeStore,
  reduceSectionEvent,
  computeProgress,
  type Section,
  type SectionStore
} from "./section_state_machine";

function seedSections(): Section[] {
  return [
    {
      id: "1.0",
      title: "Foundation",
      level: 1,
      parent_id: null,
      status: "not_started",
      goal: "Parent section",
      dependencies: [],
      required_artifact_types: ["check_report", "memory_entry"],
      checklist: [{ id: "1.0.c1", text: "All children complete", status: "not_started" }],
      completion_rule: "all_children_complete",
      completion_message: "Congrats 1.0",
      next_section_id: "2.0"
    },
    {
      id: "1.1",
      title: "Child A",
      level: 2,
      parent_id: "1.0",
      status: "not_started",
      goal: "Leaf A",
      dependencies: [],
      required_artifact_types: ["task_packet", "check_report", "memory_entry"],
      checklist: [{ id: "1.1.c1", text: "A done", status: "not_started" }],
      completion_message: "Congrats 1.1",
      next_section_id: "1.2"
    },
    {
      id: "1.2",
      title: "Child B depends on 1.1",
      level: 2,
      parent_id: "1.0",
      status: "not_started",
      goal: "Leaf B",
      dependencies: ["1.1"],
      required_artifact_types: ["task_packet", "check_report", "memory_entry"],
      checklist: [{ id: "1.2.c1", text: "B done", status: "not_started" }],
      completion_message: "Congrats 1.2",
      next_section_id: "2.0"
    },
    {
      id: "2.0",
      title: "Next parent",
      level: 1,
      parent_id: null,
      status: "not_started",
      goal: "Next",
      dependencies: ["1.0"],
      required_artifact_types: ["check_report", "memory_entry"],
      checklist: [{ id: "2.0.c1", text: "later", status: "not_started" }],
      completion_message: "Congrats 2.0",
      next_section_id: null
    }
  ];
}

function addPassingArtifacts(store: SectionStore, sectionId: string): SectionStore {
  let s = reduceSectionEvent(store, {
    type: "ARTIFACT_ADD",
    sectionId,
    artifact: {
      artifact_id: `${sectionId}:task`,
      artifact_type: "task_packet",
      status: "final"
    }
  }).store;

  s = reduceSectionEvent(s, {
    type: "ARTIFACT_ADD",
    sectionId,
    artifact: {
      artifact_id: `${sectionId}:memory`,
      artifact_type: "memory_entry",
      status: "final"
    }
  }).store;

  s = reduceSectionEvent(s, {
    type: "VERIFY_RESULT",
    sectionId,
    pass: true
  }).store;

  return s;
}

describe("section_state_machine", () => {
  it("blocks start when dependencies are incomplete", () => {
    const store = initializeStore(seedSections());
    const result = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.2" });

    expect(result.store.byId["1.2"].status).toBe("blocked");
    expect(result.uiEvents.some((e) => e.type === "SHOW_BLOCKED_CARD")).toBe(true);
  });

  it("completes a leaf section when checklist + artifacts + verify are satisfied", () => {
    let store = initializeStore(seedSections());

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "pass"
    }).store;
    store = addPassingArtifacts(store, "1.1");

    const done = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" });
    expect(done.store.byId["1.1"].status).toBe("complete");
    expect(done.uiEvents.some((e) => e.type === "SHOW_CONFETTI")).toBe(true);
    expect(done.uiEvents.some((e) => e.type === "STRIKETHROUGH_SECTION")).toBe(true);
  });

  it("fails completion when required artifacts are missing", () => {
    let store = initializeStore(seedSections());

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "pass"
    }).store;

    store = reduceSectionEvent(store, { type: "VERIFY_RESULT", sectionId: "1.1", pass: true }).store;

    const result = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" });
    expect(result.store.byId["1.1"].status).toBe("blocked");
    expect(result.uiEvents.some((e) => e.type === "SHOW_BLOCKED_CARD")).toBe(true);
  });

  it("moves complete section to regression_blocked on regression event", () => {
    let store = initializeStore(seedSections());

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "pass"
    }).store;
    store = addPassingArtifacts(store, "1.1");
    store = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" }).store;
    expect(store.byId["1.1"].status).toBe("complete");

    const reg = reduceSectionEvent(store, {
      type: "REGRESSION_DETECTED",
      sectionId: "1.1",
      reason: "Post-merge test failed"
    });

    expect(reg.store.byId["1.1"].status).toBe("regression_blocked");
    expect(reg.uiEvents.some((e) => e.type === "SHOW_BLOCKED_CARD")).toBe(true);
  });

  it("auto-completes parent when all children are complete", () => {
    let store = initializeStore(seedSections());

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "pass"
    }).store;
    store = addPassingArtifacts(store, "1.1");
    store = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" }).store;

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.2" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.2",
      checklistId: "1.2.c1",
      status: "pass"
    }).store;
    store = addPassingArtifacts(store, "1.2");
    const done12 = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.2" });

    expect(done12.store.byId["1.0"].status).toBe("complete");
    expect(done12.uiEvents.some((e) => e.type === "SHOW_CONFETTI")).toBe(true);
  });

  it("progress computation reflects completed sections", () => {
    let store = initializeStore(seedSections());

    const p0 = computeProgress(store);
    expect(p0.complete).toBe(0);
    expect(p0.total).toBe(4);

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "pass"
    }).store;
    store = addPassingArtifacts(store, "1.1");
    store = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" }).store;

    const p1 = computeProgress(store);
    expect(p1.complete).toBeGreaterThanOrEqual(1);
    expect(p1.percent).toBeGreaterThan(0);
  });

  it("rejects illegal direct transition by trying complete from blocked without fixing checks", () => {
    let store = initializeStore(seedSections());

    store = reduceSectionEvent(store, { type: "SECTION_START", sectionId: "1.1" }).store;
    store = reduceSectionEvent(store, {
      type: "CHECKLIST_SET",
      sectionId: "1.1",
      checklistId: "1.1.c1",
      status: "fail"
    }).store;
    expect(store.byId["1.1"].status).toBe("blocked");

    const attempt = reduceSectionEvent(store, { type: "TRY_COMPLETE", sectionId: "1.1" });
    expect(attempt.store.byId["1.1"].status).toBe("blocked");
  });
});

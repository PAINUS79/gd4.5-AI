# GDScript Style Guide (Godot 4.5)

## Purpose
This guide defines code style for all scripts in this project so humans and AI agents produce consistent, maintainable code.

---

## 1) Version and language lock

- Engine target: **Godot 4.5**
- Language: **GDScript**
- Scripts must avoid deprecated patterns from older Godot versions unless clearly documented.

---

## 2) Naming conventions

- **Files**: `snake_case.gd`
- **Classes (`class_name`)**: `PascalCase`
- **Functions**: `snake_case`
- **Variables/constants**:
  - vars: `snake_case`
  - constants: `UPPER_SNAKE_CASE`
- **Signals**: past-tense/event style in `snake_case`
  - Examples: `health_changed`, `enemy_defeated`, `interaction_requested`

---

## 3) Script headers (required)

Every reusable script must begin with a metadata block:

```gdscript
# @module: movement
# @purpose: Handles 2D player movement with jump and gravity.
# @dependencies: InputMap actions: move_left, move_right, jump
# @contracts: Must extend CharacterBody2D
# @owned_by: gameplay_movement_lane
# @last_verified: YYYY-MM-DD
```

---

## 4) Typing and API clarity

- Prefer explicit typing for exported vars, function args, and returns.
- Use `class_name` for reusable scripts.
- Avoid untyped dictionaries for critical runtime paths unless documented.

Example:

```gdscript
extends Node
class_name DamageEvent

var amount: int
var source: Node
```

---

## 5) Node access and scene safety

- Do not hardcode fragile deep node paths in logic scripts.
- Prefer:

```gdscript
@export var some_node_path: NodePath
```

- Required child contracts documented in `scene_contracts.md`.
- Validate critical node lookups in `_ready()` and fail loudly with clear errors.

---

## 6) Input handling

- Use InputMap actions (`Input.is_action_*`, `Input.get_axis()`).
- Never hardcode keycodes in gameplay scripts.
- Input action names must be listed in `api_contracts.md`.

---

## 7) Physics and process loops

- Put movement/physics in `_physics_process(delta)`.
- Put non-physics visual/UI updates in `_process(delta)`.
- Do not mix deterministic physics behavior into `_process`.

---

## 8) Signals over tight coupling

- Prefer signals/event bus for cross-system communication.
- Avoid chains of `get_parent().get_parent()` as architecture.
- If two systems talk frequently, define contract or event payload explicitly.

---

## 9) Function design rules

- One function = one clear responsibility.
- Keep functions small; extract helpers when function exceeds ~40 lines.
- Early returns are preferred over deep nested conditionals.

---

## 10) Error and debug policy

- Use `push_error()` / `assert()` for contract violations in development paths.
- Include actionable messages:

bad: `"Missing node"`

good: `"PlayerMove2D requires child node 'Sprite2D' at res://.../player.tscn"`

---

## 11) AI patch discipline

AI-generated patches must:

- Edit only task-authorized files.
- Include assumptions list.
- Include acceptance checks.
- Avoid opportunistic refactors.
- Add/update tests when behavior changes.

---

## 12) Formatting and comments

- Prefer clear code over excessive comments.
- Comments should explain why, not restate what.
- Keep whitespace and grouping readable and consistent.

---

## 13) Anti-patterns (forbidden)

- Hardcoded input keys in gameplay logic
- Physics movement in `_process`
- Massive god-classes doing unrelated responsibilities
- Silent fallback when required dependencies are missing
- Copy-pasting external code without adapting to project contracts

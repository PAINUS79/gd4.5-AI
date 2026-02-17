# Scene Contracts (Godot 4.5)

## Purpose
Scene trees are treated as API. These contracts define required nodes, names, and attached scripts for stable integration.

## Scene ID Registry

- `SCENE-PLAYER-001` -> Player scene contract
- `SCENE-ENEMY-001` -> Enemy scene contract
- `SCENE-PROJECTILE-001` -> Projectile scene contract
- `SCENE-INTERACTABLE-001` -> Interactable object contract
- `SCENE-MAIN-001` -> Main scene composition contract

---

## 1) Player scene contract

**Scene:** `res://scenes/player/player.tscn`
**Root type:** `CharacterBody2D`
**Root script:** `systems/movement/player_move_2d.gd`

### Required child nodes
- `Sprite2D` (visual)
- `CollisionShape2D` (physics)
- `InteractionDetector` (Area2D or Node-based detector)
- `HealthComponent` (Node with `health_component.gd`)

### Optional child nodes
- `AnimationPlayer`
- `Camera2D`

### Required capabilities
- Responds to InputMap actions:
  - `move_left`, `move_right`, `jump`, `interact`, `attack_primary`
- Emits/forwards interaction and damage events per API contracts

---

## 2) Enemy scene contract

**Scene:** `res://scenes/enemies/enemy_basic.tscn`
**Root type:** `CharacterBody2D`
**Required scripts/components:**
- movement/AI script
- `HealthComponent`
- optional `StateMachine`

### Required child nodes
- `Sprite2D`
- `CollisionShape2D`
- `Hitbox` (Area2D or equivalent)

### Guarantees
- Must be damage-compatible via `apply_damage` path
- Must emit defeat signal/event when dead

---

## 3) Projectile scene contract

**Scene:** `res://scenes/combat/projectile_basic.tscn`
**Root type:** `Area2D`
**Root script:** `systems/combat/projectile_2d.gd`

### Required child nodes
- `CollisionShape2D`
- optional `VisibleOnScreenNotifier2D` (for auto-despawn)

### Required behavior
- Move in assigned direction
- Resolve hit against valid target contract
- Cleanup on impact/despawn

---

## 4) Interactable object contract

**Scene:** `res://scenes/world/interactable_*.tscn`
**Root script:** `systems/interaction/interactable.gd` or subclass

### Required behavior
- Must support `interact(actor: Node) -> void`
- Must emit `interacted(actor)` on successful interaction

### Optional children
- prompt UI node
- collision/area detector

---

## 5) Main scene composition contract

**Scene:** `res://scenes/main/main.tscn`

### Required top-level children
- `World`
- `Player`
- `UI`
- `Systems` (optional container for manager nodes)

### Required autoloads
- `EventBus`
- `GameState` (if used by project architecture)

### Startup guarantees
- Main scene boots without missing-node errors
- Player and UI can initialize even if optional systems are absent

---

## 6) Node naming stability rules

- Required node names in contracts are case-sensitive.
- Renaming required nodes is a breaking change.
- If renaming is necessary:
  1. update this file,
  2. update dependent scripts,
  3. provide migration patch in same task.

---

## 7) Scene validation checklist (used in CI/manual gate)

For each contract scene:
1. Root node type matches contract.
2. Required children exist with exact names.
3. Required scripts attached.
4. Required signals/methods present.
5. Scene instantiates without runtime errors.

---

## 8) Ownership and edit policy

- AI tasks must declare scene ownership scope before editing.
- Parallel tasks cannot edit the same scene file unless explicitly merged by integrator lane.

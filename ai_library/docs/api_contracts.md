# API Contracts (Godot 4.5)

## Purpose
Defines stable interfaces between systems so humans and AI can implement features without breaking integration.

## Contract ID Registry

- `CONTRACT-API-INPUT-001` -> Global input action contract
- `CONTRACT-HEALTH-001` -> HealthComponent contract
- `CONTRACT-INTERACTABLE-001` -> Interactable contract
- `CONTRACT-STATE-001` -> State machine contract
- `CONTRACT-PROJECTILE-001` -> Projectile contract
- `CONTRACT-EVENTBUS-001` -> Event bus contract
- `CONTRACT-ERROR-001` -> Return-value and error contract
- `CONTRACT-CHANGE-001` -> Contract change protocol

---

## 1) Global input action contract

Required InputMap actions:

- `move_left`
- `move_right`
- `move_up`
- `move_down`
- `jump`
- `interact`
- `attack_primary`
- `pause`

Rules:
- Gameplay scripts must use only these action names unless a task explicitly adds new actions.
- Any new action must update this file and include default mapping notes.

---

## 2) HealthComponent contract

**Script:** `systems/combat/health_component.gd`
**Class:** `HealthComponent`

### Public fields
- `max_health: int` (exported)
- `current_health: int`

### Public methods
- `apply_damage(amount: int) -> void`
- `heal(amount: int) -> void`

### Signals
- `health_changed(current: int, max_health: int)`
- `died(owner_node: Node)`

### Behavioral guarantees
- `current_health` clamped to `[0, max_health]`
- `died` emitted exactly once per death transition
- `health_changed` emitted on spawn and every health mutation

---

## 3) Interactable contract

**Script:** `systems/interaction/interactable.gd`
**Class:** `Interactable`

### Public methods
- `interact(actor: Node) -> void`

### Signals
- `interacted(actor: Node)`

### Behavioral guarantees
- `interact()` must be safe to call repeatedly
- Interactions must not crash if `actor` is null; should no-op or warn by policy

---

## 4) State machine contract

**Scripts:**
- `systems/ai/state.gd`
- `systems/ai/state_machine.gd`

### State methods
- `enter(ctx := {}) -> void`
- `exit() -> void`
- `physics_update(delta: float) -> void`

### StateMachine methods
- `transition_to(next_state_path: NodePath, ctx := {}) -> void`

### Guarantees
- Only one active state at a time
- Transition order: current `exit()` then next `enter(ctx)`
- `physics_update` forwarded only to current state

---

## 5) Projectile contract

**Script:** `systems/combat/projectile_2d.gd`

### Required behavior
- Moves every physics tick
- Applies damage to compatible targets
- Frees itself on valid hit or timeout condition

### Compatibility requirement
A target is damage-compatible if it:
- has `apply_damage(amount: int)` directly, or
- exposes a `HealthComponent` reachable via agreed scene contract

---

## 6) Event bus contract (autoload)

**Script:** `systems/core/event_bus.gd`
**Autoload name:** `EventBus`

### Standard signals
- `damage_applied(target: Node, amount: int)`
- `enemy_defeated(enemy: Node)`
- `interaction_requested(actor: Node, target: Node)`
- `game_over`

### Rules
- Event payload types must remain stable.
- Any signal signature change is breaking and must be versioned in changelog.

---

## 7) Return-value and error contract

- Methods that fail due to invalid setup should:
  - return early and log actionable error, or
  - assert in development-only critical paths
- Do not silently mutate unrelated systems as fallback.

---

## 8) Contract change protocol

Any contract change requires:
1. Update this document.
2. Update all dependent scripts.
3. Add/adjust acceptance tests.
4. Add migration note in commit message.

Template:

- **Changed:** [contract section]
- **Reason:** [why]
- **Impact:** [affected systems/scenes]
- **Migration:** [required changes]

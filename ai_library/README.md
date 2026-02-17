# AI Library for Godot 4.5

A comprehensive, AI-friendly library of reusable game systems and components designed for rapid prototyping and consistent development patterns.

## Library Structure

```
ai_library/
├── docs/                         # Contracts and guidelines
│   ├── ai_prompt_contract.md     # AI coding rules (10 core rules)
│   ├── api_contracts.md          # Component API documentation
│   ├── scene_contracts.md        # Required node hierarchies
│   ├── style_guide.md            # Code style conventions
│   └── failure_patterns.md       # Common pitfalls and fixes
│
├── systems/                      # Reusable components
│   ├── core/                     # Foundation systems
│   │   ├── event_bus.gd          # Global event system
│   │   ├── service_locator.gd    # Service registry
│   │   └── game_state.gd         # Persistent state management
│   │
│   ├── movement/                 # Character controllers
│   │   ├── player_move_2d.gd     # Platformer movement
│   │   └── topdown_move_2d.gd    # Top-down movement
│   │
│   ├── combat/                   # Combat systems
│   │   ├── health_component.gd   # Health management
│   │   ├── hitbox_component.gd   # Damage detection
│   │   └── projectile_2d.gd      # Projectile behavior
│   │
│   ├── ai/                       # AI and state machines
│   │   ├── state.gd              # Base state class
│   │   ├── state_machine.gd      # State machine controller
│   │   ├── chase_state.gd        # Chase behavior
│   │   └── patrol_state.gd       # Patrol behavior
│   │
│   ├── interaction/              # Interaction system
│   │   ├── interactable.gd       # Interactable component
│   │   └── interaction_detector.gd # Interaction detection
│   │
│   └── ui/                       # UI components
│       └── hud_controller.gd     # Basic HUD controller
│
├── examples/                     # Minimal working examples
│   ├── platformer_micro/         # Platformer demo
│   ├── topdown_shooter_micro/    # Top-down shooter demo
│   └── interaction_micro/        # Interaction demo
│
└── tests/                        # Validation and testing
    ├── contracts/                # Contract validation tests
    └── gameplay/                 # Integration tests
```

## Quick Start

### 1. Setup Project Input Map
Add these actions in Project Settings → Input Map:
- `move_left`, `move_right`, `move_up`, `move_down`
- `jump`
- `interact`

### 2. Use Components in Your Scene
```gdscript
# Example: Create a platformer player
CharacterBody2D (extend with PlayerMove2D)
├── CollisionShape2D
├── Sprite2D
├── HealthComponent
└── HitboxComponent
    └── CollisionShape2D
```

### 3. Configure Exports
- Set HitboxComponent's `health_component` export to reference HealthComponent
- Configure movement speeds in PlayerMove2D exports

### 4. Connect Signals
```gdscript
health_component.health_changed.connect(_on_health_changed)
health_component.died.connect(_on_player_died)
```

## Core Philosophy

### Component-Based Design
- Small, focused components
- Clear responsibilities
- Easy to combine and reuse

### Signal-Driven Communication
- Prefer signals over parent coupling
- Use EventBus for global events
- Keep components decoupled

### Contract-Based Development
- Every component documents requirements
- Scene structure is validated
- APIs are clearly defined

### AI-Friendly Architecture
- Clear contracts make AI code generation reliable
- Failure patterns prevent recurring mistakes
- Structured execution loop ensures quality

## The 10 Unbreakable Rules

1. **Use Input Actions** - Never hardcode keys
2. **Physics in _physics_process** - Movement logic belongs in physics ticks
3. **Don't multiply velocity by delta** - move_and_slide() handles it
4. **Prefer signals** - Avoid get_parent() chains
5. **Use static typing** - Type hints for clarity
6. **Respect scene contracts** - Document required nodes
7. **Minimal patches** - One feature at a time
8. **Test behavior changes** - Every change needs verification
9. **Godot 4.5 APIs only** - No outdated code
10. **Consistent style** - Follow the style guide

See [docs/ai_prompt_contract.md](docs/ai_prompt_contract.md) for detailed rules.

## Using With AI Coding Agents

### Recommended Workflow
1. **Retrieve** - Load relevant contracts and components
2. **Generate** - Produce minimal code changes
3. **Verify** - Validate against contracts and run tests
4. **Reflect** - Document what worked/failed
5. **Memorize** - Store patterns for future use

### Prompt Template
```
Task: [Your feature request]

Context:
- Review ai_prompt_contract.md for coding rules
- Check api_contracts.md for [relevant component]
- Verify scene_contracts.md for [node structure]
- Reference failure_patterns.md to avoid [known issues]

Output required:
- Retrieved references
- Assumptions made
- Files touched
- Acceptance checks
- Risk assessment
```

## Documentation

- **[AI Prompt Contract](docs/ai_prompt_contract.md)** - Rules for AI code generation
- **[API Contracts](docs/api_contracts.md)** - Component APIs and usage
- **[Scene Contracts](docs/scene_contracts.md)** - Required node structures
- **[Style Guide](docs/style_guide.md)** - Code formatting and conventions
- **[Failure Patterns](docs/failure_patterns.md)** - Common mistakes and fixes

## Examples

Each example demonstrates a complete minimal game loop:

- **Platformer Micro** - Movement, jumping, basic enemies, health
- **Top-Down Shooter** - 8-dir movement, projectiles, chase AI
- **Interaction** - Detection, prompts, multiple interactable types

Run examples to see components working together.

## Testing

### Contract Tests
Verify components meet their documented contracts:
- Required nodes exist
- Exports are correct types
- Signals emit properly

### Gameplay Tests
Integration tests for complete scenarios:
- Player combat flow
- Enemy AI behavior
- Interaction sequences

## Contributing

When adding new components:

1. **Document the contract** - Update api_contracts.md
2. **Define scene requirements** - Update scene_contracts.md
3. **Add example usage** - Create or update micro example
4. **Write tests** - Add contract and gameplay tests
5. **Follow style guide** - Maintain consistency
6. **Update failure patterns** - Add new gotchas

## Version

- **Library Version**: 1.0
- **Target Engine**: Godot 4.5
- **GDScript Version**: 2.0

## License

This library is structured for AI-assisted game development and rapid prototyping. Use freely in your projects.

---

**Ready to build?** Start with [docs/ai_prompt_contract.md](docs/ai_prompt_contract.md) and explore [examples/](examples/) to see the systems in action.

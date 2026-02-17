# Contract Tests

## Purpose
Automated and manual tests validating that library components follow their documented contracts.

## Test Categories

### Scene Contract Tests
- Verify required node hierarchies
- Check exported variable types
- Validate collision layer configurations
- Confirm signal connections

### API Contract Tests
- Test component initialization
- Verify signal emissions
- Check return types
- Validate state transitions

### Integration Tests
- Movement + Health component interaction
- State machine transitions
- Projectile + Hitbox collision
- Interaction detector + Interactable

## Running Tests

### Manual Verification
1. Load test scene
2. Follow test scenario steps
3. Verify expected behavior
4. Check for error messages in console

### Future: Automated Tests
- GUT (Godot Unit Testing) integration planned
- Automated scene validation
- Regression test suite

## Test Structure
```
tests/contracts/
  test_health_component.gd
  test_state_machine.gd
  test_movement_components.gd
  (more tests coming)
```

Each test file documents:
- What contract is being tested
- Setup requirements
- Expected behavior
- Pass/fail criteria

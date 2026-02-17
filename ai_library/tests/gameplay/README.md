# Gameplay Tests

## Purpose
Integration tests for complete gameplay scenarios combining multiple systems.

## Test Scenarios

### Player Combat Test
- Player takes damage from enemy
- Health depletes correctly
- Death event triggers properly
- Respawn mechanics work

### Enemy AI Test
- Patrol behavior loops through waypoints
- Chase triggers when player in range
- Attack behavior executes correctly
- State transitions are smooth

### Interaction Flow Test
- Detection range is appropriate
- UI prompt appears/disappears
- Interaction executes on input
- Multiple interactables don't conflict

### Projectile Combat Test
- Projectiles spawn with correct direction
- Hit detection works reliably
- Damage applies correctly
- Projectiles clean up properly

## Test Execution

### Manual Test Protocol
1. Load gameplay test scene
2. Execute test scenario steps
3. Observe system interactions
4. Document unexpected behavior
5. Verify resolution

### Test Log Format
```
Test: Player Combat Flow
Date: YYYY-MM-DD
Status: Pass/Fail
Notes: [Observations]
Issues: [Any problems]
```

## Coming Soon
- Automated gameplay recordings
- Performance benchmarks
- Stress tests (many entities)
- Edge case scenarios

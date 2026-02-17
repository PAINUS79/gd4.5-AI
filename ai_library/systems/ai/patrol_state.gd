extends State
class_name PatrolState

## Patrol state for AI enemies
## Contract: requires patrol_points array in context

@export var patrol_speed: float = 100.0
@export var wait_time: float = 2.0

var patrol_points: Array[Vector2] = []
var current_point_index: int = 0
var character: CharacterBody2D
var wait_timer: float = 0.0
var is_waiting: bool = false

func enter(ctx := {}) -> void:
	patrol_points = ctx.get("patrol_points", [])
	character = get_parent().get_parent() as CharacterBody2D
	current_point_index = 0
	is_waiting = false

func physics_update(delta: float) -> void:
	if not character or patrol_points.is_empty():
		return
	
	if is_waiting:
		wait_timer -= delta
		if wait_timer <= 0:
			is_waiting = false
			current_point_index = (current_point_index + 1) % patrol_points.size()
		return
	
	var target_point := patrol_points[current_point_index]
	var distance := character.global_position.distance_to(target_point)
	
	if distance < 10.0:
		is_waiting = true
		wait_timer = wait_time
		character.velocity = Vector2.ZERO
	else:
		var direction := (target_point - character.global_position).normalized()
		character.velocity = direction * patrol_speed
		character.move_and_slide()

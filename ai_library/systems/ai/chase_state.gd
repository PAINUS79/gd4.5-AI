extends State
class_name ChaseState

## Chase state for AI enemies
## Contract: parent must be CharacterBody2D with target tracking

@export var chase_speed: float = 150.0
@export var stop_distance: float = 50.0

var target: Node2D
var character: CharacterBody2D

func enter(ctx := {}) -> void:
	target = ctx.get("target")
	character = get_parent().get_parent() as CharacterBody2D

func physics_update(_delta: float) -> void:
	if not target or not character:
		return
	
	var distance := character.global_position.distance_to(target.global_position)
	
	if distance > stop_distance:
		var direction := (target.global_position - character.global_position).normalized()
		character.velocity = direction * chase_speed
		character.move_and_slide()

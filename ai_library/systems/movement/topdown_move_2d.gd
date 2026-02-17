extends CharacterBody2D
class_name TopDownMove2D

## Top-down 8-directional movement controller
## Contract: Requires InputMap actions: move_left, move_right, move_up, move_down

@export var speed: float = 180.0
@export var acceleration: float = 800.0
@export var friction: float = 900.0

func _physics_process(delta: float) -> void:
	var input_vector := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	if input_vector != Vector2.ZERO:
		velocity = velocity.move_toward(input_vector * speed, acceleration * delta)
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
	
	move_and_slide()

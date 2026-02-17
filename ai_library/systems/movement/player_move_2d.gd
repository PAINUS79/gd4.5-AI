extends CharacterBody2D
class_name PlayerMove2D

@export var speed: float = 220.0
@export var jump_velocity: float = -380.0
@export var gravity_scale: float = 1.0

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity += get_gravity() * gravity_scale * delta

	var move_x := Input.get_axis("move_left", "move_right")
	velocity.x = move_x * speed

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity

	move_and_slide()

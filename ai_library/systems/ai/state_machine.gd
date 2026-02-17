extends Node
class_name StateMachine

@export var initial_state: NodePath
var current_state: State

func _ready() -> void:
	if initial_state != NodePath():
		current_state = get_node(initial_state) as State
		if current_state:
			current_state.enter()

func transition_to(next_state_path: NodePath, ctx := {}) -> void:
	if current_state:
		current_state.exit()
	current_state = get_node(next_state_path) as State
	if current_state:
		current_state.enter(ctx)

func _physics_process(delta: float) -> void:
	if current_state:
		current_state.physics_update(delta)

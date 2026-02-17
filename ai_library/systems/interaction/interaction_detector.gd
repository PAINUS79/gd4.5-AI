extends Area2D
class_name InteractionDetector

## Detects and triggers interactable objects
## Contract: Requires InputMap action "interact"

signal interaction_available(interactable: Interactable)
signal interaction_unavailable

var current_interactable: Interactable = null

func _ready() -> void:
	area_entered.connect(_on_area_entered)
	area_exit.connect(_on_area_exited)

func _process(_delta: float) -> void:
	if Input.is_action_just_pressed("interact") and current_interactable:
		current_interactable.interact(owner)

func _on_area_entered(area: Area2D) -> void:
	var interactable := _find_interactable(area)
	if interactable:
		current_interactable = interactable
		interaction_available.emit(interactable)

func _on_area_exited(area: Area2D) -> void:
	var interactable := _find_interactable(area)
	if interactable and interactable == current_interactable:
		current_interactable = null
		interaction_unavailable.emit()

func _find_interactable(node: Node) -> Interactable:
	if node is Interactable:
		return node
	for child in node.get_children():
		if child is Interactable:
			return child
	return null

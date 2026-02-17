extends Node
class_name Interactable

signal interacted(actor: Node)

func interact(actor: Node) -> void:
	interacted.emit(actor)

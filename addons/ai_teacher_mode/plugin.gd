@tool
extends EditorPlugin

var dock_instance: Control

func _enter_tree() -> void:
	var scene := load("res://addons/ai_teacher_mode/teacher_dock.tscn")
	dock_instance = scene.instantiate()
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, dock_instance)
	dock_instance.name = "AI Teacher"

func _exit_tree() -> void:
	if dock_instance:
		remove_control_from_docks(dock_instance)
		dock_instance.queue_free()

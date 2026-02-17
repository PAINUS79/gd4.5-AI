extends Control
class_name HUDController

## Basic HUD controller with common UI elements
## Contract: expects child nodes for health display

signal health_display_updated(current: int, max_value: int)

@export var health_component: HealthComponent

func _ready() -> void:
	if health_component:
		health_component.health_changed.connect(_on_health_changed)
		_on_health_changed(health_component.current_health, health_component.max_health)

func _on_health_changed(current: int, max_value: int) -> void:
	health_display_updated.emit(current, max_value)

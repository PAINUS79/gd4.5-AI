extends Node
class_name GameState

## Centralized game state management
## Tracks persistent data across scenes

signal state_changed(key: String, value: Variant)

var _state: Dictionary = {}

func set_value(key: String, value: Variant) -> void:
	_state[key] = value
	state_changed.emit(key, value)

func get_value(key: String, default: Variant = null) -> Variant:
	return _state.get(key, default)

func has_value(key: String) -> bool:
	return _state.has(key)

func clear() -> void:
	_state.clear()

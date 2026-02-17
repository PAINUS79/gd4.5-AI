extends Area2D
class_name HitboxComponent

## Hitbox that detects damage from attackers
## Contract: expects owner to have a HealthComponent

signal hit_received(attacker: Node, damage: int)

@export var health_component: HealthComponent

func _ready() -> void:
	area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
	if area.has_method("get_damage"):
		var damage: int = area.get_damage()
		hit_received.emit(area.owner, damage)
		if health_component:
			health_component.apply_damage(damage)

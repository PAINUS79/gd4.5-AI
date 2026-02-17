extends Area2D
class_name Projectile2D

## Simple projectile with damage and lifetime
## Contract: moves in direction set at spawn

@export var speed: float = 300.0
@export var damage: int = 10
@export var lifetime: float = 5.0

var direction: Vector2 = Vector2.RIGHT

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	get_tree().create_timer(lifetime).timeout.connect(queue_free)

func _physics_process(delta: float) -> void:
	position += direction * speed * delta

func get_damage() -> int:
	return damage

func _on_body_entered(_body: Node2D) -> void:
	queue_free()

func _on_area_entered(_area: Area2D) -> void:
	queue_free()

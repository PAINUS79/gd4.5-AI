extends Node
class_name EventBus

signal damage_applied(target: Node, amount: int)
signal enemy_defeated(enemy: Node)
signal interaction_requested(actor: Node, target: Node)
signal game_over

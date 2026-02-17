extends Node
class_name ServiceLocator

## Service Locator pattern for global service access
## Use sparingly - prefer dependency injection via exports

var _services: Dictionary = {}

func register_service(service_name: String, service: Node) -> void:
	_services[service_name] = service

func get_service(service_name: String) -> Node:
	return _services.get(service_name)

func unregister_service(service_name: String) -> void:
	_services.erase(service_name)

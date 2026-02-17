extends RefCounted
class_name CommandBridge

var project_root: String

func _init(_project_root: String) -> void:
	project_root = _project_root

func _is_windows() -> bool:
	return OS.get_name() == "Windows"

func _is_macos() -> bool:
	return OS.get_name() == "macOS"

func _wrapper_path() -> String:
	if _is_windows():
		return ProjectSettings.globalize_path("res://scripts/run_manifest.bat")
	return ProjectSettings.globalize_path("res://scripts/run_manifest.sh")

func _run_script(npm_script: String, extra_args: PackedStringArray = PackedStringArray()) -> Dictionary:
	var output: Array = []
	var exit_code := -1

	var wrapper := _wrapper_path()

	if _is_windows():
		var args := PackedStringArray(["/c", wrapper, npm_script])
		for a in extra_args:
			args.append(a)
		exit_code = OS.execute("cmd", args, output, true, false)
	else:
		var args := PackedStringArray([wrapper, npm_script])
		for a in extra_args:
			args.append(a)
		exit_code = OS.execute("bash", args, output, true, false)

	return {
		"exit_code": exit_code,
		"stdout": "\n".join(output)
	}

func run_manifest_validate() -> Dictionary:
	return _run_script("manifest:validate")

func run_manifest_doctor() -> Dictionary:
	return _run_script("manifest:doctor")

func run_brief_focus(section_id: String, depth: int) -> Dictionary:
	return _run_script("manifest:brief:custom", PackedStringArray([
		"--output", "docs/brief_focus.md",
		"--focus", section_id,
		"--depth", str(depth),
		"--with-artifacts", "src/data/artifacts_manifest.json"
	]))

func run_ci() -> Dictionary:
	return _run_script("manifest:ci")

func run_bootstrap_artifacts() -> Dictionary:
	return _run_script("artifacts:bootstrap")

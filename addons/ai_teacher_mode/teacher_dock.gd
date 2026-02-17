@tool
extends Control

const MANIFEST_PATH := "res://addons/ai_teacher_mode/data/teacher_mode_sections_manifest.json"

@onready var path_select: OptionButton = $VBoxContainer/HBoxContainer/PathSelect
@onready var start_button: Button = $VBoxContainer/HBoxContainer/StartButton
@onready var current_section_label: Label = $VBoxContainer/CurrentSectionLabel
@onready var coach_text: RichTextLabel = $VBoxContainer/CoachText
@onready var do_action_button: Button = $VBoxContainer/HBoxContainer2/DoActionButton
@onready var run_check_button: Button = $VBoxContainer/HBoxContainer2/RunCheckButton
@onready var fix_button: Button = $VBoxContainer/HBoxContainer2/FixButton
@onready var progress_bar: ProgressBar = $VBoxContainer/MilestoneProgress
@onready var section_list: ItemList = $VBoxContainer/SectionList
@onready var log_text: RichTextLabel = $VBoxContainer/LogText

var bridge: CommandBridge
var sections: Array = []
var current_index := 0
var last_results := {}

func _ready() -> void:
	path_select.clear()
	path_select.add_item("Quick Win")
	path_select.add_item("Guided Learn")
	path_select.add_item("Pro Workflow")
	start_button.pressed.connect(_on_start_pressed)
	do_action_button.pressed.connect(_on_do_action_pressed)
	run_check_button.pressed.connect(_on_run_check_pressed)
	fix_button.pressed.connect(_on_fix_pressed)

	bridge = CommandBridge.new(ProjectSettings.globalize_path("res://"))
	_load_manifest()
	_refresh_ui()

func _load_manifest() -> void:
	var f := FileAccess.open(MANIFEST_PATH, FileAccess.READ)
	if f == null:
		_log("Failed to open Teacher Mode manifest.")
		return
	var parsed = JSON.parse_string(f.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		_log("Invalid manifest JSON.")
		return
	sections = parsed.get("sections", [])
	section_list.clear()
	for s in sections:
		section_list.add_item("%s  %s" % [s.get("id", "?"), s.get("title", "Untitled")])

func _refresh_ui() -> void:
	if sections.is_empty():
		current_section_label.text = "No sections loaded."
		return
	current_index = clamp(current_index, 0, sections.size() - 1)
	var s: Dictionary = sections[current_index]
	current_section_label.text = "Current: %s — %s" % [s.get("id", "?"), s.get("title", "")]
	coach_text.text = "[b]Goal:[/b] %s\n[b]Build:[/b] %s\n[b]Time:[/b] %s min" % [
		s.get("learning_goal", ""),
		s.get("build_goal", ""),
		str(s.get("estimated_minutes", "?"))
	]
	var pct := float(current_index) / max(1.0, float(sections.size() - 1)) * 100.0
	progress_bar.value = pct
	section_list.select(current_index)

func _on_start_pressed() -> void:
	current_index = 0
	_log("Teacher Mode started: %s" % path_select.get_item_text(path_select.selected))
	_refresh_ui()

func _on_do_action_pressed() -> void:
	if sections.is_empty():
		return
	var s: Dictionary = sections[current_index]
	var actions: Array = s.get("actions", [])
	if actions.is_empty():
		_log("No actions for section.")
		return
	var action: Dictionary = actions[0]
	_run_action(action)

func _on_run_check_pressed() -> void:
	if sections.is_empty():
		return
	var s: Dictionary = sections[current_index]
	var checks: Array = s.get("checks", [])
	if checks.is_empty():
		_log("No checks for section.")
		return
	_log("Check complete (MVP).")
	_advance_section()

func _on_fix_pressed() -> void:
	_log("Running quick fix: bootstrap artifacts")
	var res = bridge.run_bootstrap_artifacts()
	_log_result("artifacts_bootstrap", res)

func _run_action(action: Dictionary) -> void:
	var cmd_id := action.get("command", "")
	var res := {}
	match cmd_id:
		"manifest_validate":
			res = bridge.run_manifest_validate()
		"manifest_doctor":
			res = bridge.run_manifest_doctor()
		"brief_focus":
			var params: Dictionary = action.get("params", {})
			res = bridge.run_brief_focus(params.get("section_id", "1.1"), int(params.get("depth", 2)))
		"manifest_ci":
			res = bridge.run_ci()
		"artifacts_bootstrap":
			res = bridge.run_bootstrap_artifacts()
		_:
			_log("Unknown command: %s" % cmd_id)
			return
	last_results[cmd_id] = res
	_log_result(cmd_id, res)

func _log_result(cmd_id: String, res: Dictionary) -> void:
	var code := int(res.get("exit_code", -999))
	_log("[cmd=%s] exit=%d" % [cmd_id, code])
	var out := String(res.get("stdout", ""))
	if out.length() > 2000:
		out = out.substr(0, 2000) + "\n... (truncated)"
	_log(out)

func _advance_section() -> void:
	if current_index < sections.size() - 1:
		current_index += 1
		_log("Section complete ✅ advancing...")
		_refresh_ui()
	else:
		_log("All sections complete 🎉")

func _log(msg: String) -> void:
	log_text.append_text(msg + "\n")

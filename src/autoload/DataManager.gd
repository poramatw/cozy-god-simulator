extends Node

var world_config: Dictionary = {}
var agent_config: Dictionary = {}
var biomes: Array = []
var traits: Array = []
var buildings: Array = []
var weather_events: Array = []

signal data_loaded

func _ready() -> void:
	load_all_data()

func load_json_file(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		push_error("DataManager: File not found -> " + path)
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		push_error("DataManager: Failed to open file -> " + path)
		return null
	var text := file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(text)
	if parsed == null:
		push_error("DataManager: JSON parse error in -> " + path)
	return parsed

func load_all_data() -> void:
	var wc = load_json_file("res://assets/data/world_config.json")
	if wc is Dictionary:
		world_config = wc
		if wc.has("biomes") and wc["biomes"] is Array:
			biomes = wc["biomes"]

	var bm = load_json_file("res://assets/data/biomes.json")
	if bm is Dictionary and bm.has("biomes"):
		biomes = bm["biomes"]

	var ac = load_json_file("res://assets/data/agent_config.json")
	if ac is Dictionary:
		agent_config = ac

	var tr = load_json_file("res://assets/data/traits.json")
	if tr is Dictionary and tr.has("traits"):
		traits = tr["traits"]

	var bd = load_json_file("res://assets/data/buildings.json")
	if bd is Dictionary and bd.has("buildings"):
		buildings = bd["buildings"]

	var we = load_json_file("res://assets/data/weather_events.json")
	if we is Dictionary and we.has("weatherEvents"):
		weather_events = we["weatherEvents"]

	data_loaded.emit()
	print("[DataManager] Successfully loaded all game balance datasets.")

func get_biome(biome_id: String) -> Dictionary:
	for b in biomes:
		if b.get("id", "") == biome_id:
			return b
	return {}

func get_building(building_id: String) -> Dictionary:
	for b in buildings:
		if b.get("id", "") == building_id:
			return b
	return {}

func get_trait(trait_id: String) -> Dictionary:
	for t in traits:
		if t.get("id", "") == trait_id:
			return t
	return {}

func get_weather(weather_id: String) -> Dictionary:
	for w in weather_events:
		if w.get("id", "") == weather_id:
			return w
	return {}

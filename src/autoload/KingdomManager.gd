extends Node

signal resources_changed(wood: int, stone: int, food: int, lore: int, faith: int)
signal era_advanced(era_id: String, era_name: String)
signal building_constructed(building_id: String, tile_pos: Vector2i)
signal follower_joined(follower_name: String)

const ERAS = [
	{"id": "stone", "name": "ยุคหินปฐมกาล (Stone Age)", "req_lore": 0, "req_buildings": 1, "color": "#78716c"},
	{"id": "bronze", "name": "ยุคสำริดและชนเผ่า (Tribal Bronze)", "req_lore": 40, "req_buildings": 3, "color": "#b45309"},
	{"id": "medieval", "name": "ยุคกลางและปราสาทหิน (Medieval Kingdom)", "req_lore": 120, "req_buildings": 6, "color": "#3b82f6"},
	{"id": "industrial", "name": "ยุคปฏิวัติอุตสาหกรรม (Industrial Era)", "req_lore": 260, "req_buildings": 10, "color": "#ea580c"},
	{"id": "solarpunk", "name": "ยุคอนาคตแสงอาทิตย์ (Solarpunk Arcology)", "req_lore": 500, "req_buildings": 14, "color": "#10b981"}
]

var current_era_idx: int = 0
var wood: int = 25
var stone: int = 15
var food: int = 40
var lore: int = 0
var faith: int = 10

var built_structures: Dictionary = {
	"campfire": 1
}
var total_buildings_count: int = 1
var max_followers: int = 3
var followers: Array = []

func _ready() -> void:
	pass

func get_current_era() -> Dictionary:
	return ERAS[current_era_idx]

func add_resource(res_type: String, amount: int) -> void:
	match res_type:
		"wood": wood = maxi(0, wood + amount)
		"stone": stone = maxi(0, stone + amount)
		"food": food = maxi(0, food + amount)
		"lore":
			lore = maxi(0, lore + amount)
			check_era_advancement()
		"faith": faith = maxi(0, faith + amount)
	resources_changed.emit(wood, stone, food, lore, faith)

func consume_resources(cost_wood: int, cost_stone: int, cost_food: int = 0) -> bool:
	if wood >= cost_wood and stone >= cost_stone and food >= cost_food:
		wood -= cost_wood
		stone -= cost_stone
		food -= cost_food
		resources_changed.emit(wood, stone, food, lore, faith)
		return true
	return false

func register_building(building_id: String, tile_pos: Vector2i) -> void:
	if not built_structures.has(building_id):
		built_structures[building_id] = 0
	built_structures[building_id] += 1
	total_buildings_count += 1

	var b_data = DataManager.get_building(building_id)
	if not b_data.is_empty():
		var bonus: int = int(b_data.get("followerCapBonus", 1))
		max_followers += bonus

	building_constructed.emit(building_id, tile_pos)
	check_era_advancement()

func check_era_advancement() -> void:
	if current_era_idx >= ERAS.size() - 1:
		return
	var next_era = ERAS[current_era_idx + 1]
	if lore >= next_era["req_lore"] and total_buildings_count >= next_era["req_buildings"]:
		advance_era()

func advance_era() -> void:
	if current_era_idx < ERAS.size() - 1:
		current_era_idx += 1
		var era = ERAS[current_era_idx]
		era_advanced.emit(era["id"], era["name"])
		print("[KingdomManager] Advanced to era: ", era["name"])

func set_era_by_index(idx: int) -> void:
	if idx >= 0 and idx < ERAS.size():
		current_era_idx = idx
		var era = ERAS[current_era_idx]
		era_advanced.emit(era["id"], era["name"])

func get_built_count(building_id: String) -> int:
	return built_structures.get(building_id, 0)

func reset() -> void:
	current_era_idx = 0
	wood = 25
	stone = 15
	food = 40
	lore = 0
	faith = 10
	built_structures.clear()
	built_structures["campfire"] = 1
	total_buildings_count = 1
	max_followers = 3
	followers.clear()
	resources_changed.emit(wood, stone, food, lore, faith)

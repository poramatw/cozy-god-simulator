extends CharacterBody2D
class_name HeroAgent

signal hero_status_updated(status: Dictionary)
signal succession_triggered(candidates: Array)
signal chronicle_recorded(text: String, type: String)

@export var move_speed: float = 85.0

var hero_name: String = "อาเดรียน (Adrian)"
var clan_name: String = "ผู้พิทักษ์แห่งโมริมาร์"
var generation: int = 1

var age: int = 20
var max_age: int = 60
var hunger: float = 85.0
var energy: float = 90.0
var health: float = 100.0

var str_stat: int = 5
var agi_stat: int = 5
var int_stat: int = 5

var current_action: String = "idle" # idle, walk, gather, build, rest, worship
var target_world_pos: Vector2 = Vector2.ZERO
var target_resource_tile: Vector2i = Vector2i(-1, -1)

const DeepCognitionEngineClass = preload("res://src/agent/DeepCognitionEngine.gd")

var cognition: RefCounted
var action_timer: float = 0.0

# Visual nodes
@onready var sprite: Sprite2D = $Sprite2D
@onready var shadow: Sprite2D = $ShadowSprite
@onready var torch_light: PointLight2D = $TorchLight
@onready var thought_bubble: Label = $ThoughtBubble
@onready var walk_dust: CPUParticles2D = $WalkDust

# Textures
var sheet_chars: Texture2D
var tex_infant: AtlasTexture
var tex_child: AtlasTexture
var tex_adult: AtlasTexture
var tex_elder: AtlasTexture

func _ready() -> void:
	cognition = DeepCognitionEngineClass.new()
	setup_character_sprites()

	TimeManager.time_ticked.connect(_on_time_ticked)
	TimeManager.year_passed.connect(_on_year_passed)

	target_world_pos = global_position
	update_thought_bubble("🧭")

func setup_character_sprites() -> void:
	sheet_chars = load("res://assets/sprites/hd_characters_sheet.png") as Texture2D
	if sheet_chars:
		var w: float = sheet_chars.get_width() / 2.0
		var h: float = sheet_chars.get_height() / 2.0
		tex_infant = create_atlas(sheet_chars, Rect2(0, 0, w, h))
		tex_child = create_atlas(sheet_chars, Rect2(w, 0, w, h))
		tex_elder = create_atlas(sheet_chars, Rect2(0, h, w, h))
		tex_adult = create_atlas(sheet_chars, Rect2(w, h, w, h))
	refresh_life_stage_appearance()

func create_atlas(tex: Texture2D, rect: Rect2) -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = tex
	atlas.region = rect
	return atlas

func refresh_life_stage_appearance() -> void:
	if not sprite:
		return
	if age < 4 and tex_infant:
		sprite.texture = tex_infant
		sprite.scale = Vector2(0.045, 0.045)
	elif age < 13 and tex_child:
		sprite.texture = tex_child
		sprite.scale = Vector2(0.055, 0.055)
	elif age < 50 and tex_adult:
		sprite.texture = tex_adult
		sprite.scale = Vector2(0.065, 0.065)
	elif tex_elder:
		sprite.texture = tex_elder
		sprite.scale = Vector2(0.065, 0.065)

func _physics_process(delta: float) -> void:
	if TimeManager.speed == 0:
		velocity = Vector2.ZERO
		return

	if global_position.distance_to(target_world_pos) > 6.0:
		var dir := (target_world_pos - global_position).normalized()
		velocity = dir * move_speed * float(TimeManager.speed)
		move_and_slide()

		if walk_dust:
			walk_dust.emitting = true

		# Bobbing walk animation
		if sprite:
			sprite.position.y = -22.0 + sin(Time.get_ticks_msec() * 0.012) * 2.0
			sprite.flip_h = dir.x < 0
	else:
		velocity = Vector2.ZERO
		if walk_dust:
			walk_dust.emitting = false
		if sprite:
			sprite.position.y = lerpf(sprite.position.y, -22.0, 0.1)

func _on_time_ticked(sim_delta: float) -> void:
	# Deplete needs
	hunger = clampf(hunger - sim_delta * 0.28, 0.0, 100.0)
	energy = clampf(energy - sim_delta * 0.22, 0.0, 100.0)

	if hunger > 50.0 and energy > 50.0:
		health = clampf(health + sim_delta * 0.2, 0.0, 100.0)
	elif hunger <= 0.0 or energy <= 0.0:
		health = clampf(health - sim_delta * 0.35, 0.0, 100.0)

	# Torch light at night
	var clock = TimeManager.get_clock_time()
	if torch_light:
		torch_light.visible = clock["is_night"]

	action_timer -= sim_delta
	if action_timer <= 0.0:
		decide_next_utility_action()

	emit_status_snapshot()

func _on_year_passed(new_year: int) -> void:
	age += 1
	refresh_life_stage_appearance()

	var clock = TimeManager.get_clock_time()
	cognition.record_memory(
		generation,
		hero_name,
		age,
		"ฤดูใบไม้ผลิ",
		"ก้าวสู่วัย %d ปี" % age,
		cognition.generate_inner_monologue(hero_name, age, hunger, energy, health, current_action),
		"peaceful",
		6
	)

	chronicle_recorded.emit("✨ %s เดินทางมาถึงวัย %d ปี — ประวัติศาสตร์ถูกจารึกลงในม้วนคัมภีร์ตระกูล" % [hero_name, age], "milestone")

	# Check Dynasty Succession at age 60
	if age >= max_age:
		trigger_dynasty_succession()

func decide_next_utility_action() -> void:
	action_timer = randf_range(4.0, 7.0)

	# 1. Hunger is top priority
	if hunger < 40.0:
		current_action = "gather"
		update_thought_bubble("🍖")
		seek_nearest_resource("berry_bush")
		hunger = clampf(hunger + 38.0, 0.0, 100.0)
		KingdomManager.add_resource("food", 5)
		return

	# 2. Fatigue rest
	if energy < 35.0:
		current_action = "rest"
		update_thought_bubble("💤")
		seek_nearest_resource("campfire")
		energy = clampf(energy + 45.0, 0.0, 100.0)
		return

	# 3. Construction / Lore building
	if KingdomManager.wood >= 15 and randf() < 0.45:
		current_action = "build"
		update_thought_bubble("🔨")
		seek_nearest_resource("round_hut")
		KingdomManager.add_resource("wood", -8)
		KingdomManager.add_resource("lore", 12)
		return

	# 4. Gathering wood/stone
	if randf() < 0.55:
		current_action = "gather"
		update_thought_bubble("🪓")
		seek_nearest_resource("forest_tree")
		KingdomManager.add_resource("wood", 8)
		KingdomManager.add_resource("lore", 3)
		return

	# 5. Explore & Contemplate
	current_action = "explore"
	update_thought_bubble("🧭")
	var offset := Vector2(randf_range(-120, 120), randf_range(-120, 120))
	target_world_pos = global_position + offset

func seek_nearest_resource(res_type: String) -> void:
	var world_node = get_parent()
	if not world_node:
		return
	var generator = world_node.get_node_or_null("IslandGenerator")
	if not generator:
		return

	var best_dist: float = 999999.0
	var best_pos: Vector2 = global_position

	for r in generator.resources:
		if is_instance_valid(r) and r.name.contains(res_type):
			var d: float = global_position.distance_to(r.global_position)
			if d < best_dist:
				best_dist = d
				best_pos = r.global_position

	target_world_pos = best_pos

func update_thought_bubble(icon: String) -> void:
	if thought_bubble:
		thought_bubble.text = icon

func trigger_dynasty_succession() -> void:
	TimeManager.set_speed(0)
	var candidates: Array = [
		{
			"name": "ไลร่า (Lyra)",
			"branch": "Guardian (ผู้พิทักษ์)",
			"badge": "🛡️",
			"str": str_stat + 3,
			"agi": agi_stat + 1,
			"int": int_stat + 1,
			"perk": "ลดผลกระทบจากภัยพิบัติและสัตว์ป่า 35%"
		},
		{
			"name": "เอลริค (Elric)",
			"branch": "Scholar (ปราชญ์โบราณ)",
			"badge": "📜",
			"str": str_stat,
			"agi": agi_stat + 1,
			"int": int_stat + 4,
			"perk": "อัตราค้นคว้าเทคโนโลยีและก้าวสู่ยุคถัดไปเร็วขึ้น 50%"
		},
		{
			"name": "ไคเลน (Kaelen)",
			"branch": "Pioneer (ผู้บุกเบิก)",
			"badge": "🏹",
			"str": str_stat + 1,
			"agi": agi_stat + 4,
			"int": int_stat + 1,
			"perk": "ความเร็วในการเก็บเกี่ยวทรัพยากร +40%"
		}
	]
	succession_triggered.emit(candidates)

func ascend_heir(heir: Dictionary) -> void:
	generation += 1
	hero_name = heir.get("name", "ทายาทรุ่นที่ %d" % generation)
	age = 18
	hunger = 90.0
	energy = 95.0
	health = 100.0
	str_stat = heir.get("str", 5)
	agi_stat = heir.get("agi", 5)
	int_stat = heir.get("int", 5)

	TimeManager.reset_hero_age()
	refresh_life_stage_appearance()
	TimeManager.set_speed(1)

	chronicle_recorded.emit("👑 %s ได้สืบทอดสายเลือดแห่ง %s เข้าสู่รุ่นที่ %d อย่างเป็นทางการ!" % [hero_name, clan_name, generation], "milestone")

func emit_status_snapshot() -> void:
	var snap: Dictionary = {
		"name": hero_name,
		"clan": clan_name,
		"generation": generation,
		"age": age,
		"hunger": hunger,
		"energy": energy,
		"health": health,
		"action": current_action,
		"monologue": cognition.last_monologue,
		"dominant_philosophy": cognition.active_philosophy
	}
	hero_status_updated.emit(snap)

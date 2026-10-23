extends Node2D

@onready var island_gen: Node2D = $IslandGenerator
@onready var hero: HeroAgent = $HeroAgent
@onready var camera: Camera2D = $Camera2D
@onready var hud: CanvasLayer = $CozyHUD
@onready var atmosphere: Node2D = $AtmosphereController

var active_god_tool: String = "inspect"
var is_dragging_cam: bool = false
var drag_start_pos: Vector2 = Vector2.ZERO
var follow_hero: bool = true

# Magic Reticle
var reticle_pos: Vector2 = Vector2.ZERO
var reticle_rot: float = 0.0

func _ready() -> void:
	if island_gen:
		island_gen.generate_island()

	if hero:
		# Place hero near central campfire
		hero.global_position = Vector2(64 * 24 + 12, 64 * 24 + 48)
		hero.hero_status_updated.connect(hud.update_hero_ui)
		hero.succession_triggered.connect(hud.open_heir_succession_modal)
		hero.chronicle_recorded.connect(hud.add_chronicle)

	if hud:
		hud.god_tool_selected.connect(_on_god_tool_selected)
		hud.heir_chosen.connect(_on_heir_chosen)

	if camera:
		camera.position = hero.global_position
		camera.position_smoothing_enabled = true
		camera.position_smoothing_speed = 6.0

func _process(delta: float) -> void:
	if follow_hero and hero and camera:
		camera.position = hero.global_position

	# Rotate magic reticle
	if active_god_tool != "inspect":
		reticle_rot += delta * 2.2
		queue_redraw()

func _input(event: InputEvent) -> void:
	# Camera Zoom with Mouse Wheel
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			camera.zoom = clamp(camera.zoom * 1.12, Vector2(0.5, 0.5), Vector2(3.5, 3.5))
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			camera.zoom = clamp(camera.zoom * 0.88, Vector2(0.5, 0.5), Vector2(3.5, 3.5))

		# Mouse Drag Camera
		if event.button_index == MOUSE_BUTTON_RIGHT:
			if event.pressed:
				is_dragging_cam = true
				drag_start_pos = event.position
				follow_hero = false
			else:
				is_dragging_cam = false

		# God Power Click
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			var world_click := get_global_mouse_position()
			execute_god_tool_at(world_click)

	elif event is InputEventMouseMotion:
		reticle_pos = get_global_mouse_position()
		if is_dragging_cam:
			var diff: Vector2 = (drag_start_pos - event.position) / camera.zoom.x
			camera.position += diff
			drag_start_pos = event.position

func _on_god_tool_selected(tool_id: String) -> void:
	active_god_tool = tool_id
	queue_redraw()

func _on_heir_chosen(heir: Dictionary) -> void:
	if hero:
		hero.ascend_heir(heir)

func execute_god_tool_at(world_pos: Vector2) -> void:
	if active_god_tool == "inspect":
		return

	var tx: int = int(world_pos.x / 24.0)
	var ty: int = int(world_pos.y / 24.0)
	var tile = island_gen.get_tile(tx, ty)
	if tile.is_empty():
		return

	spawn_shockwave(world_pos, get_tool_color(active_god_tool))

	match active_god_tool:
		"spawn_berry":
			if tile["walkable"]:
				island_gen.spawn_resource("berry_bush", tx, ty, island_gen.tex_berry_bush, Vector2(38, 38), true)
				hud.add_chronicle("🍒 พระเจ้าประทานพุ่มเบอร์รี่สดฉ่ำที่ (%d, %d)" % [tx, ty], "food")
		"spawn_mountain":
			island_gen.spawn_resource("mountain_rock", tx, ty, island_gen.tex_mountain_rock, Vector2(48, 48))
			tile["walkable"] = false
			hud.add_chronicle("⛰️ พระเจ้าเสกโขดหินผารูนโบราณที่ (%d, %d)" % [tx, ty], "info")
		"terraform_river":
			tile["biome"] = "shallow_water"
			tile["walkable"] = true
			island_gen.queue_redraw()
			hud.add_chronicle("🌊 พระเจ้าเนรมิตธารน้ำศักดิ์สิทธิ์ที่ (%d, %d)" % [tx, ty], "info")
		"spawn_blessing":
			if tile["walkable"]:
				island_gen.spawn_resource("starfall_shrine", tx, ty, island_gen.tex_starfall_shrine, Vector2(52, 52))
				hud.add_chronicle("💎 แท่นผลึกดาราศักดิ์สิทธิ์จุติลงที่ (%d, %d)" % [tx, ty], "milestone")
		"smite_lightning":
			# Screen Shake
			camera_shake(12.0)
			if tile["resource"] != null and is_instance_valid(tile["resource"]["node"]):
				tile["resource"]["node"].queue_free()
				tile["resource"] = null
				tile["walkable"] = true
			hud.add_chronicle("⚡ สายฟ้าสวรรค์ฟาดทำลายสิ่งกีดขวางที่ (%d, %d)!" % [tx, ty], "warn")

func spawn_shockwave(pos: Vector2, col: Color) -> void:
	var ring := Node2D.new()
	ring.position = pos
	add_child(ring)

	var tween := create_tween()
	var radius_obj = {"r": 4.0, "alpha": 1.0}

	# Create a visual expanding circle
	tween.tween_method(func(val: float):
		ring.queue_redraw()
	, 0.0, 1.0, 0.45)
	tween.tween_callback(ring.queue_free)

func camera_shake(intensity: float) -> void:
	var orig_offset := camera.offset
	var tween := create_tween()
	for i in range(4):
		var rand_offset := Vector2(randf_range(-intensity, intensity), randf_range(-intensity, intensity))
		tween.tween_property(camera, "offset", rand_offset, 0.04)
	tween.tween_property(camera, "offset", orig_offset, 0.04)

func get_tool_color(tool_id: String) -> Color:
	match tool_id:
		"spawn_berry": return Color(0.1, 0.85, 0.45, 0.9)
		"spawn_mountain": return Color(0.85, 0.65, 0.35, 0.9)
		"terraform_river": return Color(0.2, 0.75, 1.0, 0.9)
		"spawn_blessing": return Color(0.95, 0.8, 0.2, 0.9)
		"smite_lightning": return Color(0.65, 0.4, 1.0, 0.9)
		_: return Color(1, 1, 1, 0.8)

func _draw() -> void:
	if active_god_tool == "inspect":
		return

	# Draw Rotating Celestial Magic Reticle around mouse
	var col := get_tool_color(active_god_tool)
	var radius: float = 24.0

	draw_arc(reticle_pos, radius, 0, TAU, 32, col, 2.0)
	draw_arc(reticle_pos, radius * 0.55, 0, TAU, 24, Color(1, 1, 1, 0.7), 1.2)

	# 4 Runic markers
	for i in range(4):
		var a: float = reticle_rot + float(i) * (PI * 0.5)
		var p1 := reticle_pos + Vector2(cos(a), sin(a)) * (radius - 5.0)
		var p2 := reticle_pos + Vector2(cos(a), sin(a)) * (radius + 5.0)
		draw_line(p1, p2, col, 2.0)

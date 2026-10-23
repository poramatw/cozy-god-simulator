extends Node2D

signal island_generated(center_world_pos: Vector2)

const MAP_WIDTH: int = 128
const MAP_HEIGHT: int = 128
const TILE_SIZE: int = 24

var grid: Array = []
var resources: Array = []
var coastal_tiles: Array = []
var campfire_node: Node2D = null

# Procedural Textured Terrains (No flat rects!)
var tex_deep_water: ImageTexture
var tex_shallow_water: ImageTexture
var tex_sand: ImageTexture
var tex_grass: ImageTexture
var tex_forest: ImageTexture
var tex_shadow: ImageTexture

# Sliced Atlas Sprites from True Alpha HD Sheets
var tex_campfire: AtlasTexture
var tex_cabin: AtlasTexture
var tex_hut: AtlasTexture
var tex_watchtower: AtlasTexture

var tex_lantern_tree: AtlasTexture
var tex_crimson_canopy: AtlasTexture
var tex_forest_tree: AtlasTexture
var tex_berry_bush: AtlasTexture

var tex_mountain_rock: AtlasTexture
var tex_starfall_shrine: AtlasTexture
var tex_pink_crystal: AtlasTexture

var wind_shader: Shader = preload("res://src/world/shaders/wind_sway.gdshader")
var wind_material: ShaderMaterial
var anim_clock: float = 0.0

@onready var foliage_container: Node2D = $"../FoliageYSorted"
@onready var buildings_container: Node2D = $"../BuildingsYSorted"

func _ready() -> void:
	# Generate Rich Hand-Painted Textures
	tex_deep_water = TerrainTextureGenerator.create_deep_water_texture()
	tex_shallow_water = TerrainTextureGenerator.create_shallow_water_texture()
	tex_sand = TerrainTextureGenerator.create_sand_texture()
	tex_grass = TerrainTextureGenerator.create_grass_texture()
	tex_forest = TerrainTextureGenerator.create_forest_soil_texture()

	wind_material = ShaderMaterial.new()
	wind_material.shader = wind_shader
	wind_material.set_shader_parameter("speed", 2.2)
	wind_material.set_shader_parameter("min_strength", 0.05)
	wind_material.set_shader_parameter("max_strength", 0.14)

	create_drop_shadow_texture()
	setup_atlas_textures()

func _process(delta: float) -> void:
	anim_clock += delta
	# Update shoreline foam wave crest animation
	queue_redraw()

func create_drop_shadow_texture() -> void:
	var img := Image.create(64, 32, false, Image.FORMAT_RGBA8)
	for y in range(32):
		for x in range(64):
			var nx: float = (float(x) - 32.0) / 30.0
			var ny: float = (float(y) - 16.0) / 14.0
			var dist_sq: float = nx * nx + ny * ny
			if dist_sq <= 1.0:
				var alpha: float = (1.0 - sqrt(dist_sq)) * 0.44
				img.set_pixel(x, y, Color(0.04, 0.06, 0.10, alpha))
			else:
				img.set_pixel(x, y, Color(0, 0, 0, 0))
	tex_shadow = ImageTexture.create_from_image(img)

func setup_atlas_textures() -> void:
	var sheet_b := load("res://assets/sprites/hd_buildings_sheet.png") as Texture2D
	var sheet_f := load("res://assets/sprites/hd_flora_sheet.png") as Texture2D
	var sheet_p := load("res://assets/sprites/hd_phase3_sheet.png") as Texture2D

	if sheet_b:
		var bw: float = sheet_b.get_width() / 2.0
		var bh: float = sheet_b.get_height() / 2.0
		tex_cabin = create_atlas(sheet_b, Rect2(0, 0, bw, bh))
		tex_hut = create_atlas(sheet_b, Rect2(bw, 0, bw, bh))
		tex_watchtower = create_atlas(sheet_b, Rect2(0, bh, bw, bh))
		tex_campfire = create_atlas(sheet_b, Rect2(bw, bh, bw, bh))

	if sheet_f:
		var fw: float = sheet_f.get_width() / 2.0
		var fh: float = sheet_f.get_height() / 2.0
		tex_lantern_tree = create_atlas(sheet_f, Rect2(0, 0, fw, fh))
		tex_crimson_canopy = create_atlas(sheet_f, Rect2(fw, 0, fw, fh))
		tex_forest_tree = create_atlas(sheet_f, Rect2(0, fh, fw, fh))
		tex_berry_bush = create_atlas(sheet_f, Rect2(fw, fh, fw, fh))

	if sheet_p:
		var pw: float = sheet_p.get_width() / 2.0
		var ph: float = sheet_p.get_height() / 2.0
		tex_mountain_rock = create_atlas(sheet_p, Rect2(0, 0, pw, ph))
		tex_starfall_shrine = create_atlas(sheet_p, Rect2(0, ph, pw, ph))
		tex_pink_crystal = create_atlas(sheet_p, Rect2(pw, ph, pw, ph))

func create_atlas(base_tex: Texture2D, rect: Rect2) -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = base_tex
	atlas.region = rect
	return atlas

func generate_island(seed_val: int = 0) -> void:
	if seed_val == 0:
		seed_val = randi()

	var noise := FastNoiseLite.new()
	noise.seed = seed_val
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.032
	noise.fractal_octaves = 4

	grid.clear()
	coastal_tiles.clear()
	for r in resources:
		if is_instance_valid(r):
			r.queue_free()
	resources.clear()

	var center_x: float = float(MAP_WIDTH) / 2.0
	var center_y: float = float(MAP_HEIGHT) / 2.0

	for y in range(MAP_HEIGHT):
		var row: Array = []
		for x in range(MAP_WIDTH):
			var dist: float = Vector2(float(x) - center_x, float(y) - center_y).length() / (float(MAP_WIDTH) * 0.44)
			var raw_n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var elev: float = clampf(raw_n - pow(dist, 1.7) * 0.52, 0.0, 1.0)

			var biome_id: String = "deep_water"
			var walkable: bool = false
			if elev < 0.22:
				biome_id = "deep_water"
				walkable = false
			elif elev < 0.34:
				biome_id = "shallow_water"
				walkable = true
			elif elev < 0.46:
				biome_id = "sand"
				walkable = true
			elif elev < 0.74:
				biome_id = "grass"
				walkable = true
			else:
				biome_id = "forest"
				walkable = true

			var tile_data = {
				"x": x,
				"y": y,
				"elevation": elev,
				"biome": biome_id,
				"walkable": walkable,
				"resource": null
			}
			row.append(tile_data)

			# Detect coastline for wave foam animation
			if biome_id == "sand" or biome_id == "shallow_water":
				coastal_tiles.append(tile_data)

		grid.append(row)

	spawn_starter_sanctuary(int(center_x), int(center_y))
	spawn_nature_flora(seed_val)

	var world_center := Vector2(center_x * float(TILE_SIZE), center_y * float(TILE_SIZE))
	island_generated.emit(world_center)
	queue_redraw()

func _draw() -> void:
	if grid.is_empty():
		return

	# 1. Draw Textured Landscape Tiles
	var uv_full := Rect2(0, 0, 1, 1)

	for y in range(MAP_HEIGHT):
		for x in range(MAP_WIDTH):
			var tile: Dictionary = grid[y][x]
			var rect := Rect2(Vector2(x * TILE_SIZE, y * TILE_SIZE), Vector2(TILE_SIZE, TILE_SIZE))
			var tex: Texture2D = tex_deep_water

			match tile["biome"]:
				"deep_water": tex = tex_deep_water
				"shallow_water": tex = tex_shallow_water
				"sand": tex = tex_sand
				"grass": tex = tex_grass
				"forest": tex = tex_forest

			if tex:
				draw_texture_rect(tex, rect, false)

	# 2. Animated Shoreline Wave Foam (Sine wave ripple on coastlines)
	for ct in coastal_tiles:
		var wave: float = sin(anim_clock * 2.2 + float(ct["x"]) * 0.45 + float(ct["y"]) * 0.35)
		if wave > 0.3:
			var foam_alpha: float = (wave - 0.3) * 0.65
			var foam_pos := Vector2(float(ct["x"] * TILE_SIZE + TILE_SIZE / 2), float(ct["y"] * TILE_SIZE + TILE_SIZE / 2))
			draw_circle(foam_pos, 4.5 + wave * 2.5, Color(1, 1, 1, foam_alpha))

func spawn_starter_sanctuary(cx: int, cy: int) -> void:
	# Central Campfire
	campfire_node = spawn_resource("campfire", cx, cy, tex_campfire, Vector2(56, 56))
	if campfire_node:
		var light := PointLight2D.new()
		light.name = "CampfireLight"
		light.color = Color(1.0, 0.75, 0.38, 1.0)
		light.energy = 1.45
		light.texture_scale = 4.2
		campfire_node.add_child(light)

	# Starter huts around campfire
	spawn_resource("round_hut", cx - 3, cy - 2, tex_hut, Vector2(68, 68))
	spawn_resource("lantern_tree", cx + 4, cy - 2, tex_lantern_tree, Vector2(80, 80), true)
	spawn_resource("lantern_tree", cx - 4, cy + 3, tex_lantern_tree, Vector2(80, 80), true)
	spawn_resource("crimson_canopy", cx + 3, cy + 4, tex_crimson_canopy, Vector2(74, 74), true)
	spawn_resource("pink_crystal", cx - 2, cy + 4, tex_pink_crystal, Vector2(44, 44))

func spawn_nature_flora(seed_val: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val + 777

	var cx: float = float(MAP_WIDTH) / 2.0
	var cy: float = float(MAP_HEIGHT) / 2.0

	for y in range(4, MAP_HEIGHT - 4):
		for x in range(4, MAP_WIDTH - 4):
			var tile: Dictionary = grid[y][x]
			if not tile["walkable"] or tile["resource"] != null:
				continue

			var dist_center: float = Vector2(float(x) - cx, float(y) - cy).length()
			if dist_center < 7.0:
				continue

			var roll: float = rng.randf()
			if tile["biome"] == "forest":
				if roll < 0.24:
					var pick: float = rng.randf()
					if pick < 0.35:
						spawn_resource("lantern_tree", x, y, tex_lantern_tree, Vector2(80, 80), true)
					elif pick < 0.65:
						spawn_resource("crimson_canopy", x, y, tex_crimson_canopy, Vector2(74, 74), true)
					else:
						spawn_resource("forest_tree", x, y, tex_forest_tree, Vector2(76, 76), true)
				elif roll < 0.34:
					spawn_resource("berry_bush", x, y, tex_berry_bush, Vector2(46, 46), true)
			elif tile["biome"] == "grass":
				if roll < 0.09:
					spawn_resource("berry_bush", x, y, tex_berry_bush, Vector2(46, 46), true)
				elif roll < 0.15:
					spawn_resource("forest_tree", x, y, tex_forest_tree, Vector2(72, 72), true)
				elif roll < 0.18 and tile["elevation"] > 0.62:
					spawn_resource("mountain_rock", x, y, tex_mountain_rock, Vector2(58, 58))

func spawn_resource(res_type: String, tx: int, ty: int, tex: Texture2D, size: Vector2, is_flora: bool = false) -> Node2D:
	if tx < 0 or tx >= MAP_WIDTH or ty < 0 or ty >= MAP_HEIGHT:
		return null
	var tile: Dictionary = grid[ty][tx]

	var root := Node2D.new()
	root.name = "Res_" + res_type + "_" + str(tx) + "_" + str(ty)
	root.position = Vector2(float(tx * TILE_SIZE + TILE_SIZE / 2), float(ty * TILE_SIZE + TILE_SIZE / 2))
	root.y_sort_enabled = true

	# Grounded Drop Shadow
	if tex_shadow:
		var shadow := Sprite2D.new()
		shadow.texture = tex_shadow
		shadow.scale = Vector2(size.x / 46.0, size.y / 62.0)
		shadow.position = Vector2(0, size.y * 0.26)
		shadow.z_index = -1
		root.add_child(shadow)

	# Main Sprite
	if tex:
		var spr := Sprite2D.new()
		spr.texture = tex
		spr.scale = Vector2(size.x / tex.get_width(), size.y / tex.get_height())
		spr.position = Vector2(0, -size.y * 0.16)
		if is_flora and wind_material:
			spr.material = wind_material
		root.add_child(spr)

	foliage_container.add_child(root)
	resources.append(root)

	tile["resource"] = {
		"type": res_type,
		"node": root,
		"tile_x": tx,
		"tile_y": ty
	}
	return root

func get_tile(tx: int, ty: int) -> Dictionary:
	if tx >= 0 and tx < MAP_WIDTH and ty >= 0 and ty < MAP_HEIGHT:
		return grid[ty][tx]
	return {}

func get_tile_at_world(world_pos: Vector2) -> Dictionary:
	var tx: int = int(world_pos.x / float(TILE_SIZE))
	var ty: int = int(world_pos.y / float(TILE_SIZE))
	return get_tile(tx, ty)

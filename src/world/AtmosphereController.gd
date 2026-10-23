extends Node2D

@export var canvas_modulate_path: NodePath = "CanvasModulate"
@export var world_env_path: NodePath = "WorldEnvironment"
@export var fireflies_path: NodePath = "FirefliesParticles"

@onready var canvas_modulate: CanvasModulate = get_node_or_null(canvas_modulate_path)
@onready var world_env: WorldEnvironment = get_node_or_null(world_env_path)
@onready var fireflies: CPUParticles2D = get_node_or_null(fireflies_path)

# 4 Key Cozy Lighting Palettes
const COLOR_DAWN = Color(1.0, 0.88, 0.76, 1.0)
const COLOR_DAY = Color(1.0, 1.0, 1.0, 1.0)
const COLOR_GOLDEN = Color(1.0, 0.85, 0.62, 1.0)
const COLOR_NIGHT = Color(0.24, 0.32, 0.52, 1.0)
const COLOR_WINTER = Color(0.85, 0.92, 1.0, 1.0)

var current_season: String = "spring"
var target_color: Color = COLOR_DAY

func _ready() -> void:
	if not canvas_modulate:
		canvas_modulate = CanvasModulate.new()
		add_child(canvas_modulate)

	setup_world_environment()
	setup_fireflies()

	TimeManager.time_ticked.connect(_on_time_ticked)

func setup_world_environment() -> void:
	if not world_env:
		world_env = WorldEnvironment.new()
		var env := Environment.new()
		env.background_mode = Environment.BG_CANVAS
		env.glow_enabled = true
		env.glow_intensity = 0.35
		env.glow_bloom = 0.22
		env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
		world_env.environment = env
		add_child(world_env)

func setup_fireflies() -> void:
	if not fireflies:
		fireflies = CPUParticles2D.new()
		fireflies.name = "FirefliesParticles"
		fireflies.amount = 45
		fireflies.lifetime = 4.0
		fireflies.preprocess = 2.0
		fireflies.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		fireflies.emission_rect_extents = Vector2(1280, 1280)
		fireflies.gravity = Vector2(0, -5)
		fireflies.initial_velocity_min = 5.0
		fireflies.initial_velocity_max = 18.0
		fireflies.scale_amount_min = 2.5
		fireflies.scale_amount_max = 4.5
		fireflies.color = Color(0.85, 1.0, 0.45, 0.75)
		add_child(fireflies)

func _on_time_ticked(_sim_delta: float) -> void:
	var clock = TimeManager.get_clock_time()
	var hours: int = clock["hours"]
	var minutes: int = clock["minutes"]
	var time_dec: float = float(hours) + float(minutes) / 60.0

	# Calculate smooth time-of-day target color
	if time_dec >= 5.0 and time_dec < 7.5:
		# Dawn: smooth blend from night to dawn
		var t: float = (time_dec - 5.0) / 2.5
		target_color = COLOR_NIGHT.lerp(COLOR_DAWN, t)
	elif time_dec >= 7.5 and time_dec < 16.5:
		# Day: smooth blend from dawn to full daylight
		var t: float = clampf((time_dec - 7.5) / 1.5, 0.0, 1.0)
		target_color = COLOR_DAWN.lerp(COLOR_DAY, t)
	elif time_dec >= 16.5 and time_dec < 19.5:
		# Golden hour / Sunset
		var t: float = (time_dec - 16.5) / 3.0
		target_color = COLOR_DAY.lerp(COLOR_GOLDEN, t)
	else:
		# Night
		var t: float = 0.0
		if time_dec >= 19.5:
			t = clampf((time_dec - 19.5) / 2.0, 0.0, 1.0)
		else:
			t = clampf((5.0 - time_dec) / 2.0, 0.0, 1.0)
		target_color = COLOR_GOLDEN.lerp(COLOR_NIGHT, t)

	if current_season == "winter":
		target_color = target_color.lerp(COLOR_WINTER, 0.28)

	if canvas_modulate:
		canvas_modulate.color = canvas_modulate.color.lerp(target_color, 0.08)

	# Firefly activity at night
	if fireflies:
		var is_night: bool = clock["is_night"]
		fireflies.emitting = is_night
		var firefly_alpha: float = 0.85 if is_night else 0.0
		fireflies.modulate.a = lerpf(fireflies.modulate.a, firefly_alpha, 0.05)

func set_season(season_id: String) -> void:
	current_season = season_id

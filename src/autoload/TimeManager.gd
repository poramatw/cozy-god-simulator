extends Node

signal time_ticked(sim_delta: float)
signal day_passed(day: int)
signal year_passed(year: int)
signal world_ended
signal speed_changed(new_speed: int)

var seconds_per_year: float = 60.0
var days_per_year: int = 360
var speed: int = 1
var elapsed_real_seconds: float = 0.0
var elapsed_sim_seconds: float = 0.0
var world_year: int = 1
var max_world_years: int = 300
var hero_age_seconds: float = 0.0
var has_ended: bool = false
var last_day: int = -1

func _ready() -> void:
	if DataManager.agent_config.has("secondsPerYear"):
		seconds_per_year = float(DataManager.agent_config["secondsPerYear"])

func _process(delta: float) -> void:
	if speed == 0 or has_ended:
		return

	var sim_delta: float = delta * float(speed)
	elapsed_real_seconds += delta
	elapsed_sim_seconds += sim_delta
	hero_age_seconds += sim_delta

	var cur_year: int = int(elapsed_sim_seconds / seconds_per_year) + 1
	if cur_year != world_year:
		world_year = cur_year
		year_passed.emit(world_year)

		if max_world_years > 0 and world_year >= max_world_years:
			has_ended = true
			world_ended.emit()

	var cur_day: int = get_day_of_year()
	if cur_day != last_day:
		last_day = cur_day
		day_passed.emit(cur_day)

	time_ticked.emit(sim_delta)

func set_speed(new_speed: int) -> void:
	speed = clampi(new_speed, 0, 5)
	speed_changed.emit(speed)

func get_speed() -> int:
	return speed

func get_world_year() -> int:
	return world_year

func get_max_world_years() -> int:
	return max_world_years

func set_max_world_years(years: int) -> void:
	max_world_years = years

func extend_world_lifespan(extra_years: int) -> void:
	max_world_years += extra_years
	has_ended = false

func is_world_ended() -> bool:
	return has_ended

func get_elapsed_years() -> float:
	return elapsed_sim_seconds / seconds_per_year

func get_hero_age() -> float:
	return hero_age_seconds / seconds_per_year

func reset_hero_age() -> void:
	hero_age_seconds = 0.0

func get_day_of_year() -> int:
	var fraction: float = fmod(elapsed_sim_seconds, seconds_per_year) / seconds_per_year
	return clampi(int(fraction * float(days_per_year)) + 1, 1, days_per_year)

func get_clock_time() -> Dictionary:
	var fraction: float = fmod(elapsed_sim_seconds, seconds_per_year) / seconds_per_year
	var total_minutes: int = int(fraction * 24.0 * 60.0)
	var hours: int = (total_minutes / 60) % 24
	var minutes: int = total_minutes % 60
	var is_night: bool = hours >= 19 or hours < 5

	# Ambient darkness: 0.0 at noon (13:00), 0.72 at midnight (01:00)
	var angle: float = ((float(hours) + float(minutes) / 60.0 - 13.0) / 24.0) * TAU
	var darkness: float = clampf((sin(angle) + 1.0) * 0.36, 0.0, 0.72)

	var formatted: String = "%02d:%02d" % [hours, minutes]
	return {
		"hours": hours,
		"minutes": minutes,
		"formatted": formatted,
		"is_night": is_night,
		"darkness": darkness
	}

func reset() -> void:
	elapsed_real_seconds = 0.0
	elapsed_sim_seconds = 0.0
	hero_age_seconds = 0.0
	world_year = 1
	has_ended = false
	last_day = -1

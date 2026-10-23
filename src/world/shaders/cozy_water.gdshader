shader_type canvas_item;

uniform vec4 deep_color : source_color = vec4(0.08, 0.22, 0.38, 0.88);
uniform vec4 shallow_color : source_color = vec4(0.24, 0.62, 0.75, 0.75);
uniform vec4 foam_color : source_color = vec4(0.92, 0.98, 1.0, 0.85);
uniform float wave_speed : hint_range(0.1, 5.0) = 1.2;
uniform float wave_frequency : hint_range(1.0, 50.0) = 16.0;
uniform float foam_size : hint_range(0.0, 0.5) = 0.08;

void fragment() {
	vec2 uv = UV;
	float wave1 = sin(uv.y * wave_frequency + TIME * wave_speed);
	float wave2 = cos(uv.x * wave_frequency * 0.8 - TIME * wave_speed * 0.9);
	float wave = (wave1 + wave2) * 0.5;

	vec4 base_water = mix(deep_color, shallow_color, clamp(uv.y + wave * 0.05, 0.0, 1.0));

	// Soft shoreline foam rim
	float foam_edge = sin(TIME * wave_speed * 1.5 + (uv.x + uv.y) * 20.0);
	if (uv.y < foam_size + foam_edge * 0.02) {
		base_water = mix(base_water, foam_color, 0.65);
	}

	COLOR = base_water;
}

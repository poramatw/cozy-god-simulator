shader_type canvas_item;

uniform float speed : hint_range(0.0, 10.0) = 2.0;
uniform float min_strength : hint_range(0.0, 1.0) = 0.05;
uniform float max_strength : hint_range(0.0, 1.0) = 0.15;
uniform float interval : hint_range(0.0, 10.0) = 3.5;
uniform float detail : hint_range(0.0, 10.0) = 1.0;

float get_wind(vec2 vertex, vec2 uv, float time) {
    float diff = pow(max_strength - min_strength, 2.0);
    float strength = clamp(min_strength + diff + sin(time / interval) * diff, min_strength, max_strength) * 100.0;
    float wind = (sin(time) + cos(time * detail)) * strength * max(0.0, (1.0 - uv.y));
    return wind;
}

void vertex() {
    float time = TIME * speed + VERTEX.x * 0.05 + VERTEX.y * 0.05;
    VERTEX.x += get_wind(VERTEX.xy, UV, time);
}

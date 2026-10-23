extends RefCounted
class_name TerrainTextureGenerator

static func create_grass_texture(width: int = 64, height: int = 64) -> ImageTexture:
	var img := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 1234
	noise.frequency = 0.12
	noise.fractal_octaves = 3

	var base_col := Color("#4d7c0f") # rich lush green
	var dark_col := Color("#3f6212") # shadow moss
	var bright_col := Color("#65a30d") # sunlit clover
	var flower_col := Color("#fef08a") # tiny yellow daisy

	for y in range(height):
		for x in range(width):
			var n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var col: Color = base_col.lerp(dark_col, n * 0.45)
			if n > 0.65:
				col = col.lerp(bright_col, (n - 0.65) * 2.0)
			# Occasional tiny wildflower speckle
			if (x * 17 + y * 31) % 191 == 0:
				col = flower_col
			img.set_pixel(x, y, col)

	return ImageTexture.create_from_image(img)

static func create_sand_texture(width: int = 64, height: int = 64) -> ImageTexture:
	var img := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 5678
	noise.frequency = 0.18

	var base_col := Color("#d4b982") # warm golden sand
	var dark_col := Color("#bfa168") # wet sand shadow
	var light_col := Color("#e8d4a6") # sun-baked sand grain
	var pebble_col := Color("#9a825b") # tiny pebble

	for y in range(height):
		for x in range(width):
			var n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var col: Color = base_col.lerp(dark_col, n * 0.35)
			if n > 0.6:
				col = col.lerp(light_col, (n - 0.6) * 1.5)
			if (x * 23 + y * 41) % 223 == 0:
				col = pebble_col
			img.set_pixel(x, y, col)

	return ImageTexture.create_from_image(img)

static func create_shallow_water_texture(width: int = 64, height: int = 64) -> ImageTexture:
	var img := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 9101
	noise.frequency = 0.08

	var base_col := Color("#0ea5e9", 0.82) # turquoise lagoon
	var dark_col := Color("#0284c7", 0.88)
	var shimmer_col := Color("#7dd3fc", 0.92) # sun caustics

	for y in range(height):
		for x in range(width):
			var n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var col: Color = base_col.lerp(dark_col, n * 0.4)
			if n > 0.62:
				col = col.lerp(shimmer_col, (n - 0.62) * 1.8)
			img.set_pixel(x, y, col)

	return ImageTexture.create_from_image(img)

static func create_deep_water_texture(width: int = 64, height: int = 64) -> ImageTexture:
	var img := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 1121
	noise.frequency = 0.06

	var base_col := Color("#0f172a") # deep midnight ocean
	var deep_col := Color("#090d16")
	var ripple_col := Color("#1e293b")

	for y in range(height):
		for x in range(width):
			var n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var col: Color = base_col.lerp(deep_col, n * 0.5)
			if n > 0.58:
				col = col.lerp(ripple_col, (n - 0.58) * 1.5)
			img.set_pixel(x, y, col)

	return ImageTexture.create_from_image(img)

static func create_forest_soil_texture(width: int = 64, height: int = 64) -> ImageTexture:
	var img := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 3141
	noise.frequency = 0.14

	var base_col := Color("#365314") # dark pine forest floor
	var dark_col := Color("#1a2e05") # rich damp earth
	var bright_col := Color("#4d7c0f") # creeping moss

	for y in range(height):
		for x in range(width):
			var n: float = (noise.get_noise_2d(float(x), float(y)) + 1.0) * 0.5
			var col: Color = base_col.lerp(dark_col, n * 0.45)
			if n > 0.65:
				col = col.lerp(bright_col, (n - 0.65) * 1.6)
			img.set_pixel(x, y, col)

	return ImageTexture.create_from_image(img)

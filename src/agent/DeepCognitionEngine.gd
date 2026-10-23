extends RefCounted
class_name DeepCognitionEngine

const SAVE_PATH: String = "user://memories.json"

var episodic_memories: Array = []
var active_philosophy: String = "harmony"
var philosophy_scores: Dictionary = {
	"harmony": 10,
	"wisdom": 10,
	"resilience": 10,
	"leadership": 10,
	"curiosity": 10
}

var last_monologue: String = "ข้าลืมตาตื่นขึ้นมาบนผืนแผ่นดินอันอบอุ่นแห่งนี้..."
var monologue_history: Array = []

func _init() -> void:
	load_memories_from_disk()

func record_memory(generation: int, hero_name: String, age: int, season: String, title: String, reflection: String, emotion: String = "neutral", importance: int = 5) -> Dictionary:
	var entry: Dictionary = {
		"id": "mem_%d_%d" % [Time.get_ticks_msec(), randi() % 1000],
		"generation": generation,
		"hero_name": hero_name,
		"age": age,
		"season": season,
		"title": title,
		"reflection": reflection,
		"emotion": emotion,
		"importance": importance,
		"timestamp": Time.get_datetime_string_from_system()
	}
	episodic_memories.append(entry)
	if episodic_memories.size() > 100:
		episodic_memories.pop_front()

	save_memories_to_disk()
	return entry

func generate_inner_monologue(hero_name: String, age: int, hunger: float, energy: float, health: float, current_action: String) -> String:
	var text: String = ""

	if hunger < 25.0:
		text = "ท้องเริ่มส่งเสียงประท้วง ต้องหาเบอร์รี่หวานฉ่ำหรือปลาสดมาประทังชีวิตเสียแล้ว"
	elif energy < 20.0:
		text = "ดวงตาเริ่มหนักอึ้ง สายลมอ่อนๆ พัดผ่านช่างน่านอนหลับพักผ่อนข้างกองไฟยิ่งนัก"
	elif health < 40.0:
		text = "ร่างกายเจ็บปวดแต่หัวใจยังเตือนสติว่า ต้องประคองชีวิตเพื่อสานต่อตระกูล"
	else:
		match current_action:
			"gather":
				text = "กิ่งไม้และผลเบอร์รี่เหล่านี้ คือของขวัญจากธรรมชาติที่คอยโอบอุ้มเรา"
			"build":
				text = "ทุกท่อนไม้และก้อนหินที่เรียงร้อย จะกลายเป็นเกราะกำบังอันมั่นคงให้ชนรุ่นหลัง"
			"explore":
				text = "ไกลออกไปสุดขอบฟ้า ยังมีพงไพรและสิ่งลี้ลับที่รอคอยให้เราค้นพบ"
			"rest":
				text = "เปลวไฟที่เต้นระบำในกองไฟ ทำให้จิตใจสงบนิ่งและนึกถึงบรรพชน"
			_:
				if age < 4:
					text = "โลกใบนี้กว้างใหญ่และอบอุ่น ดอกไม้และใบหญ้าส่งกลิ่นหอมละมุน"
				elif age < 13:
					text = "อยากวิ่งเล่นข้ามทุ่งหญ้าและเรียนรู้การจุดไฟจากผู้ใหญ่จัง"
				elif age < 20:
					text = "พละกำลังกำลังเปี่ยมล้น ข้าพร้อมจะบุกเบิกและปกป้องผืนดินนี้"
				elif age < 50:
					text = "ภาระหน้าที่ต่อเผ่าพันธุ์คือเกียรติยศสูงสุดที่ข้าต้องรักษา"
				else:
					text = "วันเวลาผ่านไปรวดเร็วเหลือเกิน ถึงเวลาต้องเตรียมทายาทผู้สืบทอดจิตวิญญาณแห่งโมริมาร์"

	last_monologue = text
	monologue_history.append({"age": age, "text": text})
	if monologue_history.size() > 30:
		monologue_history.pop_front()
	return text

func boost_philosophy(phil_id: String, amount: int = 5) -> void:
	if philosophy_scores.has(phil_id):
		philosophy_scores[phil_id] += amount
		update_dominant_philosophy()

func update_dominant_philosophy() -> void:
	var best_phil: String = "harmony"
	var best_score: int = -1
	for k in philosophy_scores.keys():
		if philosophy_scores[k] > best_score:
			best_score = philosophy_scores[k]
			best_phil = k
	active_philosophy = best_phil

func save_memories_to_disk() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if not file:
		return
	var data: Dictionary = {
		"memories": episodic_memories,
		"active_philosophy": active_philosophy,
		"philosophy_scores": philosophy_scores
	}
	file.store_string(JSON.stringify(data, "  "))
	file.close()

func load_memories_from_disk() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var text := file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(text)
	if parsed is Dictionary:
		if parsed.has("memories") and parsed["memories"] is Array:
			episodic_memories = parsed["memories"]
		if parsed.has("active_philosophy"):
			active_philosophy = parsed["active_philosophy"]
		if parsed.has("philosophy_scores") and parsed["philosophy_scores"] is Dictionary:
			philosophy_scores = parsed["philosophy_scores"]

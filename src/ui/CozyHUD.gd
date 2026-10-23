extends CanvasLayer

signal god_tool_selected(tool_id: String)
signal speed_changed(new_speed: int)
signal heir_chosen(heir_dict: Dictionary)

var active_tool: String = "inspect"
var is_drawer_open: bool = false

# UI References
@onready var lbl_hero_badge: Label = $TopLeftPill/HBox/LblHero
@onready var lbl_era_badge: Label = $TopRightPill/HBox/LblEra
@onready var lbl_resources: Label = $TopRightPill/HBox/LblResources
@onready var lbl_clock: Label = $TopLeftPill/HBox/LblClock

@onready var chronicle_drawer: PanelContainer = $ChronicleDrawer
@onready var txt_monologue: Label = $ChronicleDrawer/VBox/MonologueBox/LblMonologue
@onready var txt_chronicle_log: RichTextLabel = $ChronicleDrawer/VBox/LogBox/TxtLog

@onready var genesis_modal: PanelContainer = $GenesisModal
@onready var heir_modal: PanelContainer = $HeirModal
@onready var heir_container: HBoxContainer = $HeirModal/VBox/HeirCards

func _ready() -> void:
	chronicle_drawer.visible = false
	heir_modal.visible = false
	genesis_modal.visible = true # Open at start

	TimeManager.speed_changed.connect(_on_speed_changed)
	KingdomManager.resources_changed.connect(_on_resources_changed)
	KingdomManager.era_advanced.connect(_on_era_advanced)

	setup_god_tool_buttons()
	setup_time_buttons()
	update_resources_display()

func setup_god_tool_buttons() -> void:
	var tools_box := $BottomBar/ToolsHBox
	for btn in tools_box.get_children():
		if btn is Button:
			btn.pressed.connect(func():
				var tool_name: String = str(btn.name).to_snake_case().replace("btn_", "")
				select_god_tool(tool_name)
			)

func setup_time_buttons() -> void:
	$TopLeftPill/HBox/BtnPause.pressed.connect(func(): TimeManager.set_speed(0))
	$TopLeftPill/HBox/Btn1x.pressed.connect(func(): TimeManager.set_speed(1))
	$TopLeftPill/HBox/Btn2x.pressed.connect(func(): TimeManager.set_speed(2))
	$TopLeftPill/HBox/Btn5x.pressed.connect(func(): TimeManager.set_speed(5))

	$TopLeftPill/HBox/BtnDrawer.pressed.connect(toggle_chronicle_drawer)
	$GenesisModal/VBox/BtnStartWorld.pressed.connect(_on_genesis_start)

func select_god_tool(tool_id: String) -> void:
	active_tool = tool_id
	god_tool_selected.emit(tool_id)
	add_chronicle("✨ เลือกใช้พลังพระเจ้า: %s" % tool_id, "info")

func toggle_chronicle_drawer() -> void:
	is_drawer_open = !is_drawer_open
	chronicle_drawer.visible = is_drawer_open

func update_hero_ui(snap: Dictionary) -> void:
	if lbl_hero_badge:
		lbl_hero_badge.text = "👤 %s | วัย %d ปี (รุ่น %d) | 🍖 %d%% 💤 %d%% ❤️ %d%%" % [
			snap.get("name", "อาเดรียน"),
			snap.get("age", 20),
			snap.get("generation", 1),
			int(snap.get("hunger", 100)),
			int(snap.get("energy", 100)),
			int(snap.get("health", 100))
		]
	if txt_monologue:
		txt_monologue.text = "“%s”" % snap.get("monologue", "")

func _process(_delta: float) -> void:
	var clock = TimeManager.get_clock_time()
	if lbl_clock:
		lbl_clock.text = "⏰ ปีที่ %d (%s)" % [TimeManager.world_year, clock["formatted"]]

func _on_resources_changed(wood: int, stone: int, food: int, lore: int, faith: int) -> void:
	update_resources_display()

func _on_era_advanced(era_id: String, era_name: String) -> void:
	if lbl_era_badge:
		lbl_era_badge.text = "🏛️ %s" % era_name
	add_chronicle("🎊 อาณาจักรได้ก้าวเข้าสู่ \"%s\" อย่างรุ่งโรจน์!" % era_name, "milestone")

func update_resources_display() -> void:
	if lbl_resources:
		lbl_resources.text = "🪵 %d  🪨 %d  🌾 %d  📜 %d  💎 %d" % [
			KingdomManager.wood,
			KingdomManager.stone,
			KingdomManager.food,
			KingdomManager.lore,
			KingdomManager.faith
		]
	if lbl_era_badge:
		lbl_era_badge.text = "🏛️ %s" % KingdomManager.get_current_era()["name"]

func add_chronicle(text: String, type: String = "info") -> void:
	if not txt_chronicle_log:
		return
	var clock = TimeManager.get_clock_time()
	var color_code := "#475569"
	match type:
		"milestone": color_code = "#b45309"
		"warn": color_code = "#dc2626"
		"food": color_code = "#16a34a"

	txt_chronicle_log.append_text("[color=%s][ปี %d - %s] %s[/color]\n" % [
		color_code,
		TimeManager.world_year,
		clock["formatted"],
		text
	])

func open_heir_succession_modal(candidates: Array) -> void:
	heir_modal.visible = true
	for c in heir_container.get_children():
		c.queue_free()

	for heir in candidates:
		var panel := PanelContainer.new()
		panel.custom_minimum_size = Vector2(240, 200)

		var vbox := VBoxContainer.new()
		vbox.add_theme_constant_override("separation", 8)

		var lbl_title := Label.new()
		lbl_title.text = "%s %s" % [heir.get("badge", "👑"), heir.get("name", "")]
		lbl_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(lbl_title)

		var lbl_branch := Label.new()
		lbl_branch.text = "สาย: %s" % heir.get("branch", "")
		lbl_branch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(lbl_branch)

		var lbl_stats := Label.new()
		lbl_stats.text = "STR: %d | AGI: %d | INT: %d" % [heir.get("str", 5), heir.get("agi", 5), heir.get("int", 5)]
		lbl_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(lbl_stats)

		var lbl_perk := Label.new()
		lbl_perk.text = heir.get("perk", "")
		lbl_perk.autowrap_mode = TextServer.AUTOWRAP_WORD
		vbox.add_child(lbl_perk)

		var btn_choose := Button.new()
		btn_choose.text = "อัญเชิญสืบทอดสายเลือด"
		btn_choose.pressed.connect(func():
			heir_modal.visible = false
			heir_chosen.emit(heir)
		)
		vbox.add_child(btn_choose)

		panel.add_child(vbox)
		heir_container.add_child(panel)

func _on_genesis_start() -> void:
	genesis_modal.visible = false
	TimeManager.set_speed(1)
	add_chronicle("🌿 ปฐมกาลแห่งโมริมาร์เริ่มต้นขึ้นแล้ว! ขอพลังพระเจ้าจงคุ้มครอง", "milestone")

func _on_speed_changed(s: int) -> void:
	pass

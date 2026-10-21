# 🌿 AGENTS.md — Cozy Pixel Life & God Simulator

เอกสารกฎเหล็กสำหรับ AI Agent ที่พัฒนาโปรเจกต์นี้ ต้องปฏิบัติตามอย่างเคร่งครัดทุกครั้งที่เขียนหรือแก้ไขโค้ด

---

## 1. กฎ Ponytail (YAGNI: You Aren't Gonna Need It)
- **ห้าม Over-engineer:** เขียนโค้ดให้สั้น กระชับ อ่านง่าย และตรงประเด็นที่สุด
- **ใช้ความสามารถของ Phaser 3 และ Browser API ก่อนเสมอ:** ห้ามติดตั้ง Library ภายนอกที่ไม่จำเป็น
- **ห้ามสร้าง Abstraction ล่วงหน้า:** สร้างเฉพาะคลาส/ฟังก์ชันที่ใช้งานจริงในเฟสปัจจุบัน แต่แยกข้อมูลไว้ใน JSON เพื่อให้ขยายต่อได้ง่าย

---

## 2. มาตรการป้องกัน "AI Slop" (Anti-AI Slop Guidelines)

### 2.1 ด้านงานภาพ (Visual & Pixel Art Anti-Slop)
1. **ห้ามมี Mixels (Mixed Pixel Sizes):**
   - บังคับสเกลพิกเซลเดียวทั้งเกมที่ขนาด **`16x16` พิกเซล** ต่อ 1 Tile/Sprite
   - ตั้งค่า Phaser เป็น `pixelArt: true`, `antialias: false`, `roundPixels: true`
   - ตั้งค่า CSS `image-rendering: pixelated;` เสมอ
2. **จำกัดชุดสี (Strict Color Palette):**
   - ใช้ชุดสี **Lospec Resurrect 64** และโทนสี Cozy Earth Tone เท่านั้น เพื่อให้ต้นไม้ พื้นดิน น้ำ ตัวละคร และ UI ดูกลมกลืนอยู่ในโลกเดียวกัน

### 2.2 ด้านการออกแบบและโค้ด (Design & Code Anti-Slop)
1. **Data-Driven Design (แยกข้อมูลออกจากโค้ด):**
   - ห้ามเขียน `if-else` ยาวเหยียดเพื่อฮาร์ดโค้ดค่าพลัง ไอเทม หรือพฤติกรรมบอท
   - เก็บค่าตั้งต้นและตารางข้อมูลไว้ใน `public/assets/data/*.json` (`biomes.json`, `agent_config.json`, `traits.json`, `buildings.json`, `weather_events.json`)
2. **Cozy Pixel UI & Juiciness:**
   - ห้ามใช้ปุ่มหรือหน้าต่าง HTML ดั้งเดิมของเบราว์เซอร์ที่ดูหลุดธีม
   - ทุกปุ่มและหน้าต่างต้องเป็น Pixel Frame สไตล์อบอุ่น พร้อมเอฟเฟกต์เด้ง (Tweening / Juiciness) เมื่อกดหรือโต้ตอบ

---

## 3. โครงสร้างโปรเจกต์ (Project Structure)
- `public/assets/data/` — ไฟล์ JSON กำหนดค่าสมดุลเกม ไบโอม พฤติกรรมบอท สิ่งปลูกสร้าง และสภาพอากาศ
- `src/core/` — ตั้งค่า Phaser, Pixel Texture Generator (16x16), Time Speed Controller (`1x`, `2x`, `5x`)
- `src/world/` — ระบบสุ่มเกาะ `64x64` ด้วย `simplex-noise`, ระบบต้นเบอร์รี่และต้นไม้พักผ่อน
- `src/agent/` — ระบบความต้องการ (`Hunger`, `Energy`, `Health`, `Age`), A* Pathfinding และสมอง `Utility AI`
- `src/kingdom/` — (Phase 4) ระบบสร้างเมือง, Tech Tree และผู้ติดตาม
- `src/god/` — (Phase 3) เครื่องมือพลังพระเจ้า (สภาพอากาศ, ปรับภูมิประเทศ, มอบพร)
- `src/ui/` — หน้าต่างสถานะตัวเอก, กราฟคะแนน Utility AI, บันทึกเหตุการณ์ และปุ่มควบคุมเวลา

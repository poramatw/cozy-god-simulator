# 🌿 Project Blueprint: Cozy Pixel Life & God Simulator (AI-Agent Driven)

เอกสารฉบับนี้คือแผนแม่บท (Master Plan) สำหรับการพัฒนาเกมแนว **2D Open World Cozy Life & God Simulator** บนแพลตฟอร์ม Web Browser โดยเน้นการติดตามชีวิตตัวเอกเพียงตัวเดียวตั้งแต่เกิดจนตาย พร้อมระบบสร้างอาณาจักร โดยใช้ **AI Agent เป็นผู้พัฒนาหลักแบบครบวงจร (Design $\rightarrow$ Asset $\rightarrow$ Code $\rightarrow$ Test $\rightarrow$ Deploy)**

---

## 1. ภาพรวมของเกม (Core Concept & Vision)
*   **แนวเกม (Genre):** Cozy Life Sim / Autonomous Agent Tracker / God Simulator (คล้าย WorldBox ผสม Tamagotchi และ Dwarf Fortress แบบย่อส่วน)
*   **มุมมองและกราฟิก:** 2D Top-Down Pixel Art สไตล์อบอุ่น (Cozy Earth Tone / Pastel)
*   **จุดเด่น (Unique Selling Point):**
    *   **One Hero Focus:** โฟกัสที่ชีวิตของบอทตัวเอกเพียง 1 ตัว (และส่งต่อมรดกสู่รุ่นลูกเมื่อตาย) ผู้เล่นกำหนดค่า Status และนิสัยเริ่มต้นได้
    *   **God's Hand (Indirect Control):** ผู้เล่นสั่งตัวเอกเดินไม่ได้ แต่เป็นพระเจ้าที่ปรับสภาพอากาศ เสกทรัพยากร หรือสร้างอุปสรรคเพื่อดูว่าบอทจะฉลาดพอที่จะเอาตัวรอดและสร้างอาณาจักรได้แค่ไหน
    *   **Ever-Expanding Modular Design:** โครงสร้างเกมออกแบบมาให้เพิ่มไอเทม อาชีพ สิ่งปลูกสร้าง และไบโอมใหม่ๆ ได้เรื่อยๆ โดยไม่กระทบโค้ดส่วนหลัก

---

## 2. สถาปัตยกรรม AI Agent & เครื่องมือช่วยพัฒนา (AI Agent Toolchain)

เพื่อให้ AI Agent ทำงานได้ตั้งแต่ต้นจนจบโดยโค้ดไม่พังและสามารถหาข้อมูลจากภายนอกได้ ควรติดตั้งระบบ **Skills & MCP (Model Context Protocol)** ดังนี้:

### 2.1 AI Coding & Architecture Plugins
*   **Ponytail Skill (`ponytail.dev`):**
    *   *บทบาท:* ปลั๊กอินบังคับใช้กฎ **YAGNI (You Aren't Gonna Need It)** สำหรับ AI Agent (เช่น Claude Code, Cursor, Gemini, Codex)
    *   *ทำไมต้องใช้:* ป้องกัน AI เขียนโค้ดเวิ่นเว้อ (Over-engineering) ลดจำนวนบรรทัดโค้ดลง ~50% บังคับให้ AI ใช้ฟีเจอร์พื้นฐานของเอนจินหรือ Browser API แทนการลง Library ขยะ
    *   *การติดตั้งและคำสั่งหลัก:*
        ```bash
        npx skills add https://github.com/DietrichGebert/ponytail --skill ponytail
        ```
        *   เปิดโหมดควบคุม: `/ponytail full`
        *   ตรวจสอบโค้ดส่วนเกินก่อนรวมโค้ด: `/ponytail-review` และ `/ponytail-audit`
*   **Web Browsing & Reference Fetching (MCP Tools):**
    *   **Firecrawl MCP / Brave Search MCP:** ให้ AI Agent ใช้ดึงข้อมูล Wiki ของเกม Reference (เช่น ระบบนิเวศของ *WorldBox*, ระบบอารมณ์ของ *RimWorld*, หรือการจัดวาง UI ของเกม Cozy บน *Itch.io*)
    *   **GitHub MCP:** ให้ AI ค้นหา Open-source Snippets สมัยใหม่มาประยุกต์ใช้ได้ทันที

### 2.2 การเชื่อมโยงไอเดียและเวิร์กโฟลว์จากคอมมูนิตี้
*   **แหล่งเรียนรู้และแลกเปลี่ยน (AI Game Dev Thailand):**
    *   อ้างอิงเทคนิคและ Workflow จากกลุ่ม [AI Game Dev Thailand](https://www.facebook.com/groups/aigamedevthailand) เช่น การทำ **Prompt Chaining** สำหรับสร้าง Sprite Sheet, การใช้ AI ช่วยออกแบบ Game Balancing (ตารางคำนวณความหิว/การเติบโต), และการแชร์ Devlog เพื่อรับ Feedback จากนักพัฒนาไทยที่ใช้ AI จริง

---

## 3. มาตรการป้องกัน "AI Slop" (Anti-AI Slop Guidelines)

ปัญหาใหญ่ที่สุดของเกมที่ทำด้วย AI คือความรู้สึก "ปลอม ไม่เข้ากัน และโค้ดรก" (AI Slop) จึงต้องตั้งกฎเหล็กในไฟล์ `AGENTS.md` หรือ `CLAUDE.md` ดังนี้:

### 3.1 ด้านงานภาพ (Visual & Pixel Art Anti-Slop)
1.  **ห้ามมี Mixels (Mixed Pixel Sizes):** บังคับสเกลพิกเซลเดียวทั้งเกม เช่น `16x16` หรือ `32x32` พิกเซล และเรนเดอร์ด้วย CSS `image-rendering: pixelated;` เท่านั้น ห้ามนำภาพความละเอียดสูงมาย่อส่วนผสมกับ Pixel Art แท้
2.  **จำกัดชุดสี (Strict Color Palette):** บังคับให้ AI สร้างหรือดึง Asset โดยอ้างอิงชุดสีจาก **Lospec** เพียงชุดเดียว (เช่น *Resurrect 64* หรือ *SLSO8*) เพื่อให้ต้นไม้ ตัวละคร และบ้านดูอยู่ในโลกเดียวกัน
3.  **เครื่องมือสร้าง Pixel Art เฉพาะทาง:**
    *   ใช้ **PixelLab.ai** หรือ **Aseprite + Retro Diffusion** (ซึ่งควบคุมทิศทางแสง ขนาดกริด และทำ Animation Frame ได้แม่นยำกว่า Image Generator ทั่วไป)
    *   ผสมผสานกับ **Open-Source / CC0 Assets** คุณภาพสูงจาก *Kenney.nl* หรือ *OpenGameArt* เป็นโครงสร้างฐาน (Base Tileset) เพื่อให้กราฟิกมีความเสถียรสูง

### 3.2 ด้านการออกแบบและโค้ด (Design & Code Anti-Slop)
1.  **Data-Driven Design (แยกข้อมูลออกจากโค้ด):**
    *   ห้าม AI เขียน `if-else` ยาวเหยียดสำหรับไอเทมหรือพฤติกรรมบอท
    *   ทุกอย่างต้องอยู่ในรูปแบบไฟล์ `.json` (เช่น `buildings.json`, `traits.json`, `weather.json`) เพื่อให้เพิ่มเนื้อหาในอนาคตได้โดยไม่ต้องแก้โค้ดระบบ
2.  **ห้ามใช้ UI พื้นฐานของระบบ:** ปุ่มและหน้าต่างต้องเป็น Nine-slice Pixel Art Frame ที่เข้ากับธีมเกมพร้อมเอฟเฟกต์เด้ง (Juiciness / Tweening)

---

## 4. Modern Open-Source Tech Stack (สำหรับ Web Game)

เลือกใช้เทคโนโลยีที่เบา ทันสมัย และ AI Agent เขียนโค้ดได้แม่นยำที่สุด:

| ส่วนประกอบ (Layer) | เทคโนโลยี Open-Source แนะนำ | เหตุผลในการเลือกใช้ |
| :--- | :--- | :--- |
| **Game Engine** | **Phaser 3** หรือ **Kaplay.js** (TypeScript) | โครงสร้างชัดเจน มีเอกสารเยอะมากทำให้ AI เขียนโค้ดไม่หลอน รันบนเว็บได้ลื่นไหล |
| **Architecture** | **biteCS** (Entity Component System) | ช่วยจัดการข้อมูลในเกมแบบแยกส่วน ทำให้เพิ่มระบบใหม่ๆ ในอนาคตได้ง่ายและรองรับวัตถุในฉากจำนวนมาก |
| **AI Brain (ระบบคิดของบอท)** | **Mistreevous** (Behavior Tree) + **Utility AI** | ให้บอทประเมินความสำคัญของชีวิตเอง (เช่น ความหิว vs การสร้างบ้าน vs การหนีพายุ) |
| **Pathfinding** | **EasyStar.js** (A* Pathfinding) | คำนวณเส้นทางเดินหลบสิ่งกีดขวางที่ผู้เล่น (God) เสกขวางทางแบบ Asynchronous ไม่ทำให้เกมกระตุก |
| **World Generation** | **simplex-noise** | สร้างแผนที่โลก 2D แบบสุ่ม (เกาะ แม่น้ำ ป่า ภูเขา) ที่สวยงามเป็นธรรมชาติทุกครั้งที่เริ่มเกมใหม่ |
| **Save System** | **Dexie.js** (IndexedDB Wrapper) | บันทึกประวัติศาสตร์ของโลกและข้อมูลตัวเอกลงใน Browser ได้จำนวนมากโดยไม่ต้องพึ่ง Server |
| **Deployment** | **Vite + GitHub Actions $\rightarrow$ Cloudflare Pages** | เมื่อ AI แก้โค้ดเสร็จและ Push ขึ้น GitHub ระบบจะ Build และอัปเดตหน้าเว็บให้อัตโนมัติภายในไม่กี่วินาที |

---

## 5. แผนการพัฒนาทีละเฟส (Iterative Development Roadmap)

แบ่งการทำงานให้ AI Agent ทำทีละ Milestone และทดสอบ (Playtest) ก่อนไปขั้นต่อไป:

### 🌱 Phase 1: The Sandbox & Autonomous Seed (สร้างโลกและสมองบอทขั้นต้น)
*   **เป้าหมาย:** มีเกาะ Pixel Art เล็กๆ และบอทตัวเอก 1 ตัวที่กิน นอน และเดินสำรวจเองได้
*   **งานของ AI Agent:**
    *   ขึ้นโปรเจกต์ด้วย Vite + TypeScript + Phaser 3 (เปิด `/ponytail full` เพื่อคุมขนาดโค้ด)
    *   สร้างระบบสุ่มแผนที่ด้วย `simplex-noise` (น้ำ, ทราย, หญ้า, ป่า)
    *   สร้างระบบความต้องการพื้นฐานของบอท: `Hunger`, `Energy`, `Health`, `Age`
    *   เขียน Utility AI ให้บอทเดินหาต้นเบอร์รี่เมื่อหิว และนอนพักใต้ต้นไม้เมื่อเหนื่อย

### 🧬 Phase 2: Character Customization & Life Cycle (พันธุกรรมและช่วงวัย)
*   **เป้าหมาย:** ผู้เล่นกำหนดความสามารถบอทก่อนเกิดได้ และบอทมีการเติบโตตามวัย
*   **งานของ AI Agent:**
    *   สร้างหน้าจอตั้งค่าเริ่มต้น (God's Creation Menu): กำหนดค่า `STR` (กำลัง), `INT` (การวิจัย/สร้าง), `AGI` (ความเร็ว), และนิสัยพิเศษ (เช่น *ขี้สงสัย*, *รักสงบ*, *บ้างาน*)
    *   ทำระบบช่วงวัย: ทารก $\rightarrow$ วัยเด็ก $\rightarrow$ วัยรุ่น $\rightarrow$ วัยผู้ใหญ่ $\rightarrow$ วัยชรา
    *   ทำระบบ **Life Chronicle Log:** กล่องข้อความบันทึกเหตุการณ์สำคัญพร้อมระบุปีและอายุของบอท

### ⚡ Phase 3: God's Hand & Environmental Challenges (พลังพระเจ้าและบททดสอบ)
*   **เป้าหมาย:** ผู้เล่นมีส่วนร่วมในการปรับสภาพแวดล้อมและขัดขวาง/ช่วยเหลือบอท
*   **งานของ AI Agent:**
    *   สร้าง God Toolbar ด้านล่างจอ:
        *   **Weather Control:** เสกฝน (ต้นไม้โตไว/บอทเดินช้า), เสกภัยแล้ง (น้ำแห้ง), เสกหิมะ (บอทต้องก่อไฟไม่งั้นเลือดลด)
        *   **Terraform & Obstacles:** เสกภูเขากั้นทาง, เสกแม่น้ำ, เสกฟ้าผ่า, เสกสัตว์ป่าดุร้าย
        *   **Divine Blessing:** โยนแร่หายาก หรือมอบ "แรงบันดาลใจ" (เพิ่ม EXP การเรียนรู้ทันที)
    *   อัปเกรด Pathfinding และ AI ของบอทให้รู้จักปรับตัวเมื่อเจอสิ่งกีดขวางที่ผู้เล่นเสกขึ้นมา

### 🏰 Phase 4: Kingdom Progression & Legacy (การสร้างอาณาจักรและส่งต่อมรดก)
*   **เป้าหมาย:** บอทพัฒนาจากคนป่าสู่อาณาจักร และมีระบบสืบทอดเมื่อตัวเอกตาย
*   **งานของ AI Agent:**
    *   สร้างระบบ **Autonomous Tech Tree:** บอทที่มี `INT` สูงจะค่อยๆ คิดค้นสิ่งปลูกสร้างจาก 1) กองไฟ $\rightarrow$ 2) กระท่อมไม้ $\rightarrow$ 3) แปลงเกษตร $\rightarrow$ 4) บ้านหินและโรงตีเหล็ก
    *   ระบบ **Followers (ผู้ติดตาม):** เมื่อที่พักและอาหารเพียงพอ จะมี NPC รองอพยพเข้ามาอยู่ในเมืองและคอยรับคำสั่งจากตัวเอกของเราเพื่อช่วยขยายอาณาจักร
    *   ระบบ **Legacy (มรดก):** เมื่อตัวเอกแก่ตาย อาณาจักรไม่หายไป ผู้เล่นสามารถเลือกสร้างบอท "รุ่นทายาท" ที่รับสืบทอดเทคโนโลยีและสิ่งปลูกสร้างเดิมเพื่อพัฒนาต่อได้

### ☕ Phase 5: Cozy Polish & Endless Expansion (เกลาบรรยากาศและระบบ Modding)
*   **เป้าหมาย:** ทำให้เกมดูละมุน มีชีวิตชีวา และพร้อมอัปเดตระยะยาว
*   **งานของ AI Agent:**
    *   ใส่ระบบกลางวัน-กลางคืน (Day/Night Cycle) พร้อมแสงไฟอบอุ่นตามบ้านเรือนในตอนกลางคืน
    *   เพิ่มระบบเสียง Ambient (เสียงฝน เสียงลม เสียงตอกไม้) และเพลงประกอบแนว Cozy Lo-Fi
    *   สร้างระบบโหลดข้อมูลเสริมจาก JSON เพื่อให้ในอนาคตสามารถสั่ง AI Agent ว่า *"ช่วยเพิ่มอาชีพนักเล่นแร่แปรธาตุและสิ่งปลูกสร้างหอคอยเวทมนตร์"* ได้โดยเพิ่มแค่ข้อมูลใน JSON และ Sprite

---

## 6. โครงสร้างโฟลเดอร์สำหรับสั่งงาน AI Agent (Project Structure)

นำโครงสร้างนี้ให้ AI Agent สร้างตั้งแต่วันแรก เพื่อความง่ายในการดูแลระยะยาว:

```text
cozy-god-sim/
├── AGENTS.md                 # กฎเหล็กสั่งงาน AI (ใส่กฎ Ponytail + Anti-AI Slop ที่นี่)
├── public/
│   └── assets/
│       ├── sprites/          # Pixel Art Sprites (บังคับขนาด 16x16 หรือ 32x32)
│       ├── audio/            # เพลง Lo-Fi และเสียงธรรมชาติ
│       └── data/             # Data-driven JSON (แก้ไข/ขยายเกมได้ที่นี่โดยไม่ต้องแก้โค้ด)
│           ├── traits.json
│           ├── buildings.json
│           └── weather_events.json
├── src/
│   ├── core/                 # การตั้งค่า Phaser, Game Loop, Time Speed Control (1x, 2x, 5x)
│   ├── world/                # ระบบสร้างแผนที่ (Simplex Noise), Tilemap, ทรัพยากรเกิดใหม่
│   ├── agent/                # สมองของตัวเอก (Utility AI, Needs, Life Cycle, Memory)
│   ├── kingdom/              # ระบบสร้างเมือง, Tech Tree, และการจัดการผู้ติดตาม
│   ├── god/                  # เครื่องมือของผู้เล่น (เสกฝน, เสกหิน, ให้พร)
│   ├── ui/                   # หน้าต่างสถานะบอท, บันทึกประวัติศาสตร์ (Chronicle), God Toolbar
│   └── main.ts               # จุดเริ่มต้นของเกม
├── index.html
├── package.json
└── vite.config.ts
```

---

## 7. ตัวอย่าง Prompt แรกสำหรับสั่ง AI Agent เพื่อเริ่มโปรเจกต์

เมื่อคุณติดตั้งเครื่องมือและเพิ่ม **Ponytail Skill** เรียบร้อยแล้ว สามารถคัดลอก Prompt ด้านล่างนี้ไปสั่ง AI Agent เพื่อเริ่มสร้างเกมได้เลย:

> **Prompt เริ่มต้น:**
> `/ponytail full`
> "ฉันต้องการสร้างเกม 2D Web-based แนว Cozy Life & God Simulator ด้วย Vite + TypeScript + Phaser 3 ตามโครงสร้างในไฟล์ `ai_game_dev_plan.md`
> 
> **กฎเหล็ก:**
> 1. ปฏิบัติตามหลักการ Ponytail อย่างเคร่งครัด เขียนโค้ดให้สั้นกระชับที่สุด ใช้ความสามารถของ Phaser 3 ที่มีอยู่แล้วโดยไม่ลง Library ที่ไม่จำเป็น
> 2. ห้ามทำกราฟิกแบบ AI Slop ให้ตั้งค่า Canvas เป็น `pixelArt: true` และใช้ขนาด Tile มาตรฐานที่ `16x16` พิกเซล
> 3. เริ่มต้นที่ **Phase 1 (MVP)** ก่อน: สร้างแผนที่เกาะ 2D ขนาด 64x64 ไทล์ สร้างตัวเอก 1 ตัวที่มีค่าความหิวและพลังงาน เดินหาอาหารและพักผ่อนเองได้ด้วยระบบ Utility AI พื้นฐาน พร้อม UI แสดงสถานะตัวเอกและปุ่มเร่งเวลา 1x, 2x, 5x"
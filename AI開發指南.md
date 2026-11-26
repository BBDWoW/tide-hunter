# 潮汐獵手 Tide Hunter：給 AI 的開發指南

這份文件是給「接手開發的 AI」看的。開始改任何東西之前，請先讀完這份。
（`CLAUDE.md`、`AGENTS.md` 都指向這份文件，Claude Code、Codex、Cursor 等工具會自動讀到。）

---

## 1. 這是什麼

像素風網頁遊戲：**釣魚 × 收服養成 × 肉鴿（Roguelike）**。
手機橫放為主要遊玩方式，也支援直式與電腦。

- 線上版：https://bbdwow.github.io/tide-hunter/
- 儲存庫：GitHub `BBDWoW/tide-hunter`，`main` 分支推上去就會自動部署
- 技術：Vite 7 ＋ TypeScript ＋ Preact ＋ Canvas 2D，沒有其他執行期相依
- 目前版本：看 `src/data/changelog.json` 最上面一筆

## 2. 最重要的規則（一定要遵守）

1. **回覆與所有遊戲內文字都用繁體中文**（程式註解也是繁體中文）。
2. **角色、劇情、美術都必須是原創**，不能模仿任何現有作品。
3. **每次改動都要發一個新版本**（見第 6 節），在 `changelog.json` 最上面加一筆，寫給玩家看得懂的說明。
4. **不要做這些事**（作者明確說過不要）：
   - 畫面切換的浪花轉場（已經拿掉了，不要再加回來）
   - 角色待機動畫太快：每格 0.3 秒（水母、星砂仔 0.36 秒），不要照美術建議改快
   - 霸主、守護者、統領者、神之手可以被抽到、抓到、孵出來（只有「神之手」事件能給霸主／守護者）
   - 角色跨區域出現：**每個角色只屬於一個區域**
5. **各區域的野生夥伴數量**：N 4–7、B 3–6、A 2–5、S 2–4、SSR 2–4（目前每區都是 13 種：4/3/2/2/2）。
6. **新美術匯入前一定要檢查瑕疵**：光暈、半透明邊、白色部分被吃掉、6 格底部沒對齊。匯入後要在戰鬥、圖鑑、棲息灣、港口實際截圖看過。
7. 需要**新角色設計**時，要先跟作者說清楚（數量、為什麼需要），寫成美術需求放在 `art-pack/`。

## 3. 指令

```bash
npm install
npm run dev        # 開發伺服器（http://localhost:5173/）
npm run build      # 型別檢查＋打包到 dist/（發版前一定要過）
npm run preview    # 預覽打包結果
```

檢查工具（在專案根目錄執行，見第 7 節）：

```bash
npx tsx tools/sim/fuzzdom.ts     # 4000 場隨機對戰，不能有錯誤
npx tsx tools/sim/audit2.ts      # 技能／角色／美術缺漏檢查
```

## 4. 程式架構

```
src/
  main.tsx              進入點：等 artReady 之後才 render
  styles.css            全部樣式（像素風 UI、--u 是一個場景像素在螢幕上的大小）
  data/                 純資料
    creatures.ts        角色表 FORMS、各區域野生名單 *_POOL、特性 ABILITIES
    evolutions2.ts      第二波進化（26 個）
    new44.ts            第三波：44 條區域專屬進化線（104 個形態）
    skills.ts           技能表 SKILLS、場地 FIELDS
    boons.ts            能力卡
    held.ts             攜帶道具
    domains.ts          神秘區域的領域效果
    changelog.json      更新紀錄（版本號就是第一筆）
  game/                 遊戲規則（不碰畫面，可以在 Node 跑模擬）
    battle.ts           戰鬥引擎：createBattle、resolveTurn、aiChoose、最終決戰（resolveFinal）
    creature.ts         Mon、能力值、經驗、進化、makeMon
    run.ts              一趟冒險：海域 ZONES、航線、遭遇、商店、存檔
    meta.ts             永久進度：珍珠、棲息灣、設施、成就、招募
    eggs.ts / events.ts / guardian.ts / capture.ts / rng.ts
  render/               Canvas 繪圖
    scene.ts            所有場景（海面、戰鬥、釣魚、海圖、港口…）、站位 monSlot
    pixel.ts            角色繪製 drawSprite（快取、換色、色違、整體浮動）
    art.ts              美術載入（延後載入，見第 8 節）
    vfx.ts              技能特效（三層圖集＋定位）
    evo.ts / eventArt.ts / fx.ts
  ui/                   Preact 畫面
    App.tsx             畫面流程（Screen 狀態機）、背景音樂切換
    layout.tsx          GameScreen、SceneCanvas（2 倍解析度、兩側延伸 bleed）
    Battle.tsx          戰鬥畫面（事件播放、1 對 2、漁夫的釣竿）
    Screens.tsx         主畫面、海圖、港口、圖鑑、結算…
    其他：AfterBattle、Fishing、Gacha、Bay、Egg、GodHand、Finale、Special、Treasure
  audio/                Web Audio 即時合成的音樂與音效（沒有音檔）
  art/                  美術（見第 5 節）
dev/                    開發用頁面（美術匯出、特效總表、接縫檢查）
tools/sim/              Node 模擬與檢查腳本
art-pack/               給美術的需求文件與舊素材
```

### 畫面座標

- 場景邏輯大小是 **256×144**，畫布用 **2 倍解析度**（`RES = 2`）繪製。
- 寬螢幕時左右會延伸 `view.bleed` 像素。**全畫面的填色、變暗層一定要從 `-view.bleed` 畫到 `W + view.bleed`**，不然會出現黑邊。可以用 `dev/seams.html` 檢查。
- 戰鬥站位在 `scene.ts` 的 `BATTLE` 和 `monSlot()`。霸主專屬版（世界大小 96）會自動縮小並調整位置。

### 存檔（localStorage）

- `tidehunter.run.v4`：目前的冒險
- `tidehunter.meta.v1`：珍珠、棲息灣、設施、成就
- `tidehunter.dex.v1`：圖鑑、打倒過的霸主、傳說紀錄
- 改資料結構時要相容舊存檔（新欄位一律用可選欄位）

## 5. 資料與美術的規格

### 角色

- 一個形態一筆 `Form`（`creatures.ts` 的介面）：id、名字、稀有度 N/B/A/S/SSR、階段 1/2/3、屬性、種族值、特性、學習表 `learn`、進化 `evolve`。
- 學習表會**沿著進化線累積**（進化後的型態只要寫新學的招）。
- `secret: true` 的不會出現在圖鑑和招募（統領者、神之手）。
- 霸主與守護者列在 `meta.ts` 的 `ZONE_BOSSES`。

### 角色美術

- `src/art/sprites/<代號>.png`（主圖）、`src/art/shiny/<代號>.png`（色違），6 格橫排。
- 每格是世界大小的 **2 倍**：一般 96×96（世界 48）、完全體 128×128（世界 64）、霸主專屬版 192×192（世界 96）。
- `src/art/sprite_manifest.json`：每個代號的 `logical`（世界大小）、`frame`（每格像素）、`sockets`（特效定位點）、`idle`（整體上下浮動，可選）。
- 最低點貼齊每格底部往上 2 像素，6 格一致。

### 技能特效

- `src/art/vfx/<技能代號>/back.png、front.png、particles.png`，每張 768×312（192×104 × 4×3 格，100ms／格）。
- `src/art/vfx_skills.json`：定位方式（style、socket、位移）；`src`＋`hue` 代表借用別招的圖再換色；`r: 'eclipse'` 是統領者的特效。

## 6. 發版流程（每次改動都要做）

1. 在 `src/data/changelog.json` **最上面**加一筆：`{ "version": "x.y.z", "date": "YYYY-MM-DD", "items": ["給玩家看的說明", …] }`
   - 小修正加第三碼，新功能加第二碼，大改版加第一碼
2. `npm run build` 必須通過
3. 跑相關的檢查（至少 `npx tsx tools/sim/fuzzdom.ts`）
4. commit 後推到 `main`，GitHub Actions 會自動部署（約 40 秒）
5. 玩家端會自動偵測新版本並提示更新

## 7. 測試與檢查工具

| 工具 | 用途 |
|---|---|
| `npx tsx tools/sim/fuzzdom.ts` | 4000 場隨機對戰（含領域），抓錯誤和無限迴圈 |
| `npx tsx tools/sim/audit2.ts` | 技能都有特效、都有人學、角色都有主圖和色違 |
| `npx tsx tools/sim/zonestat.ts` | 各區域各稀有度的野生夥伴數量 |
| `npx tsx tools/sim/encsim.ts` | 每區模擬釣魚 600 次，不能出錯、不能出現別區的形態 |
| `npx tsx tools/sim/bossaudit2.ts` | 霸主／守護者不會被抽到或孵出來 |
| `npx tsx tools/sim/evoaudit.ts` | 進化線檢查 |
| `npx tsx tools/sim/finalsim4.ts` | 最終決戰勝率（目標約 35–45%） |
| `npx tsx tools/sim/ghsim.ts` | 神之手存活率（目標約 90%） |
| `dev/fxgrid.html` | 開發伺服器上打開，看所有技能特效的關鍵格（`?only=代號,代號`） |
| `dev/seams.html` | 自動找出場景兩側延伸區的接縫（黑邊） |
| `dev/export-all.html` | 匯出全部美術給美術調整 |

畫面測試：專案用 Playwright（`require('playwright')`）開手機橫向尺寸實際點流程、截圖檢查。

開發用網址參數（只在 `npm run dev` 有效）：
- `?enc=形態代號&lv=等級`：下一次釣魚必定遇到這隻
- `?field=storm`：戰鬥直接顯示場地特效
- `?finalhp=1`：最終決戰統領者開場只剩 1 HP（測第二條血）
- `?godhand`：打倒霸主後必定出現神之手

## 8. 效能注意事項

- **角色圖是延後載入的**：開場只等存檔裡會看到的角色，其他在背景下載。`spriteArt(id)` 拿不到圖時會自動插隊下載；需要確定圖已經好了的地方用 `ensureSprite(id)`。
- **不要在每一格畫面逐像素 `fillRect`**（以前海圖迷霧這樣做，手機掉到 10 FPS）。要畫大量像素時，先寫進 `ImageData` 存成快取，再整張貼上。
- 用手機 CPU 慢 4 倍的條件量 FPS，目標每個畫面都在 55 FPS 以上。

## 9. 遊戲系統速查

- **一趟冒險**：碧藍淺灘 → 冰封峽灣／熔岩裂谷（二選一）→ 電子海域／深淵（二選一）→ 最終決戰「統領者・潮汐默旭」。每片海域 10 站，最後一站是霸主。
- **難度**：第二片海域對手能力 +10%、第三片 +20%，神秘區域再 +10%；潮位（★）另外加成。
- **神秘區域**：聖林域、無稽區、域核區域，從航線上的入口進去，有領域效果（敵我都受影響，敵人效果較弱），打倒守護者拿獎勵。
- **最終決戰**：兩條血；打掉第一條會召喚一隻霸主變 1 對 2；每 5 回合大絕招（全隊各中一種異常）；第二條血時可用「漁夫的釣竿」。
- **神之手**：打倒霸主後 0.5% 出現，可以犧牲兩隻夥伴換霸主，或撐過 20 回合。
- **潮汐卵**：打倒霸主／守護者／金寶箱時機率拿到，出海幾次後孵化，有失敗率，可用珍珠暖蛋。
- **港口**：設施升級、招募（抽夥伴）、成就與稱號；**棲息灣**：帶回來的夥伴，可選出航夥伴。

## 10. 和另一個 AI 同時開發

- 兩邊都直接用同一個 GitHub 儲存庫，**開始工作前先 `git pull`**，做完馬上 commit、push。
- 版本號以 `changelog.json` 最上面一筆為準，push 前再確認一次有沒有被另一邊用掉。
- 同一時間盡量不要兩邊都改同一個大檔案（`Battle.tsx`、`scene.ts`、`creatures.ts`、`styles.css`），容易衝突。
- 如果拿到的是壓縮包而不是儲存庫：改完之後把整個資料夾（不含 `node_modules`、`dist`）壓縮傳回來，或直接推到儲存庫的新分支。

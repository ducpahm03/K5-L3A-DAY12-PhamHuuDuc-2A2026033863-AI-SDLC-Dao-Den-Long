# Kế Hoạch Triển Khai — Đảo Đèn Lồng (Day 12 AI SDLC · Phase 1 & Kiến Trúc Mở Rộng)

> **Dự án:** `K5-L3A-DAY12-PhamHuuDuc-2A2026033863-AI-SDLC-Dao-Den-Long`
> **Team ID:** `2A2026033863-pham-huu-duc`
> **Mục tiêu:** Đạt điểm tối đa **100/100** theo `RUBRIC.md` — vừa có trải nghiệm 3D cổ tích ấn tượng, vừa chuẩn xác 100% **Test Contract v1.0**, sẵn sàng mở rộng cho Phase 2–4 mà không phải đập đi xây lại.

---

## 1. Kiến Trúc & Công Nghệ Đã Chốt

- **Stack:** TypeScript + Three.js (Vite) cho bản 3D Web + Node.js (`v24`, tương thích macOS/Linux/Windows) chạy trực tiếp chung lõi mô phỏng.
- **Tách lõi tuyệt đối (`src/core/` không phụ thuộc DOM/Three.js/Browser):**
  - `src/core/` — Simulation engine thuần TS, chạy bước cố định **60 tick/giây (`dt = 1/60`)**, PRNG tất định (`Mulberry32`), xử lý scenario/input/physics/AI/score/events.
  - `src/headless/` — CLI tuân thủ chặt **Test Contract v1.0**, biên dịch bằng `esbuild` ra 1 file `dist/headless.mjs` chạy tức thì không cần GPU/cửa sổ.
  - `src/game/` — Lớp trình diễn 3D Three.js + WebAudio procedural + HUD cổ tích + điều khiển dual-mode. Dùng đúng `Simulation` ở `src/core/` với bộ tích lũy thời gian cố định (`fixed timestep 60Hz`). Mọi yếu tố sáng tạo hình ảnh/âm thanh nằm hoàn toàn ở tầng này → **0% rủi ro lệch kết quả headless**.

### Cấu trúc thư mục dự kiến
```text
.
├── game.contract.json              # Khai báo Test Contract v1.0 (khớp 100% src/core/tuning.ts)
├── AGENTS.md                       # Harness chính ngắn gọn (~50 dòng), cập nhật qua các phase
├── CREDITS.md  LICENSE             # Bản quyền MIT + nguồn tài nguyên procedural/AI
├── README.md                       # Hướng dẫn ≤ 3 lệnh, điều khiển, điểm số, "Sáng tạo của tôi"
├── .agents/skills/verify-phase/    # Skill tự kiểm chứng + sinh bằng chứng thật
├── .githooks/pre-commit            # Hook chặn commit khi test/contract đỏ
├── .github/workflows/ci.yml        # GitHub Actions CI: build + unit + scenario + determinism
├── src/
│   ├── core/                       # Lõi mô phỏng thuần TS (shared giữa 3D & headless)
│   │   ├── tuning.ts               # Nguồn chân lý duy nhất cho hằng số (đồng bộ game.contract.json)
│   │   ├── rng.ts                  # PRNG Mulberry32 tất định theo --seed
│   │   ├── types.ts                # Kiểu Snapshot, Event, Scenario, InputFrame, State
│   │   ├── validation.ts           # Kiểm tra chặt schema scenario/inputs (lỗi -> exit code 2)
│   │   └── simulation.ts           # Vòng lặp step(tick) 60Hz chuẩn Test Contract v1.0
│   ├── headless/
│   │   └── cli.ts                  # Entrypoint CLI: --seed --night --scenario --inputs --ticks --out
│   └── game/                       # Bản 3D Cổ Tích Điện Ảnh (tách hoàn toàn khỏi headless)
│       ├── main.ts                 # Khởi động app, game loop, title/win/lose/replay flow
│       ├── scene.ts                # Đảo Bến 3D, biển mây trôi, bầu trời/sương biến chuyển 0→5 đèn
│       ├── entities.ts             # Mây (nón lá treo đèn lắc lư, áo choàng), 5 Đèn Lớn, Bóng Mực, Đom Đóm
│       ├── vfx.ts                  # Sóng Tỏa Sáng, vòng an toàn, luồng gió đom đóm dẫn đường, vệt sáng
│       ├── audio.ts                # Nhạc nền ngũ cung nhiều lớp + SFX tổng hợp 100% WebAudio
│       ├── controls.ts             # WASD theo cam_yaw, Space, E, F/RightClick, kéo chuột/PointerLock + mũi tên
│       └── hud.ts                  # HUD tối giản cổ tích, mini-la bàn chỉ đèn chưa thắp, gợi ý nút
├── tests/
│   ├── unit/                       # Test đơn vị (Vitest): rng, movement, pickup, deposit, pulse, shade, score
│   ├── scenarios/                  # Bộ scenario + inputs kiểm chứng toàn diện Test Contract v1.0
│   └── contract.test.ts            # Test tích hợp chạy thật `dist/headless.mjs`, kiểm tra JSONL & exit code 2
├── scripts/
│   ├── sync-check.mjs              # Kiểm tra tuning trong code khớp 100% game.contract.json
│   ├── verify-all.mjs              # 1 lệnh chạy full: sync-check + build + unit + contract + determinism
│   └── capture-proof.mjs           # Chạy headless + chụp ảnh 3D thật (Playwright) lưu vào docs/proof/phase-1/
└── docs/
    ├── notes/                      # phase-1-assumptions.md, ai-log.md, phase-1-eval.md
    └── proof/phase-1/              # Bảng truy vết yêu cầu, output JSONL thật, hash tất định, ảnh 3D
```

---

## 2. Bộ Thông Số `tuning` & Giả Định Luật Chơi (Phase 1)

| Tham số | Giá trị | Ý nghĩa & Giả định |
|---|---:|---|
| Đảo Bến | R = `35` m | Đảo tròn tâm `(0,0,0)`, mặt đất `Y = 0`, rào đá/biển mây mềm (`fall_enabled: false`) |
| 5 Đèn Lồng Lớn | `L1`..`L5` | Bố trí đều 5 đỉnh ngũ giác ở bán kính `22` m quanh tâm đảo (góc bắt đầu `+Z`) |
| `player_speed` | `6` m/s | Tốc độ đi bộ của Mây; nhảy `v0 = 7.5 m/s`, `g = -20 m/s²` |
| `carry_capacity` | `5` | Số đom đóm tối đa Mây mang trên người |
| `lantern_cost` | `3` | Số đom đóm cần nạp để thắp 1 Đèn Lồng Lớn (tổng 15 cho Đêm 1) |
| `pickup_radius` | `1.5` m | Tự nhặt đom đóm khi khoảng cách XZ `<= 1.5` và còn chỗ mang |
| `interact_radius` | `2.5` m | Nhấn `E` (`interact` rising edge) nạp toàn bộ số đom đóm cần vào đèn chưa thắp gần nhất |
| `pulse_cost` / `radius` | `1` / `7` m | Tốn 1 đom đóm; đẩy lùi `4` m (`pulse_push_m`), choáng `3` s (`pulse_stun_s`), hồi `2` s (`pulse_cooldown_s`) |
| `night1_duration_s` | `180` s | Hết giờ trước khi thắp đủ 5 đèn → thua (`reason: "dawn"`) |
| `flames` / `invuln_s` | `3` / `1.5` s | 3 ngọn lửa máu; bất tử 1.5s sau khi bị chạm; về 0 → thua (`reason: "no_flames"`) |
| `hit_drop_ratio` | `0.5` | Khi bị chạm rơi `floor(carried * 0.5)` đom đóm |
| `safe_radius` | `6` m | Quanh mỗi **đèn đã thắp**, Bóng Mực không thể tiến vào (nếu ở trong sẽ bị đẩy/chạy ra) |
| `shade_speed` / `hit_radius` | `3.6` m/s / `1.2` m | Bóng Mực đuổi theo Mây trên XZ; tâm ở `Y = 1.0`; chạm khi không bị choáng |
| `score` | `10 / 200 / 25 / 5 / 100` | `per_mote: 10`, `per_lantern: 200`, `per_stun: 25`, `per_second_left: 5` (tính theo `floor(time_left_s)` khi thắng), `per_flame_left: 100` |

### Quy tắc đảm bảo 100% chuẩn Test Contract v1.0
1. **Mô hình tick:** Snapshot tick `0` sau khi dựng scenario, trước input. Bước `k` (`0..N-1`) áp dụng input tick `k` → sinh trạng thái & sự kiện mang `tick = k + 1`.
2. **Khoảng cách:** Mọi bán kính đo trên mặt phẳng ngang **XZ** giữa các điểm chuẩn (`player.pos` chân, `shade.pos` tâm, `lantern.pos` chân cột, `mote.pos` điểm mặt đất), so sánh `<= r`. Làm tròn 3 chữ số thập phân, không có `-0`.
3. **Chuyển động & góc nhìn:** Với `θ = rad(cam_yaw_deg)`, `x' = x·cosθ + z·sinθ`, `z' = -x·sinθ + z·cosθ`; chuẩn hóa nếu độ dài > 1. Rising edge (`false -> true`) cho `jump`, `interact`, `pulse`.
4. **Scenario:** Dựng scenario không phát sự kiện, không cộng điểm; `lanterns` cập nhật theo `id`; `motes`/`shades` thay thế danh sách; `random_motes: false` / `random_shades: false` tắt sinh tự động.
5. **Exit code:** Thành công `0`; sai format/schema file `--inputs` hoặc `--scenario` trả đúng mã **`2`** kèm thông báo rõ ra `stderr`.
6. **Tính tất định:** Cùng `--seed`, `--scenario`, `--inputs` cho output JSONL trùng khớp từng byte (SHA-256 giống hệt nhau giữa 2 lần chạy).

---

## 3. Trải Nghiệm 3D Cổ Tích Điện Ảnh ("Sáng Tạo Của Tôi" — 4đ Rubric F)

Hoàn toàn nằm ở tầng hiển thị/âm thanh (`src/game/`), **tắt hoàn toàn trong chế độ headless**:
- **Mỹ thuật 3D Procedural (100% code, 0 asset bản quyền bên ngoài):**
  - **Mây:** Nhân vật nhỏ nhắn mặc áo choàng bay theo vận tốc, đội **nón lá** có **đèn lồng mini treo ở chóp nón** lắc lư theo chuyển động và tỏa nguồn sáng điểm vàng ấm.
  - **Đảo Bến:** Mặt đảo đá rêu + đường lát đá nối tới 5 Đèn Lồng Lớn kiểu kiến trúc đình cổ tích, cầu gỗ bến tàu nhô ra **biển mây trôi bồng bềnh** đa tầng, trời đêm sao lấp lánh + trăng lưỡi liềm.
  - **5 Đèn Lồng Lớn:** Đổi trạng thái rõ ràng từ tắt (tím lạnh) → đang nạp (hiện 1–3 hạt sáng xoay quanh) → đã thắp (bừng vàng cam, vòng an toàn `safe_radius` phát sáng dịu dưới đất, cột sáng ấm hướng lên trời).
  - **Bóng Mực:** Cụm mực đen tím bập bùng nhiều lớp + đôi mắt sáng tím lạnh + đuôi khói; khi bị `pulse` choáng sẽ tách ánh vàng, run rẩy và hiện vòng choáng.
  - **Biến chuyển không khí theo tiến độ (0/5 → 5/5):** Sương tím đen loãng dần, đèn nền bầu trời chuyển dần từ đêm sâu sang ánh cổ tích ấm áp; có **luồng gió đom đóm dẫn đường** lượn nhẹ từ Mây về phía đèn chưa thắp gần nhất.
- **Âm thanh WebAudio Procedural (không cần tải file):**
  - Nhạc nền thang âm ngũ cung Việt Nam/Á Đông nhẹ nhàng, tự mở thêm lớp hòa âm theo số đèn đã thắp.
  - Hiệu ứng riêng: chuông gió (nhặt đom đóm), cộng hưởng chuông đồng ấm (nạp & thắp đèn), sóng xung kích ánh sáng (tỏa sáng `pulse`), tiếng mực tan/va chạm, quạt khải hoàn khi thắng.
- **Điều khiển & HUD:**
  - Dual-mode: `WASD` di chuyển theo hướng camera, `Space` nhảy, `E` nạp đèn, `F` hoặc chuột phải để Tỏa sáng, kéo chuột (hoặc click bật Pointer Lock) + mũi tên `←/→` xoay camera.
  - Màn hình tiêu đề 3D xoay chậm quanh Đảo Bến + cốt truyện ngắn; HUD cổ tích gọn gàng (lửa máu, đom đóm mang theo, tiến độ 5 đèn, đồng hồ Đêm 1, điểm số, thanh hồi chiêu Tỏa sáng, mini-la bàn chỉ hướng đèn chưa thắp, nút bật/tắt nhạc).

---

## 4. Lộ Trình Thực Hiện Theo Chuẩn SDLC & Harness (Tối Đa 45đ Rubric B+C+D)

Mỗi bước đi kèm 1 commit nhỏ, rõ ràng (không push, không gắn tag `phase-1` cho tới khi bạn duyệt):

1. **Bước 1 — CP0 Setup & Harness (`chore(cp0)`):**
   - Khởi tạo `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `LICENSE` (MIT), `CREDITS.md`.
   - Viết `AGENTS.md` ngắn gọn (~50 dòng), `.agents/skills/verify-phase/SKILL.md`, `.githooks/pre-commit`, `.github/workflows/ci.yml`.
   - Ghi trước `docs/notes/phase-1-assumptions.md` (yêu cầu bắt buộc, chỗ mơ hồ + giả định, tiêu chí nghiệm thu & cách kiểm chứng TRƯỚC khi viết code).
2. **Bước 2 — Lõi mô phỏng & Test Contract (`feat(core)`, `feat(headless)`):**
   - Xây dựng `src/core/*` (`tuning.ts`, `rng.ts`, `types.ts`, `validation.ts`, `simulation.ts`) + `game.contract.json` + `scripts/sync-check.mjs`.
   - Xây dựng `src/headless/cli.ts`, build ra `dist/headless.mjs`.
3. **Bước 3 — Kiểm chứng lõi & Bộ test tự động (`test(contract)`):**
   - Viết unit test toàn bộ luật chơi + bộ scenario headless: di chuyển theo `cam_yaw_deg`, nhặt đom đóm, nạp & thắp đèn, thắng (`all_lit`), thua (`no_flames`, `dawn`), `pulse` đẩy & choáng, `safe_radius`, kiểm tra tất định 2 lần chạy (so khớp SHA-256), kiểm tra lỗi định dạng trả mã thoát `2`.
   - Chạy `npm run verify` đảm bảo 100% xanh.
4. **Bước 4 — Thế giới 3D Cổ Tích Điện Ảnh & Âm Thanh (`feat(3d)`):**
   - Xây dựng `src/game/*` (scene, entities, vfx, audio, controls, hud, main) nối trực tiếp vào `src/core/simulation.ts`.
   - Build bản web tĩnh (`npm run build`), chạy thử thật bằng trình duyệt (Playwright) và kiểm tra console không lỗi.
5. **Bước 5 — Bằng Chứng Thật, Đánh Giá Độc Lập & Tài Liệu (`docs(phase-1)`):**
   - Chạy `scripts/verify-all.mjs` + `scripts/capture-proof.mjs`: xuất bằng chứng thật vào `docs/proof/phase-1/` (bảng truy vết từng yêu cầu → lệnh chạy → kết quả, file JSONL mẫu, hash tất định, ảnh chụp màn hình 3D thật: màn title, lúc chơi, sau khi thắp đèn, khi tỏa sáng).
   - Thực hiện bước **Review độc lập** (dùng subagent reviewer đối chiếu code, contract, bằng chứng với PRD-0 & RUBRIC).
   - Cập nhật `README.md` (cài & chạy ≤ 3 lệnh, điều khiển, bảng điểm, mục *"Sáng tạo của tôi"*), `docs/notes/ai-log.md` (nhật ký dùng AI, lỗi AI phát hiện, ước tính token & cách tiết kiệm), `docs/notes/phase-1-eval.md`.
   - Bàn giao danh sách commit sạch ở local để bạn kiểm tra và duyệt trước khi chạy `git tag phase-1 && git push`.

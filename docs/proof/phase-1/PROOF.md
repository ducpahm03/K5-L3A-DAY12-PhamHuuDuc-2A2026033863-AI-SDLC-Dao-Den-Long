# Bằng Chứng Kiểm Chứng — Phase 1 (`phase-1` · Contract v1.0)

> Mọi bằng chứng dưới đây được sinh trực tiếp từ mã nguồn thật tại tag `phase-1` (không chỉnh sửa tay).
> Lệnh tái lập toàn bộ kiểm chứng: `npm run verify` và `node scripts/generate-proof.mjs`.

## 1. Bảng Truy Vết Yêu Cầu → Bằng Chứng

| Mã | Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| AC-01 | `game.contract.json` khớp chính xác 100% thông số game | `npm run sync-check` | `scripts/sync-check.mjs` → `sync-check OK` | **Đạt** |
| AC-02 | Di chuyển `move [x,z]` quay theo `cam_yaw_deg` + chuẩn hóa đường chéo + nhảy về `Y=0` | `npm test` (`tests/unit/simulation.test.ts`) | 2 unit test xanh (vị trí `[0,0,6]`, `[6,0,6]`, `6/√2`) | **Đạt** |
| AC-03 | Tự nhặt đom đóm trong `<= 1.5m`, giới hạn `carry_capacity = 5`, cộng `10` điểm/con | `npm test` + headless CLI | `docs/proof/phase-1/win_night1.jsonl` (`mote_picked` x3) | **Đạt** |
| AC-04 | Nạp ánh sáng (`interact` rising edge `<= 2.5m`), thắp đủ 5 đèn → `won` (`all_lit`) + cộng thưởng | `npm test` + headless CLI | `docs/proof/phase-1/win_night1.jsonl` (`deposit`, `lantern_lit`, `game_over`, `end`) | **Đạt** |
| AC-05 | Bóng Mực đuổi & chạm `<= 1.2m` → `player_hit`, rơi `floor(carried*0.5)`, bất tử `1.5s`, hết lửa → `no_flames` | `npm test` (`simulation.test.ts`) | Unit test kiểm tra 2 hit cách nhau `>= 90` tick → `lost / no_flames` | **Đạt** |
| AC-06 | Tỏa sáng (`pulse`) tốn 1 đom đóm, đẩy `4m`, choáng `3s` (`stunned`), hồi chiêu `2s`, `+25` điểm | `npm test` + headless CLI | `docs/proof/phase-1/pulse_stun.jsonl` (`pulse` stunned `["S1"]`, `pos.z = 9`) | **Đạt** |
| AC-07 | Bóng Mực không đi vào trong `safe_radius = 6m` quanh đèn đã thắp | `npm test` (`simulation.test.ts`) | 300 tick liên tiếp giữ `dist >= 6.0m`, `flames = 3` | **Đạt** |
| AC-08 | Hết `time_left_s` trước khi thắp đủ 5 đèn → `game_over {lost, dawn}` | `npm test` (`simulation.test.ts`) | Tick 60 phát `game_over {result: "lost", reason: "dawn"}` | **Đạt** |
| AC-09 | File inputs/scenario sai định dạng hoặc tick không tăng nghiêm ngặt → exit code `2` + `stderr` | `npm test` (`tests/contract.test.ts`) | CLI thật thoát đúng mã `2`, có thông báo lỗi trên `stderr` | **Đạt** |
| AC-10 | Tính tất định byte-for-byte giữa 2 lần chạy cùng `--seed` | `npm run verify` + `generate-proof.mjs` | `docs/proof/phase-1/determinism.txt` (SHA-256 trùng khớp 28.398 bytes) | **Đạt** |
| AC-11 | Bản 3D chạy mượt, 0 lỗi console, hiển thị Mây (nón lá treo đèn), 5 Đèn Lớn, đom đóm, Bóng Mực, HUD, chơi lại | Build `dist/web` + mở bằng Playwright | `01-title.png`, `02-gameplay.png`, `03-spawn-dais.png` (0 errors, 0 warnings) | **Đạt** |
| AC-12 | Phần sáng tạo hình ảnh/âm thanh không làm lệch kết quả headless | Tách riêng `src/game/` khỏi `src/core/` | `src/core/` 0 import Three.js/WebAudio; `determinism.txt` ổn định | **Đạt** |

## 2. Kết Quả Kiểm Chứng Tự Động (`npm run verify`)
- `sync-check`: `game.contract.json matches src/core/tuning.ts 100%.`
- `tsc --noEmit`: 0 lỗi.
- `vite build`: `dist/web/` xây dựng thành công (133.47 kB gzip).
- `esbuild`: `dist/headless.mjs` (26.1 kB, chạy tức thì không cần GPU).
- `vitest run`: **2 test files passed, 12/12 tests passed**.
- **Determinism (1800 ticks, `--seed 1337`)**:
  - Xem chi tiết tại [determinism.txt](determinism.txt)
  - SHA-256 trùng khớp giữa 2 lần chạy độc lập: `fda27bdaae5bf38059b88d87384d688e95814a6e0b53bc9650feaf7da045f3f3` (`28398` bytes).

## 3. Ảnh Chụp Thực Tế Bản 3D (`dist/web`)
- [01-title.png](01-title.png) — Màn hình tiêu đề 3D xoay quanh Đảo Bến với hướng dẫn điều khiển.
- [02-gameplay.png](02-gameplay.png) — Gameplay thực tế: Mây đội nón lá treo đèn, 5 đom đóm xoay quanh, luồng gió dẫn đường tới Đèn L1, 2 Bóng Mực đuổi theo, HUD hiển thị lửa/đom đóm/điểm/la bàn.
- [03-spawn-dais.png](03-spawn-dais.png) — Bệ đá tâm đảo `(0,0,0)`, ánh sáng đèn mini treo trên nón lá, cây thông cổ tích và đom đóm trên đảo.

# Bằng Chứng Kiểm Chứng — Phase 2 (`phase-2` · Contract v1.1)

> Sinh trực tiếp từ mã nguồn tại tag `phase-2`. Lệnh tái lập: `npm run verify` và `node scripts/generate-proof.mjs`.

## 1. Bảng Truy Vết Yêu Cầu Ticket-02 → Bằng Chứng

| Mã | Yêu cầu (Ticket-02 / Contract v1.1) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P2-01 | Số liệu chuẩn & 12 bước/tick, regression Phase 1 với số chuẩn | `npm run sync-check` + `npm test` | `game.contract.json` v1.1 khớp 100% `tuning.ts`; 16/16 test xanh | **Đạt** |
| P2-02 | Lướt (`dash`): 14 m/s, 0.2s (12 tick), hồi 1.5s (90 tick) từ lúc bắt đầu, giữ cao độ trên không | Unit + Contract CLI test | `tests/unit/simulation.test.ts` + `tests/contract.test.ts` (`dash` event) | **Đạt** |
| P2-03 | Rơi khỏi đảo (`Y < -10`): bỏ qua bất tử, mất 1 lửa + toàn bộ đom đóm (`lost`), chờ 60 tick hồi sinh + bất tử 90 tick | Unit test | `simulation.test.ts` (`player_hit {by:"fall", lost: 6}`) | **Đạt** |
| P2-04 | Đêm 2 — Đảo Cau (2 đảo R=28m + cầu tre + 2 bục nhảy bắn sang đảo kia, 6 đèn) | Unit + Headless CLI (`--night 2`) | `docs/proof/phase-2/night2_sample.jsonl` + test bục nhảy `(20,0,18)` | **Đạt** |
| P2-05 | Đêm 3 — Đảo Chuông (3 tầng Y=0/3/6, 2 dốc 30°/150°, bục nhảy, tháp chuông R=2m, gió mạnh 30s/5s, 7 đèn) | Unit + Headless CLI (`--night 3`) | `docs/proof/phase-2/night3_sample.jsonl` + test bục nhảy tầng 2 | **Đạt** |
| P2-06 | Gió Lạc (`drifters` D1..D2): `idle → chase → drifter_steal → flee`, trúng `pulse` nhả lại (`drifter_drop`) | Unit + Contract CLI test | `simulation.test.ts` + `contract.test.ts` (`drifter_steal`, `drifter_drop`) | **Đạt** |
| P2-07 | Bùa Gió (`charms` C1..C2): `charm_picked`, chạy 7.2 m/s & Lướt 0s hồi chiêu trong 600 tick, hồi sau 2700 tick | Unit + Contract CLI test | `simulation.test.ts` + `contract.test.ts` (`charm_picked`) | **Đạt** |
| P2-08 | Tạm dừng (`pause`): phát `paused {}` / `resumed {}`, `tick` tăng nhưng `sim_tick` & bộ đếm đứng yên | Unit + Contract CLI test | `simulation.test.ts` + `contract.test.ts` | **Đạt** |
| P2-09 | 5 trạng thái Bóng Mực chuẩn (`spawning`, `wander`, `chase`, `recoil`, `stunned`) | Unit + Contract CLI test | `night1_sample.jsonl`, `night2_sample.jsonl`, `night3_sample.jsonl` | **Đạt** |
| P2-10 | Hiệu năng Headless Đêm 3 đầy đủ (21.600 tick) `<= 30s` & tất định SHA-256 | `npm run verify` | [perf_and_determinism.txt](perf_and_determinism.txt): **142.7 ms** (`< 0.15s`), SHA-256 khớp 100% | **Đạt** |
| P2-11 | Bảng màu chuẩn (≤ 10% RGB), ánh sáng `0.15 + 0.55*(lit/total)`, chuỗi 3 Đêm, Pause/Settings, HUD + mũi tên ngoài màn hình | Kiểm tra mã nguồn `src/game/scene.ts`, `hud.ts`, `styles.css` & build `dist/web` | Build `dist/web` thành công (`1.19s`), đúng hằng số `PALETTE` | **Đạt** |

## 2. Số Đo Hiệu Năng & Tính Tất Định (`perf_and_determinism.txt`)
- **Lệnh:** `node dist/headless.mjs --seed 1337 --night 3 --ticks 21600 --snapshot-every 600 --out <file>`
- **Thời gian chạy 21.600 tick:** `142.7 ms` (yêu cầu `<= 30.000 ms` — nhanh gấp ~210 lần ngưỡng yêu cầu).
- **SHA-256 Run A & Run B:** `c545106046f306dea708bbc3f4d1743df9dbc7fa2be1a624af30c9cf700b4fa4` (`62.932` bytes trùng khớp tuyệt đối).

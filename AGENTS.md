# AGENTS.md — Đảo Đèn Lồng (Phase 3 · Contract v1.2 · Đèn Cạn Dầu)

## Lệnh cốt lõi
- Cài đặt: `npm ci`
- Build (3D web + headless CLI): `npm run build`
- Chạy game 3D: `npm run start`
- Chạy headless: `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out tmp.jsonl` (`--night` nhận `1 | 2 | 3`)
- Kiểm chứng toàn bộ (bắt buộc xanh trước khi commit/tag): `npm run verify`

## Kiến trúc bắt buộc
- `src/core/` thuần TypeScript (không import `three`, `window`, `document`, `fs`, `Math.random()`).
- Tính nhiên liệu đèn (`fuel`) theo **đơn vị nguyên `1/60` (`fuelUnits ∈ [0, 6000]`)** để không bị sai số số thực; chỉ làm tròn 1 chữ số thập phân khi xuất JSONL.
- `src/core/tuning.ts` và `game.contract.json` (`contract_version: "1.2"`) luôn đồng bộ 100% (`npm run sync-check`).

## Bất biến Test Contract v1.2 (Phase 3 Change Request)
- **Nhiên liệu đèn:** Khi thắp (mới hoặc lại) `fuel = 100` (`6000` units). Bước 2 mỗi tick: trừ hao tự nhiên `1/60` + trừ hút dầu `5/60` mỗi Bóng Mực đang `drain`; ngay sau bước 2, đèn có `fuel <= 0` tắt (`lit = false`, `deposited = 0`, `ever_lit = true`, phát `lantern_out`).
- **Thắp lại & Châm dầu:** Đèn `ever_lit: true` chỉ cần `5` đom đóm để thắp lại (`lantern_lit {lantern_id, relight: true}`, `+40` điểm). Đèn đang sáng `fuel < 100` nhận châm dầu: `used = min(carried, ceil((100 - fuel)/10))`, `fuel = min(100, fuel + 10*used)`, phát `refuel {lantern_id, amount, fuel}`. Đèn đầy dầu (`used = 0`) không được chọn.
- **Vùng an toàn & Hút dầu (`drain`):** Đèn `fuel < 30` mất vùng an toàn `6m`. Chỉ Bóng Mực `wander` chọn đèn sáng có `fuel < 30` gần nhất; khi cách `<= 2m` (XZ) chuyển sang `drain` (đứng yên hút `5 fuel/s`, phát `fuel_drain` mỗi 60 tick). Từ `drain` → `chase` (Mây `<= 6m`), `stunned` (trúng `pulse`, `+15` điểm), hoặc `wander` (đèn tắt / `fuel >= 30` / cách `> 2m`). Khi châm dầu lên `>= 30`, Bóng Mực trong `6m` bị đẩy ra mép trong tối đa 30 tick.
- **Luật thắng mới (`dawn_survived`):** Không còn thắng sớm `all_lit`. Thời lượng Đêm 1/2/3 = `240 / 270 / 300s`. Cuối tick bình minh (`time_left_s <= 0`), nếu còn sống và số đèn sáng `>= ceil(0.6 × tổng đèn)` → thắng `dawn_survived` (thưởng `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi lửa), ngược lại thua `dawn`. Hết lửa luôn thua `no_flames` trước.
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)`.

## Cổng chất lượng
- Không báo xong khi `npm run verify` chưa trả mã `0`. Mọi thay đổi luật phải ghi ADR & CHANGELOG, sửa test cũ kèm lý do rõ ràng.

# AGENTS.md — Đảo Đèn Lồng (Phase 2 · Contract v1.1)

## Lệnh cốt lõi
- Cài đặt: `npm ci`
- Build (3D web + headless CLI): `npm run build`
- Chạy game 3D: `npm run start` (hoặc `npm run dev`)
- Chạy headless: `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out tmp.jsonl` (`--night` nhận `1 | 2 | 3`)
- Kiểm chứng toàn bộ (bắt buộc xanh trước khi commit/tag): `npm run verify`

## Kiến trúc bắt buộc
- `src/core/` là **lõi mô phỏng thuần TypeScript**: tuyệt đối KHÔNG import `three`, `window`, `document`, `fs`, hay `Math.random()`.
- Mọi ngẫu nhiên đi qua `src/core/rng.ts` (`Mulberry32`) khởi tạo từ `--seed`.
- `src/core/tuning.ts` và `src/core/maps.ts` là nguồn chân lý duy nhất cho số liệu & bản đồ chuẩn; đồng bộ 100% với `game.contract.json` (`npm run sync-check`).
- `src/game/` chứa 3D (bảng màu chuẩn ≤ 10% RGB), VFX, âm thanh, HUD, cài đặt (`localStorage`) và sáng tạo thẩm mỹ — không làm đổi đầu ra headless.

## Bất biến Test Contract v1.1 (Phase 2)
- Bước cố định 60 tick/s, thứ tự bắt buộc **12 bước/tick**:
  1. Input (`pause` trước; vừa pause thì dừng bước) → 2. Giảm bộ đếm (thời gian, hồi chiêu, bất tử, choáng, bùa, TTL rơi, hồi bùa) → 3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió) + kiểm tra rơi (`Y < -10`) → 4. Nhặt đom đóm & bùa → 5. Tương tác đèn → 6. Cập nhật vùng an toàn (`6m`) → 7. Tỏa Sáng (`3D <= 5m` từ `chân + 0.8m`) → 8. Di chuyển Bóng Mực & Gió Lạc → 9. Chạm (Gió Lạc cướp trước, rồi Bóng Mực gây hit theo `id` tăng dần) → 10. Sinh định kỳ (tương tác từ tick sau) → 11. Xét thắng/thua (`no_flames` → `all_lit` → `dawn`) → 12. Snapshot.
- 5 trạng thái Bóng Mực bắt buộc đúng tên: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Điểm chuẩn hóa: `+10` mỗi đom đóm **nạp**, `+100` đèn thắp, `+5` mỗi Bóng Mực trúng Tỏa Sáng, thưởng thắng `floor(s)*2 + 50*flames`.
- Khi tạm dừng (`state: "paused"`): `tick` tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên.
- Hiệu năng: headless 1 Đêm đầy đủ (21.600 tick) phải xong trong `<= 30s`; bản 3D đạt `>= 30 FPS` trung bình ở `1280×720`.
- Lỗi định dạng inputs/scenario thoát mã `2` + `stderr`. Tất định SHA-256 tuyệt đối giữa 2 lần chạy.

## Cổng chất lượng
- Không báo xong khi `npm run verify` chưa trả mã `0`.
- Không sửa tay bằng chứng, không viết test luôn đạt. Khi thay đổi luật ở phase sau, cập nhật file này và ghi lý do sửa test cũ.

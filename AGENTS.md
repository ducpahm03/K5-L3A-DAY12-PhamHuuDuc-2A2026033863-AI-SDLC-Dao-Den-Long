# AGENTS.md — Đảo Đèn Lồng (Phase 1 · Contract v1.0)

## Lệnh cốt lõi
- Cài đặt: `npm ci`
- Build (3D web + headless CLI): `npm run build`
- Chạy game 3D: `npm run start` (hoặc `npm run dev`)
- Chạy headless: `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out tmp.jsonl`
- Kiểm chứng toàn bộ (bắt buộc xanh trước khi kết thúc/commit): `npm run verify`

## Kiến trúc bắt buộc
- `src/core/` là **lõi mô phỏng thuần TypeScript**: tuyệt đối KHÔNG import `three`, `window`, `document`, `fs`, hay `Math.random()`.
- Mọi tính ngẫu nhiên bắt buộc đi qua `src/core/rng.ts` (`Mulberry32`) khởi tạo từ `--seed`.
- `src/core/tuning.ts` là nguồn chân lý duy nhất; mọi thay đổi số phải đồng bộ với `game.contract.json` (`npm run sync-check` kiểm tra tự động).
- `src/game/` chứa đồ họa 3D, VFX, âm thanh WebAudio, HUD và sáng tạo thẩm mỹ. Không đặt luật chơi ảnh hưởng điểm/vị trí/sự kiện vào `src/game/`.

## Bất biến Test Contract v1.0
- Bước cố định 60 tick/s (`1/60s`). Snapshot tick `0` sau khi dựng scenario, trước input. Bước `k` (`0..N-1`) tạo trạng thái & sự kiện `tick = k + 1`.
- Khoảng cách đo trên mặt phẳng ngang XZ giữa các điểm chuẩn (`<= r`), không cộng bán kính nhân vật. Làm tròn tọa độ và `time_left_s` 3 chữ số thập phân (không có `-0`).
- Chuyển động `move [x,z]` quay theo `cam_yaw_deg`: `x' = x*cosθ + z*sinθ`, `z' = -x*sinθ + z*cosθ`, chuẩn hóa nếu độ dài > 1.
- Các nút `jump`, `interact`, `pulse` kích hoạt trên cạnh lên (`false -> true`).
- Dựng scenario KHÔNG phát sự kiện, KHÔNG cộng điểm. File inputs/scenario sai định dạng thoát mã `2` kèm thông báo ra `stderr`.
- Cùng `--seed`, `--scenario`, `--inputs` phải ra file JSONL giống hệt nhau từng byte.

## Quy trình kiểm chứng & cổng chất lượng
- Không bao giờ báo xong khi `npm run verify` chưa trả mã thoát `0`.
- Không sửa tay bằng chứng, không viết test luôn đạt.
- Khi có yêu cầu mới ở phase sau, cập nhật file này + `.agents/skills/verify-phase/SKILL.md` và ghi rõ lý do nếu đổi test cũ.

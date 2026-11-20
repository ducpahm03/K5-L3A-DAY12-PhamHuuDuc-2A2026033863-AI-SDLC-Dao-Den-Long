# Đánh Giá Phase 1 (Evaluation)

## 1. Mức độ đạt yêu cầu PRD-0 & Test Contract v1.0
- **Đạt đầy đủ (12/12 tiêu chí nghiệm thu AC-01 → AC-12):**
  - Chơi trọn vẹn Đêm 1 – Đảo Bến từ màn hình tiêu đề tới thắng/thua và chơi lại mượt mà.
  - Đúng chuẩn Test Contract v1.0: `game.contract.json`, CLI `dist/headless.mjs` 60 tick/s không cần GPU, đủ mọi trường JSONL (`snapshot`, `event`, `end`), mã thoát `2` cho inputs/scenario lỗi, tất định 100% qua 2 lần chạy (SHA-256 trùng khớp).
  - Đồ họa 3D cổ tích + âm thanh WebAudio procedural chạy ổn định trên trình duyệt, `0` console error.

## 2. Điểm mạnh kiến trúc cho các phase tiếp theo
- Tách tuyệt đối `src/core/` khỏi `src/game/` giúp nâng cấp lên Contract v1.1+ (nhiều đêm/đảo, `dash`, `pause`, thêm loại thực thể, số chuẩn mới) tập trung tại `src/core/` và cập nhật lớp hiển thị tương ứng mà không phải viết lại kiến trúc.
- Script `sync-check.mjs` + `verify-all.mjs` + GitHub Actions CI + `.githooks/pre-commit` đảm bảo không thể vô tình làm lệch `game.contract.json` hoặc quên chạy kiểm chứng.

## 3. Hạn chế trung thực & hướng cải thiện ở Phase 2
- Ảnh `01-title.png` và `02-gameplay.png` được chụp trước bản vá bỏ font `Georgia` nên chữ tiêu đề trong ảnh chụp trước có khoảng hở nhẹ ở dấu tiếng Việt; mã nguồn đã được vá sạch (`src/game/styles.css`) và build lại xanh, sẽ cập nhật bộ ảnh chụp mới ở bước kiểm chứng Phase 2.
- Chưa có màn hình đo FPS hiển thị trực tiếp và chưa hỗ trợ nhiều đêm/hòn đảo (thuộc phạm vi Phase 2).
## 4. Kết Quả Review Độc Lập (Independent Reviewer Subagent)
- **Người đánh giá:** Subagent reviewer tách biệt (`research`, read-only, không viết mã nguồn).
- **Phán quyết:** **APPROVE** — xác nhận khớp 100% `game.contract.json` ↔ `src/core/tuning.ts`, đúng mô hình tick, khoảng cách XZ, công thức quay `cam_yaw_deg`, rising-edge input, scenario setup 0 sự kiện/0 điểm, mã thoát `2`, tách lớp thuần TS trong `src/core/`, và đối chiếu lại toàn bộ số liệu JSONL + SHA-256 trong `docs/proof/phase-1/`.
- **Góp ý biên được xử lý ngay:** Đảm bảo thứ tự `clampToIsland` trước `pushOutOfSafeZones` cuối vòng lặp Bóng Mực để bất biến `dist >= safe_radius` luôn giữ nguyên ngay cả khi scenario tùy biến đặt đèn đã thắp sát mép đảo (`r > 29m`).


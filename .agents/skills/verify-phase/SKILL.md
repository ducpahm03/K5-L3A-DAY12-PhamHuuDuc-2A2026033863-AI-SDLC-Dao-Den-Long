---
name: verify-phase
description: Quy trình chuẩn chạy kiểm chứng, kiểm tra Test Contract, tính tất định và xuất bằng chứng thật cho mỗi phase của Đảo Đèn Lồng.
---

# Skill: Verify Phase & Capture Proof

Dùng skill này ở cuối mỗi giai đoạn code và trước khi gắn tag `phase-N`.

## Bước 1 — Kiểm tra đồng bộ & build
1. Chạy `npm run typecheck` để đảm bảo không lỗi kiểu TypeScript.
2. Chạy `npm run build` để biên dịch cả bản web 3D (`dist/web`) và CLI headless (`dist/headless.mjs`).
3. Chạy `npm run sync-check` để xác minh `game.contract.json` khớp chính xác 100% với `src/core/tuning.ts`.

## Bước 2 — Chạy bộ test & tính tất định
1. Chạy `npm run verify`:
   - Thực thi toàn bộ unit test + integration test trên `dist/headless.mjs`.
   - Kiểm tra lỗi định dạng inputs/scenario trả đúng mã thoát `2`.
   - Chạy cùng 1 seed/scenario/inputs 2 lần liên tiếp và so khớp SHA-256 của 2 file JSONL đầu ra.
2. Nếu bất kỳ mục nào thất bại → **DỪNG**, sửa mã nguồn hoặc ghi nhận trung thực, tuyệt đối không tắt test âm thầm.

## Bước 3 — Xuất bằng chứng thật vào `docs/proof/phase-N/`
1. Lưu mẫu output JSONL thật từ các scenario cốt lõi (win, lose by shades, lose by dawn, pulse & stun, determinism hash).
2. Khởi chạy bản web tĩnh `dist/web`, mở bằng trình duyệt thật (Playwright), kiểm tra `console.error` bằng 0 và chụp ảnh màn hình thật (title, gameplay, lit lantern, pulse VFX).
3. Cập nhật bảng truy vết yêu cầu → lệnh chạy → file bằng chứng → kết quả trong `docs/proof/phase-N/PROOF.md`.

## Bước 4 — Review độc lập
- Dùng 1 phiên/subagent reviewer tách biệt đọc lại diff, `game.contract.json`, và `PROOF.md` đối chiếu trực tiếp với PRD/Ticket và `RUBRIC.md` trước khi chốt tag.

---
name: verify-phase
description: Quy trình chuẩn chạy kiểm chứng, kiểm tra Test Contract (v1.0/v1.1+), tính tất định, hiệu năng headless/FPS và xuất bằng chứng thật cho mỗi phase của Đảo Đèn Lồng.
---

# Skill: Verify Phase & Capture Proof (Updated for Phase 2 · Contract v1.1)

Dùng skill này ở cuối mỗi giai đoạn code và trước khi gắn tag `phase-N`.

## Bước 1 — Kiểm tra đồng bộ & build
1. `npm run sync-check`: xác minh `game.contract.json` khớp 100% `src/core/tuning.ts`.
2. `npm run typecheck`: `tsc --noEmit` đạt 0 lỗi.
3. `npm run build`: build `dist/web` (Three.js) và `dist/headless.mjs` (Node CLI).

## Bước 2 — Chạy bộ test, regression, tất định & hiệu năng headless
1. Chạy `npm run verify`:
   - Toàn bộ unit test + contract test (kể cả regression Phase 1 với số chuẩn và ít nhất 1 scenario headless cho mỗi tính năng mới Phase 2: 3 Đêm, Lướt, Rơi khỏi đảo, Bục nhảy, Gió mạnh, Gió Lạc, Bùa Gió, Tạm dừng).
   - Kiểm tra lỗi định dạng inputs/scenario thoát đúng mã `2`.
   - Kiểm tra tính tất định 2 lần chạy so khớp SHA-256.
   - Đo thời gian chạy đầy đủ Đêm 3 (21.600 tick) phải đạt `<= 30 giây`.
2. Nếu bất kỳ mục nào đỏ → **DỪNG**, sửa gốc rễ, không tắt test âm thầm.

## Bước 3 — Xuất bằng chứng thật & đo FPS 1280×720 vào `docs/proof/phase-N/`
1. Chạy `node scripts/generate-proof.mjs` để lưu JSONL thật, hash tất định và kết quả benchmark 21.600 tick.
2. Mở bản `dist/web` bằng Playwright ở kích thước `1280×720`, kiểm tra `0` console error, đo FPS trung bình (`>= 30 FPS`), chụp ảnh các màn hình thật (Menu, Đêm 1/2/3, HUD, Pause/Settings).
3. Cập nhật bảng truy vết yêu cầu → bằng chứng trong `docs/proof/phase-N/PROOF.md`.

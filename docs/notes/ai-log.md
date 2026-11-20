# Nhật Ký Dùng AI & Quản Lý Token (AI Log)

## Phase 1 — PRD-0 & Test Contract v1.0

### 1. Quy trình phối hợp với AI
- Đọc toàn bộ tài liệu lab (`README.md`, `GUIDE.md`, `RUBRIC.md`, `RULES.md`, `SUBMISSION.md`) và `PRD-0` + `Test Contract v1.0`.
- Phỏng vấn thiết kế 5 nhánh (`/grill-me`) trước khi viết code để chốt kiến trúc, bộ `tuning`, phong cách mỹ thuật 3D, điều khiển và bộ harness.
- Viết trước `plan.md`, `AGENTS.md`, `.agents/skills/verify-phase/SKILL.md` và bảng giả định + tiêu chí nghiệm thu `docs/notes/phase-1-assumptions.md` trước khi sinh mã nguồn.
- Xây dựng theo mô-đun nhỏ: `src/core/` (lõi thuần TS) → `src/headless/` → bộ test & `verify-all.mjs` → `src/game/` (3D + WebAudio) → kiểm chứng thật bằng Playwright.

### 2. Các lỗi thực tế phát hiện trong quá trình kiểm chứng & cách khắc phục
| STT | Lỗi AI / vấn đề phát hiện | Cách phát hiện | Cách khắc phục & cập nhật harness |
|---|---|---|---|
| 1 | `GET /favicon.ico 404` gây 1–2 lỗi console khi mở bản web 3D | Mở bản build thật bằng Playwright và đọc `browser_console_messages` | Thêm inline SVG favicon đèn lồng trực tiếp vào `index.html` → console về `0 errors, 0 warnings`. |
| 2 | Cảnh báo Node `DEP0190` khi gọi `spawnSync(..., { shell: true })` trên Windows | Đọc log thực tế khi chạy `vitest run` | Chuyển sang gọi trực tiếp `cmd.exe /c` trên Windows trong `tests/contract.test.ts` và `scripts/verify-all.mjs`. |
| 3 | Font `Georgia` làm tách dấu tiếng Việt (`Đảo Đèn Lồ ng`, `Đảo Bế n`) trên Windows | Tự kiểm tra ảnh chụp thật `01-title.png`, `02-gameplay.png` | Đổi tiêu đề sang `'Segoe UI', system-ui, sans-serif` để dấu tiếng Việt hiển thị sắc nét. |
| 4 | Nhỡ thêm helper `triggerDemoPulse` trên `window` làm phá tính chỉ-đọc của production code | Tự rà soát diff `src/game/main.ts` | Gỡ bỏ ngay, chỉ giữ getter chỉ-đọc `getMode()` / `getSnapshot()`. |

### 3. Ước tính Token & Cách Tiết Kiệm (Phase 1)
- **Ước tính sử dụng Phase 1:** ~65.000 input tokens / ~18.000 output tokens (ước tính quy đổi ~$0.45–$0.70 theo đơn giá model cao cấp).
- **Cách đã tiết kiệm token:**
  - Chốt đầy đủ thiết kế & bộ thông số 1 lần qua 5 câu hỏi trước khi sinh code (không phải viết đi viết lại).
  - Giữ `AGENTS.md` ngắn gọn (~40 dòng) để giảm chi phí ngữ cảnh ở mọi lượt.
  - Chia mã nguồn thành các file nhỏ chuyên biệt (`< 260` dòng/file), sửa lỗi bằng `edit_file` cục bộ thay vì ghi lại toàn file.
  - Tách hoàn toàn `src/core/` khỏi `src/game/` giúp chạy unit/contract test trong `< 1.5s`, phát hiện lỗi sớm mà không cần gọi AI gỡ rối nhiều vòng.

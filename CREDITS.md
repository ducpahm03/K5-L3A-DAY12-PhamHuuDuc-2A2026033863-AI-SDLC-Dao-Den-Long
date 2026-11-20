# Credits & Asset Attribution

Toàn bộ nhân vật, bối cảnh, hình học 3D, hiệu ứng ánh sáng và âm thanh trong **Đảo Đèn Lồng** đều được tạo hoàn toàn bằng mã nguồn (procedural) và bản gốc theo đề tài của lab, không dùng asset có bản quyền bên ngoài.

## Thư viện mã nguồn mở
- **Three.js** — MIT License (https://threejs.org/) — Kết xuất 3D WebGL
- **Vite** — MIT License (https://vite.dev/) — Công cụ đóng gói & preview web
- **esbuild** — MIT License (https://esbuild.github.io/) — Biên dịch CLI headless tốc độ cao
- **Vitest** — MIT License (https://vitest.dev/) — Kiểm thử đơn vị và tích hợp

## Tài nguyên tự tạo (Procedural)
- **Mô hình 3D** (`src/game/scene.ts`, `src/game/entities.ts`, `src/game/vfx.ts`): Tự dựng bằng hình học Three.js (Mây đội nón lá treo đèn, 5 Đèn Lồng Lớn, Đảo Bến giữa biển mây, Bóng Mực, đom đóm, luồng gió ánh sáng).
- **Âm thanh** (`src/game/audio.ts`): Tổng hợp thời gian thực bằng Web Audio API (thang âm ngũ cung + hiệu ứng chuông gió, bừng sáng, sóng xung kích).

## Công cụ AI hỗ trợ phát triển
- Được phát triển với hỗ trợ lập kế hoạch, viết mã và kiểm chứng bởi AI coding assistant theo quy trình SDLC (xem chi tiết tại `docs/notes/ai-log.md`).

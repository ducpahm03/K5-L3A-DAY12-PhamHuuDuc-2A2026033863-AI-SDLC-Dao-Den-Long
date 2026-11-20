# Bằng Chứng Kiểm Chứng — Phase 3 (`phase-3` · Contract v1.2 · Đèn Cạn Dầu)

> Sinh trực tiếp từ mã nguồn tại tag `phase-3`. Lệnh tái lập: `npm run verify` và `node scripts/generate-proof.mjs`.
> Ghi chú thiết kế (ADR): [docs/notes/adr-001-phase3-lamp-fuel.md](../../notes/adr-001-phase3-lamp-fuel.md) · Changelog: [CHANGELOG.md](../../../CHANGELOG.md).

## 1. Bảng Truy Vết Yêu Cầu Ticket-03 → Bằng Chứng

| Mã | Yêu cầu (Ticket-03 / Contract v1.2) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P3-01 | Nhiên liệu đèn `0..100` (tính đơn vị nguyên `1/60`), hao `1/s`, hết dầu tắt `lantern_out`, nhớ `ever_lit`, thắp lại tốn `5` (`relight: true`), châm dầu `refuel` | Unit + Contract CLI test | `tests/unit/simulation.test.ts` + [fuel_lifecycle.jsonl](fuel_lifecycle.jsonl) | **Đạt** |
| P3-02 | Đèn `fuel < 30` mất vùng an toàn; Bóng Mực `wander` chọn đèn yếu và `drain` ở `<= 2m` (`5 fuel/s`, phát `fuel_drain` mỗi 60 tick); châm dầu lên `>= 30` đẩy Bóng Mực ra mép `6m` | Unit + Contract CLI test | `simulation.test.ts` + [fuel_lifecycle.jsonl](fuel_lifecycle.jsonl) | **Đạt** |
| P3-03 | Luật thắng mới `dawn_survived` (`>= ceil(0.6 × tổng đèn)` lúc hết giờ; bỏ thắng sớm `all_lit`; thời lượng `240/270/300s`) | Unit + Contract CLI test | `simulation.test.ts` + [fuel_lifecycle.jsonl](fuel_lifecycle.jsonl) | **Đạt** |
| P3-04 | Sức chứa tăng dần `capacity = min(20, 10 + 2 × successful_lights)` | Unit test | `simulation.test.ts` (`capacity` tăng `10 → 12 → 14`) | **Đạt** |
| P3-05 | Công thức điểm mới (`+5` nạp, `+100` thắp đầu, `+40` thắp lại, `+5/+15` pulse, bình minh `+50+floor(fuel)` mỗi đèn & `+50` mỗi lửa) | Unit test | `simulation.test.ts` (kiểm tra điểm chính xác ở mọi bước) | **Đạt** |
| P3-06 | Chế độ mù màu ("Bảng màu dễ phân biệt": Bóng Mực `#00B3FF`, Cảnh báo `⚠ #FFFFFF`) & Đèn tắt xẹp 20% + vết rách, đèn `fuel < 30` nhấp nháy 1 Hz | Kiểm tra mã `src/game/entities.ts`, `hud.ts`, `styles.css` & build `dist/web` | Build `dist/web` thành công, có checkbox lưu `localStorage` | **Đạt** |
| P3-07 | Có ADR, Changelog breaking changes, test cũ được cập nhật kèm lý do rõ ràng, regression Phase 1–2 xanh | Kiểm tra repo + `npm run verify` | [adr-001-phase3-lamp-fuel.md](../../notes/adr-001-phase3-lamp-fuel.md), [CHANGELOG.md](../../../CHANGELOG.md), [determinism.txt](determinism.txt) | **Đạt** |

# Đánh Giá Phase 3 (Evaluation — Ticket-03 · Contract v1.2)

## 1. Xử lý Change Request (Breaking Changes)
- Viết trước quyết định kiến trúc [ADR-001](adr-001-phase3-lamp-fuel.md) và [CHANGELOG.md](../../CHANGELOG.md) liệt kê đầy đủ các luật Phase 1–2 bị thay thế.
- Sử dụng biểu diễn nguyên `fuelUnits` (`100 fuel = 6000 units`, `1/60` mỗi đơn vị) để tránh hoàn toàn sai số dấu phẩy động khi trừ hao `1/60` và hút dầu `5/60` mỗi tick.
- Cập nhật 2 test cũ bị luật mới thay thế ngay trong `tests/unit/simulation.test.ts` kèm chú thích lý do chi tiết (không dùng `.skip`), đồng thời giữ toàn bộ regression Phase 1–2 còn hiệu lực xanh 100%.

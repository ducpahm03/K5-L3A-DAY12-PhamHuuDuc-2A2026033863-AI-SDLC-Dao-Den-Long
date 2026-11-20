# Changelog — Đảo Đèn Lồng

Mọi thay đổi qua các phase của buổi lab AI SDLC được ghi nhận tại đây, bao gồm các thay đổi phá vỡ tương thích (breaking changes).

## [Phase 3] — Ticket-03: "Đèn cạn dầu" (Contract v1.2)
### Breaking Changes (Thay thế luật Phase 1–2)
- **[BREAKING] Mô hình nhiên liệu đèn (`fuel`):** Đèn đã sáng không còn sáng vĩnh viễn; khi vừa thắp có `fuel = 100`, tự hao `1.0 fuel/s` (`1/60` mỗi tick). Khi `fuel <= 0`, đèn tắt (`deposited = 0`, `ever_lit = true`) và phát sự kiện `lantern_out`.
- **[BREAKING] Chi phí thắp lại & châm dầu:** Đèn đã từng sáng (`ever_lit: true`) chỉ cần `5` đom đóm để thắp lại (`lantern_lit` kèm `relight: true`). Đèn đang sáng nhưng `fuel < 100` nhận tương tác châm dầu (`+10 fuel/đom đóm`, phát sự kiện `refuel`).
- **[BREAKING] Vùng an toàn & Bóng Mực hút dầu (`drain`):** Đèn có `fuel < 30` mất vùng an toàn `6m`. Bóng Mực đang `wander` ưu tiên đi tới đèn sáng có `fuel < 30` gần nhất và chuyển sang trạng thái `drain` khi cách `<= 2m` (hút `5 fuel/s`, phát `fuel_drain` mỗi 60 tick).
- **[BREAKING] Luật thắng mới (`dawn_survived`) & Thời lượng Đêm:** Bỏ thắng sớm `all_lit`. Thời lượng Đêm 1/2/3 đổi thành `240 / 270 / 300s`. Thắng khi sống sót tới hết giờ và số đèn đang sáng `>= ceil(0.6 × tổng đèn)` (`3/5`, `4/6`, `5/7`).
- **[BREAKING] Công thức điểm mới:** Nạp đom đóm `+5` (thay vì `+10`); thắp lần đầu `+100`; thắp lại `+40`; Tỏa Sáng trúng Bóng Mực `+5` (`+15` nếu đang `drain`); thưởng bình minh khi thắng: `+50 + floor(fuel)` mỗi đèn đang sáng và `+50` mỗi Ngọn Lửa còn lại (bỏ thưởng thời gian).

### Added
- Sức chứa đom đóm tăng dần: `capacity = min(20, 10 + 2 × successful_lights)`.
- Chế độ mù màu ("Bảng màu dễ phân biệt" lưu trong `localStorage`): đổi viền/mắt Bóng Mực sang `#00B3FF`, cảnh báo UI `#FFFFFF` kèm `⚠`; đèn tắt xẹp `20%` và có vết rách giấy, đèn `fuel < 30` nhấp nháy `1 Hz` kèm thanh dầu.
- Tài liệu quyết định thiết kế `docs/notes/adr-001-phase3-lamp-fuel.md`.

---

## [Phase 2] — Ticket-02: "Ba hòn đảo" (Contract v1.1)
### Changed
- Chuẩn hóa toàn bộ hằng số `tuning` và thứ tự 12 bước/tick theo đặc tả nhà sản xuất.
- Mở rộng Đảo Bến Đêm 1 lên bán kính `40m`, bật rơi khỏi đảo (`Y < -10`, chờ 60 tick hồi sinh).
- Chuẩn hóa 5 trạng thái Bóng Mực: `spawning`, `wander`, `chase`, `recoil`, `stunned`.

### Added
- Thêm **Đêm 2 — Đảo Cau** (2 đảo `R=28m`, cầu tre, 2 bục nhảy) và **Đêm 3 — Đảo Chuông** (3 tầng `Y=0/3/6`, 2 dốc nghiêng, bục nhảy, tháp chuông, gió mạnh).
- Thêm kỹ năng **Lướt (`dash`)**, kẻ địch **Gió Lạc (`drifters`)**, vật phẩm **Bùa Gió (`charms`)**, **Tạm dừng (`pause`)**, chuỗi 3 Đêm có lời Ông Đăng, cài đặt lưu `localStorage`, bảng màu chuẩn và mũi tên chỉ đèn ngoài màn hình.

---

## [Phase 1] — PRD-0: "Đảo Đèn Lồng" (Contract v1.0)
### Added
- Phiên bản đầu tiên của Đêm 1 — Đảo Bến (3D Three.js + WebAudio ngũ cung) và CLI headless 60 tick/s tất định theo Test Contract v1.0.
- Bộ harness AI (`AGENTS.md`, skill `verify-phase`, pre-commit hook, GitHub Actions CI) và bộ kiểm thử Vitest.

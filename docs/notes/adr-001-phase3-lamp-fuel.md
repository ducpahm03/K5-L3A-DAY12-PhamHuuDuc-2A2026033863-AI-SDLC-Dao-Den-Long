# ADR-001: Chuyển Đổi Mô Hình Nhiên Liệu Đèn, Bóng Mực Hút Dầu & Luật Thắng Bình Minh (Phase 3 · Contract v1.2)

- **Trạng thái:** Đã chấp nhận & triển khai (`phase-3`)
- **Ngày:** 2026-11-20
- **Bối cảnh:** Ticket-03 ("Đèn cạn dầu") thay thế 3 luật cốt lõi của Phase 1–2 để duy trì nhịp căng thẳng đến cuối Đêm:
  1. `[THAY THẾ]` Đèn đã sáng không còn sáng vĩnh viễn mà có nhiên liệu `fuel ∈ [0, 100]`, tự hao `1.0/s`, có thể châm thêm dầu (`refuel`) hoặc tắt khi hết dầu (`lantern_out`), thắp lại đèn đã từng sáng (`ever_lit`) chỉ tốn `5` đom đóm.
  2. `[THAY THẾ]` Đèn sáng có `fuel < 30` mất vùng an toàn `6m`; Bóng Mực ở trạng thái `wander` chủ động tìm đèn yếu (`fuel < 30`) và đứng hút dầu ở khoảng cách `<= 2m` (`state = "drain"`, hút `5 fuel/s`, phát `fuel_drain` mỗi 60 tick).
  3. `[THAY THẾ]` Bỏ thắng sớm `all_lit`; thắng khi sống sót tới hết giờ (`time_left_s == 0`) với số đèn đang sáng `>= ceil(0.6 × tổng đèn)` (`reason: "dawn_survived"`). Thay toàn bộ công thức tính điểm và bổ sung sức chứa tăng dần `10 + 2 × successful_lights` (tối đa `20`).

## Quyết Định Thiết Kế

1. **Biểu diễn nhiên liệu bằng số nguyên `1/60` (`fuelUnits`):**
   - Lưu `fuelUnits` nguyên trong khoảng `[0, 6000]` (`100.0 fuel = 6000 units`).
   - Mỗi tick đèn đang sáng: `fuelUnits -= 1` (hao tự nhiên) và `fuelUnits -= 5` cho mỗi Bóng Mực đang `drain` đèn đó.
   - Mỗi đom đóm châm dầu cộng `600` units (`10 fuel`). Số đom đóm cần châm tính bằng phép chia nguyên `Math.ceil((6000 - fuelUnits) / 600)`.
   - **Lý do:** Triệt tiêu hoàn toàn sai số dấu phẩy động IEEE-754 qua 18.000+ tick, đảm bảo tính tất định tuyệt đối giữa mọi máy chấm; chỉ làm tròn 1 chữ số thập phân (`Math.round((fuelUnits / 60) * 10) / 10`) khi xuất JSONL.

2. **Máy trạng thái Bóng Mực mở rộng (`spawning | wander | chase | recoil | stunned | drain`):**
   - Trong bước 2, trừ dầu trước và kiểm tra tắt đèn (`fuelUnits <= 0` → `lantern_out`) ngay sau bước 2 theo đúng đặc tả Ticket-03.
   - Khi đèn tắt hoặc được châm dầu lên `>= 30` (`fuelUnits >= 1800`), mọi Bóng Mực đang `drain` đèn đó lập tức chuyển về `wander`; nếu đèn đạt `fuel >= 30`, kích hoạt cơ chế đẩy Bóng Mực trong `6m` ra mép trong tối đa 30 tick (tái sử dụng `safePushTicks` của Phase 2).
   - Lưu cờ `wasDraining` hoặc kiểm tra `shade.state === 'drain'` ngay tại bước 7 (`pulse`) để cộng đúng `+15` điểm (thay vì `+5`) khi Tỏa Sáng trúng Bóng Mực đang hút dầu.

3. **Danh sách Test Cũ Bị Luật Mới Thay Thế & Cách Cập Nhật (Không Skip Âm Thầm):**
   - **Test cũ 1 (`tests/unit/simulation.test.ts` — "pickup, deposit scoring, win bonus on 5th lit"):**
     - *Lý do sai dưới luật mới:* Thắp đủ 5 đèn không còn kết thúc Đêm ngay (`all_lit` bị bỏ), điểm nạp đom đóm đổi từ `+10` sang `+5`.
     - *Cập nhật:* Đổi thành kiểm chứng thắp đèn lần đầu (`+5/mote`, `+100/lantern`, `fuel = 100`, `capacity` tăng từ `10 → 12`), hết dầu tắt đèn (`lantern_out`), thắp lại với `relight_cost = 5` (`relight: true`, `+40` điểm), và thắng ở tick bình minh với `reason: "dawn_survived"`.
   - **Test cũ 2 (`tests/unit/simulation.test.ts` — "enforces safe_radius around lit lanterns"):**
     - *Lý do mở rộng:* Đèn có `fuel >= 30` vẫn giữ vùng an toàn `6m`, nhưng đèn có `fuel < 30` mất vùng an toàn và bị Bóng Mực `wander` vào hút dầu (`drain`).
     - *Cập nhật:* Giữ kiểm tra chặn ở `6m` khi `fuel >= 30`, và thêm kiểm tra khi `fuel < 30` Bóng Mực tiến vào `<= 2m`, chuyển sang `drain`, hút `5 fuel/s` và phát `fuel_drain` ở tick thứ 60.

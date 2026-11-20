# Phase 2 Spec & Acceptance Criteria — Ticket-02 ("Ba hòn đảo" · Contract v1.1)

> Lập trước khi viết mã Phase 2. Chuẩn hóa số liệu Phase 1 và mở rộng thành 3 Đêm cùng các tính năng mới.

## 1. Thay đổi so với giả định Phase 1
- Đồng bộ toàn bộ thông số sang **Số liệu chuẩn Phần 1** (`carry_capacity: 10`, `lantern_cost: 10`, `pickup_radius: 1.0`, `interact_radius: 2.0`, `pulse: 3/5m/3s` đo 3D từ `chân + 0.8m`, `fall_enabled: true` rơi `Y < -10`, điểm tính lúc **nạp** `+10/mote`, `+100/lantern`, `+5/pulse`, thưởng thắng `floor(s)*2 + 50*flames`).
- Đảo Bến Đêm 1 nâng bán kính từ `35m` → `40m`, tọa độ 5 đèn cập nhật chính xác theo Phần 2, bỏ rào chắn mềm (rơi khỏi mép đảo xuống `Y < -10` sẽ mất 1 Ngọn Lửa + toàn bộ đom đóm, chờ 60 tick hồi sinh).
- Chuẩn hóa 5 trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`) và thứ tự **12 bước/tick** bắt buộc.

## 2. Acceptance Criteria — Phần 3 (Tính năng mới) & DoD

| Mã | Mục Ticket-02 | Tiêu chí nghiệm thu ("Làm A thì thấy B") | Cách kiểm chứng |
|---|---|---|---|
| P2-01 | Số liệu chuẩn & 12 bước/tick | `game.contract.json` v1.1 khớp 100% `src/core/tuning.ts`; điểm cộng khi nạp, rơi `Y<-10` phát `player_hit {by:"fall", lost}`, 5 trạng thái Bóng Mực chuẩn | `sync-check` + Unit & Headless regression |
| P2-02 | Lướt (`dash`) | Nhấn `dash` chạy `14 m/s` trong `12 tick`, hồi `90 tick` từ lúc bắt đầu, giữ nguyên Y khi lướt trên không, phát `dash {}`, không bất tử | Scenario `p2_dash` |
| P2-03 | Rơi khỏi đảo & hồi sinh | Bước ra khỏi đảo rơi `Y < -10` → mất 1 Ngọn Lửa, mất toàn bộ đom đóm (`lost`), chờ 60 tick không nhặt/bị chạm → hồi sinh ở spawn, `invuln = 90` | Scenario `p2_fall_respawn` |
| P2-04 | Đêm 2 — Đảo Cau & Bục nhảy | 2 đảo `R=28m` tại `(0,0,0)` & `(70,0,0)` + cầu tre `x∈[26,44], z∈[-2,2]`; chạm bục `(20,0,18)` bắn `vy=14, vh=24` sang đảo B đáp an toàn | Scenario `p2_night2_jumppad` |
| P2-05 | Đêm 3 — Đảo Chuông, 3 tầng, Dốc, Tháp & Gió | 3 tầng `Y=0/3/6`, 2 dốc `30°/150°` leo được lên tầng 1, bục `(0,3,13)` phóng lên tầng 2, tháp chuông `R=2` chặn đi xuyên, gió thổi `2 m/s` trong `5s` mỗi `30s` | Scenario `p2_night3_tiers_wind` |
| P2-06 | Gió Lạc (`drifters` D1..D2) | Sinh ở Đêm 2/3 lúc tick 1200, 2400; `idle → chase` khi Mây mang `>= 5` và cách `<= 15m`; chạm `<= 1.2m` cướp `min(3, carried)` (`drifter_steal`) rồi `flee`; trúng `pulse` khi `flee` nhả toàn bộ (`drifter_drop`) | Scenario `p2_drifter_steal_drop` |
| P2-07 | Bùa Gió (`charms` C1..C2) | Nhặt phát `charm_picked {charm_id, charm_ticks: 600}`; tốc độ tăng `7.2 m/s`, Lướt không hồi chiêu trong 600 tick; hồi sinh sau 2700 tick | Scenario `p2_charm_wind` |
| P2-08 | Tạm dừng (`pause`) | Kích `pause` → phát `paused {}`, `state="paused"`, `tick` tăng nhưng `sim_tick`/thời gian/timers đứng yên; kích lại → `resumed {}`, chạy tiếp | Scenario `p2_pause_resume` |
| P2-09 | Chuỗi 3 Đêm & Cài đặt lưu trữ | Menu chính → Giới thiệu Đêm (lời Ông Đăng) → Chơi Đêm 1→2→3 → Màn Bình Minh tổng điểm; Pause (`Esc/P`) có Tiếp tục/Chơi lại/Cài đặt/Menu; âm lượng & độ nhạy lưu `localStorage` | Kiểm tra trực tiếp trên Playwright 1280×720 |
| P2-10 | Bảng màu chuẩn, HUD đầy đủ & Âm thanh | Màu 3D/HUD đúng bảng hex Ticket-02 (sai lệch ≤ 10% RGB); ambient `0.15 + 0.55*(lit/total)`; HUD đủ 10 ô đom đóm, đồng hồ đỏ nhấp nháy `<= 30s`, hồi chiêu Dash/Pulse, nhắc `E — Nạp ánh sáng (x/10)`, mũi tên chỉ đèn ngoài màn hình; đủ SFX kể cả đếm ngược 10s & shade spawn | Ảnh chụp 1280×720 + kiểm tra mã màu |
| P2-11 | Hiệu năng Headless & FPS 3D | Headless Đêm 3 (21.600 tick) xong trong `<= 30s`; bản 3D đạt `>= 30 FPS` trung bình ở `1280×720` | Benchmark `verify-all.mjs` + Playwright FPS |

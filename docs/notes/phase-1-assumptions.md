# Phase 1 — Yêu Cầu, Giả Định & Kế Hoạch Kiểm Chứng (PRD-0 · Contract v1.0)

> Lập trước khi viết mã nguồn theo quy trình SDLC (GUIDE.md mục 3).

## 1. Phân tách Yêu cầu Bắt buộc vs Chỗ Mơ hồ

### Bắt buộc chính xác (không được sai lệch)
- **Màn chơi:** `Đêm 1 – Đảo Bến`, đảo tròn có **5 Đèn Lồng Lớn** (`L1`..`L5`).
- **Nhân vật & cơ chế:** Mây (đội nón lá treo đèn lồng nhỏ) đi lại, nhảy, camera 3D; nhặt đom đóm; nạp ánh sáng thắp đèn; Bóng Mực đuổi theo & chạm gây mất máu; Tỏa sáng (`pulse`) xua/choáng Bóng Mực tốn ánh sáng; Bóng Mực sợ đèn; thắng/thua/điểm số/HUD/chơi lại.
- **Test Contract v1.0:**
  - `game.contract.json` ở gốc repo khớp chính xác thông số game.
  - Headless 60 tick/s cố định, không cần GPU/cửa sổ, chạy được trên macOS/Linux.
  - CLI `--seed`, `--night 1`, `[--scenario]`, `[--inputs]`, `--ticks`, `--out`, `[--snapshot-every]`; lỗi định dạng inputs/scenario trả exit code `2`.
  - Mô hình tick, quy ước tọa độ XZ, chuyển đổi `cam_yaw_deg`, rising-edge input, JSONL `snapshot`/`event`/`end`, tất định byte-for-byte.

### Chỗ PRD-0 cố ý để mở & Giả định của tôi
| Hạng mục mơ hồ | Giả định đã chốt | Lý do |
|---|---|---|
| Kích thước Đảo Bến & luật rơi khỏi đảo | Đảo tròn bán kính `35m`, tâm `(0,0,0)`, mặt đất `Y=0`. Rào đá/biển mây mềm giữ nhân vật trong đảo (`fall_enabled: false`) | Tường minh, khớp mặc định contract, tránh rơi ngoài ý muốn khi test di chuyển tự động |
| Vị trí 5 Đèn Lồng Lớn | `L1`..`L5` xếp đều ngũ giác đều trên vòng tròn `R=22m` quanh tâm đảo (`L1` tại `[0, 0, 22]`) | Cân xứng, dễ định hướng và quay quét 3D |
| Tốc độ & sức chứa | `player_speed: 6 m/s`, `carry_capacity: 5`, `lantern_cost: 3`, `pickup_radius: 1.5 m`, `interact_radius: 2.5 m` | Cần 15 đom đóm để thắp 5 đèn; 3–4 chuyến gom rất vừa nhịp chơi 3 phút |
| Luật nhảy | `jump_vel: 7.5 m/s`, `gravity: -20 m/s²`, chỉ nhảy khi đang chạm đất (`y <= 0`) | Gọn, tất định, cảm giác nhảy nhẹ nhàng cổ tích |
| Thời lượng & Máu | `night1_duration_s: 180 s`, `flames: 3`, `invuln_s: 1.5 s`, `hit_drop_ratio: 0.5` (rơi `floor(carried * 0.5)`) | Cân bằng căng thẳng vừa phải; bất tử 1.5s chống mất 3 máu trong 3 tick liên tiếp |
| Tỏa sáng (`pulse`) | `pulse_cost: 1`, `pulse_radius: 7 m`, `pulse_push_m: 4 m`, `pulse_stun_s: 3 s`, `pulse_cooldown_s: 2 s` | Có chi phí rõ ràng (tốn 1 đom đóm), đủ lực đẩy/choáng tạo không gian thoát |
| Bóng Mực & `safe_radius` | `shade_speed: 3.6 m/s`, `shade_hit_radius: 1.2 m`, `safe_radius: 6 m` áp dụng cho **đèn đã thắp (`lit: true`)**; tâm Bóng Mực ở `Y = 1.0`. Khi `random_shades: true`, tối đa 4 con sinh cách nhau theo chu kỳ tất định | Tạo giá trị chiến thuật cho việc thắp đèn (mở vùng an toàn) đúng tinh thần PRD-0 |
| Sinh đom đóm tự động | Khi `random_motes: true`, ban đầu có 20 đom đóm rải đều trên đảo (tránh ngay chân người chơi), bổ sung định kỳ nếu còn dưới 18 con | Đảm bảo luôn đủ đom đóm hoàn thành màn mà không làm nghẽn đảo |
| Quy tắc cộng điểm | `per_mote: 10`, `per_lantern: 200`, `per_stun: 25`, thưởng thắng: `floor(time_left_s) * 5 + flames * 100` | Rõ ràng, tất định hoàn toàn theo số nguyên |
| Nạp đèn (`interact`) | Một lần nhấn `interact` nạp `min(carried, lantern_cost - deposited)` vào đèn chưa thắp gần nhất trong `interact_radius` | Tự nhiên, ít thao tác thừa |

## 2. Tiêu Chí Nghiệm Thu & Kế Hoạch Kiểm Chứng (Trước Khi Code)

| Mã | Yêu cầu kiểm chứng ("Làm A thì thấy B") | Cách kiểm chứng |
|---|---|---|
| AC-01 | `game.contract.json` khớp 100% hằng số trong mã nguồn | `npm run sync-check` |
| AC-02 | Chạy `move [0,1]` với `cam_yaw_deg = 0` và `90` trong 60 tick → dịch chuyển đúng `6.000m` theo công thức quay | Unit test + Headless scenario `move_yaw` |
| AC-03 | Đi qua đom đóm trong `<= 1.5m` → tự nhặt (`mote_picked`), không vượt `carry_capacity = 5`, cộng `10` điểm/con | Unit test + Headless scenario `pickup_deposit_win` |
| AC-04 | Đứng trong `<= 2.5m` đèn chưa thắp, kích `interact` (`false -> true`) → phát `deposit`, đủ 3 phát `lantern_lit`, đủ 5 đèn phát `game_over {won, all_lit}` + cộng thưởng | Headless scenario `pickup_deposit_win` |
| AC-05 | Bóng Mực đuổi đến `<= 1.2m` → phát `player_hit {by: "shade"}`, mất 1 máu, rơi `floor(carried * 0.5)`, bất tử 1.5s; hết máu → `game_over {lost, no_flames}` | Headless scenario `shade_hit_loss` |
| AC-06 | Kích `pulse` khi có `>= 1` đom đóm & hết cooldown → tốn 1 đom đóm, Bóng Mực trong `<= 7m` bị đẩy `4m`, chuyển `stunned` 3s, phát `pulse {stunned_ids}`, cộng `25` điểm/con | Headless scenario `pulse_stun_push` |
| AC-07 | Bóng Mực không đi vào trong bán kính `6m` quanh đèn đã thắp (`lit: true`) | Headless scenario `safe_zone` |
| AC-08 | Hết `time_left_s` trước khi thắp đủ 5 đèn → `game_over {lost, dawn}` | Headless scenario `dawn_loss` |
| AC-09 | File inputs/scenario lỗi (JSON hỏng, tick không tăng nghiêm ngặt, move ngoài `[-1,1]`) → thoát mã `2` + lỗi `stderr` | Contract CLI test |
| AC-10 | Chạy cùng `--seed`, `--scenario`, `--inputs` 2 lần liên tiếp → 2 file JSONL có SHA-256 giống hệt nhau | Determinism check trong `npm run verify` |
| AC-11 | Bản 3D mở được trên trình duyệt, không lỗi console, hiển thị Mây (nón lá treo đèn), 5 Đèn Lớn, đom đóm, Bóng Mực, HUD, thắng/thua/chơi lại | Chụp ảnh thực tế bằng Playwright trong `docs/proof/phase-1/` |

# Đánh Giá Phase 2 (Evaluation — Ticket-02 · Contract v1.1)

## 1. Kết quả đạt được
- Đồng bộ toàn bộ số liệu chuẩn Phần 1 vào `src/core/tuning.ts` và `game.contract.json` (`contract_version: "1.1"`).
- Cài đặt chính xác thứ tự **12 bước/tick**, 3 bản đồ chuẩn (`src/core/maps.ts`: Đảo Bến `R=40m`, Đảo Cau 2 đảo + cầu tre + 2 bục nhảy, Đảo Chuông 3 tầng + 2 dốc + bục nhảy + tháp chuông + gió mạnh), Lướt (`dash`), Gió Lạc (`drifters`), Bùa Gió (`charms`), Tạm dừng (`pause`) và rơi khỏi đảo (`Y < -10`).
- Toàn bộ 16/16 test đơn vị & tích hợp xanh; chạy headless 21.600 tick của Đêm 3 mất **142.7 ms** (ngưỡng ≤ 30 giây), tất định SHA-256 tuyệt đối.
- Cập nhật `AGENTS.md` và `.agents/skills/verify-phase/SKILL.md` cho phạm vi Phase 2.

## 2. Phát hiện lỗi & điều chỉnh harness
- Khi thu hẹp kiểu `GameState` trong vòng lặp CLI (`src/headless/cli.ts`), TypeScript báo cảnh báo thu hẹp kiểu sau `sim.step(input)` → khắc phục bằng helper `isEnded()` rõ ràng.
- Tách `src/core/simulation.ts` thành 3 module gọn (`maps.ts`, `sim-movement.ts`, `sim-entities.ts`, `simulation.ts`) để dễ bảo trì và chuẩn bị cho Change Request ở Phase 3.

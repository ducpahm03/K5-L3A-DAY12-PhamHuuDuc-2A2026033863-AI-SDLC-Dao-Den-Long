# Kịch Bản Chi Tiết Quay Video Demo (< 5 Phút) — Đảo Đèn Lồng

**Học viên:** Phạm Hữu Đức (`2A2026033863`) · **Lớp:** K5-L3A  
**Mục tiêu:** Đạt trọn vẹn 5/5 điểm mục G (Rubric) — video `.mp4`, dưới 5 phút, minh chứng thực nghiệm rõ ràng, mạch lạc và thuyết phục.

---

## 1. Phân Bổ Thời Gian (Tổng cộng: ~4 phút 15 giây)

| Phần | Thời lượng | Nội dung chính |
|---|---|---|
| **P1. Giới thiệu & Tổng quan** | 0:00 – 0:30 (30s) | Giới thiệu họ tên, MSSV, kiến trúc tách biệt Simulation/Renderer và 4 phase đã hoàn thành |
| **P2. Gameplay 3D Thực tế** | 0:30 – 2:00 (90s) | Chơi trực tiếp: gom đom đóm, lướt (`dash`), châm dầu, Tỏa Sáng (`pulse`), né gió, bảng màu mù màu |
| **P3. Bằng chứng Kiểm chứng & Tất định** | 2:00 – 3:00 (60s) | Chạy lệnh `npm run verify` (11 test xanh, byte-for-byte determinism hash) |
| **P4. Đo Hiệu năng & Soak Test (Phase 4)** | 3:00 – 3:45 (45s) | Chạy 3D Benchmark (262.5 FPS) và Soak test 10 Đêm liên tục (0 crash, bộ nhớ ổn định) |
| **P5. Lịch sử Git & Harness AI** | 3:45 – 4:15 (30s) | Lướt qua 4 git tags (`phase-1` → `phase-4`), Release `v1.0.0`, `AGENTS.md` và file log |

---

## 2. Kịch Bản Lời Thoại & Thao Tác Chi Tiết

### Phần 1: Giới thiệu & Khởi động (0:00 – 0:30)
- **Màn hình:** Mở sẵn terminal và trình duyệt tại Menu game (`http://127.0.0.1:4173`).
- **Thao tác:** Bật cửa sổ game toàn màn hình hoặc 1280x720.
- **Lời thoại gợi ý:**
  > "Xin chào thầy và các bạn, em là Phạm Hữu Đức, MSSV 2A2026033863, lớp K5-L3A. Hôm nay em xin trình bày video nghiệm thu sản phẩm game 3D Đảo Đèn Lồng sau 4 phase SDLC.  
  > Dự án được xây dựng với kiến trúc tách biệt hoàn toàn giữa lõi mô phỏng tất định 60 tick/giây bằng TypeScript thuần và tầng trình diễn 3D bằng Three.js. Trò chơi đã hoàn thành trọn vẹn 4 phase theo Test Contract từ v1.0 đến v1.3."

---

### Phần 2: Trải nghiệm Gameplay 3D (0:30 – 2:00)
- **Màn hình:** Vào Đêm 1 hoặc Đêm 2 để thao tác.
- **Thao tác tuần tự:**
  1. **Di chuyển & Nhảy:** Chạy nhân vật Mây (6 m/s), nhảy lên bục đá (vận tốc 7 m/s).
  2. **Lướt (`Shift`):** Bấm Shift lướt nhanh 14 m/s để thấy vệt hạt ánh sáng.
  3. **Thu thập & Nạp đèn (`E`):** Gom đom đóm (tự hút khi ≤ 1.0m), tiến lại gần Đèn Lồng Lớn bấm `E` để thắp sáng và quan sát cột sáng cùng vòng an toàn 6m.
  4. **Cơ chế dầu đèn (Phase 3):** Chỉ vào thanh dầu trên đầu đèn, đợi Bóng Mực tới gần hút dầu hoặc bấm nạp bổ sung `+10 fuel/đom đóm`.
  5. **Tỏa Sáng (`F` / Chuột phải):** Khi Bóng Mực đuổi theo, bấm `F` kích hoạt sóng xung kích 5m, đẩy lùi 4m và làm choáng Bóng Mực.
  6. **Trợ năng & Bảng xếp hạng (Phase 4):** Bật menu Cài đặt, tick thử "Bảng màu dễ phân biệt" (mù màu) và "Cỡ chữ lớn", sau đó mở xem "Bảng Xếp Hạng Top 10".
- **Lời thoại gợi ý:**
  > "Trên màn hình là gameplay 3D thực tế. Mây có thể di chuyển, nhảy và lướt với vận tốc chuẩn hóa. Hệ thống đèn lồng hoạt động với chu kỳ nhiên liệu 100 đơn vị, tự tiêu hao và cần châm dầu thường xuyên.  
  > Kỹ năng Tỏa Sáng tiêu tốn 3 đom đóm giúp giải nguy tức thì. Ngoài ra game hỗ trợ đầy đủ các tính năng tiếp cận như bảng màu mù màu, cỡ chữ lớn và bảng xếp hạng cục bộ lưu điểm sau mỗi lượt chơi."

---

### Phần 3: Minh chứng Kiểm Chứng & Tính Tất Định (2:00 – 3:00)
- **Màn hình:** Chuyển sang cửa sổ Terminal tại thư mục gốc của project.
- **Thao tác:** Chạy lệnh:
  ```bash
  npm run verify
  ```
- **Quan sát kết quả trên màn hình:**
  - Sync-check: `game.contract.json matches src/core/tuning.ts 100%`.
  - Typecheck: `tsc --noEmit` hoàn toàn không có lỗi.
  - Test suite: `11 passed (11)`.
  - Determinism check: `SHA-256` trùng khớp 100% giữa 2 lần chạy độc lập.
  - Tốc độ mô phỏng: `21,600 ticks` hoàn thành dưới `300 ms` (giới hạn cho phép ≤ 30s).
- **Lời thoại gợi ý:**
  > "Tiếp theo là bằng chứng kiểm chứng tự động. Em chạy lệnh `npm run verify`.  
  > Cổng kiểm chứng xác nhận: thông số contract khớp 100% với mã nguồn, toàn bộ 11 bài test đơn vị và tích hợp contract v1.3 đều đạt. Đặc biệt, phép thử tất định chạy 2 lượt mô phỏng headless độc lập cho ra mã băm SHA-256 trùng khớp từng byte, và 21.600 tick của Đêm 3 chạy xong chỉ trong chưa đầy 0.3 giây."

---

### Phần 4: Đo Hiệu Năng Benchmark & Soak Test (3:00 – 3:45)
- **Màn hình:** Terminal.
- **Thao tác:** Chạy 2 lệnh nghiệm thu Phase 4:
  ```bash
  npm run bench -- --seed 42 --duration 30 --out bench.json
  cat bench.json
  npm run soak -- --seed 7 --nights 10 --out soak.json
  cat soak.json
  ```
- **Quan sát kết quả:**
  - `avg_fps`: 262.5 FPS (ngưỡng ≥ 60 FPS).
  - `p1_low_fps`: 229.2 FPS (ngưỡng ≥ 30 FPS).
  - `soak.json`: 0 crashes, bộ nhớ tăng 1.16x (ngưỡng ≤ 1.20x).
- **Lời thoại gợi ý:**
  > "Ở Phase 4, game được trang bị bộ đo hiệu năng 3D chuẩn hóa. Kịch bản benchmark mô phỏng 200 Bóng Mực và 100 đom đóm đạt tốc độ trung bình 262 FPS, 1% low đạt 229 FPS, vượt xa ngưỡng 60 FPS của đề bài.  
  > Bài kiểm tra Soak Test chạy 10 Đêm liên tục trong một tiến trình đạt 0 lỗi crash và độ gia tăng bộ nhớ chỉ 1.16 lần, nằm an toàn dưới ngưỡng 1.2 lần."

---

### Phần 5: Lịch Sử Git, Release & Harness AI (3:45 – 4:15)
- **Màn hình:** Mở giao diện trình duyệt GitHub repo hoặc chạy `git log` / `git tag`.
- **Thao tác:**
  1. Gõ `git tag` để hiển thị 4 tag: `phase-1`, `phase-2`, `phase-3`, `phase-4` cùng `v1.0.0`.
  2. Mở file `AGENTS.md` và `docs/notes/phase-4-retro.md`.
- **Lời thoại gợi ý:**
  > "Cuối cùng, toàn bộ quá trình phát triển được kiểm soát chặt chẽ qua Git với các commit nguyên tử, gắn đủ 4 tag `phase-1` đến `phase-4` và Release `v1.0.0`. Bộ harness AI gồm file cấu hình `AGENTS.md`, các hook kiểm tra tự động và tài liệu hồi tưởng retro đều được lưu trữ đầy đủ trong repo.  
  > Em xin cảm ơn thầy và các bạn đã theo dõi!"

---

## 3. Gợi Ý Kỹ Thuật Quay & Nén Video

1. **Phần mềm quay màn hình:**
   - **Windows:** Bấm `Windows + Alt + R` (Xbox Game Bar) hoặc dùng OBS Studio / CapCut / Clipchamp.
   - **Độ phân giải:** 1920×1080 hoặc 1280×720 (tối ưu nhất cho dung lượng nhỏ).

2. **Lệnh nén video nhẹ (dưới 100MB để đính kèm GitHub Release):**
   Nếu có `ffmpeg`:
   ```bash
   ffmpeg -i input.mp4 -t 300 -c:v libx264 -crf 28 -preset veryfast -c:a aac -b:a 96k demo.mp4
   ```

3. **Vị trí lưu video khi hoàn thành:**
   - Đặt file tại `docs/demo/demo.mp4` và commit lên repo, hoặc:
   - Đính kèm trực tiếp vào trang GitHub Release `v1.0.0` tại:
     `https://github.com/ducpahm03/K5-L3A-DAY12-PhamHuuDuc-2A2026033863-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0`


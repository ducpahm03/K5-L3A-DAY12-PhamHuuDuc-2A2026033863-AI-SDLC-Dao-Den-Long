# Đảo Đèn Lồng — Day 12 AI SDLC Lab (Release v1.0.0)

> **Học viên:** Phạm Hữu Đức (`2A2026033863`) · **Lớp:** K5-L3A · **Phiên bản:** `v1.0.0` (Contract v1.3)  
> **Tags:** `phase-1` → `phase-2` → `phase-3` → `phase-4`  
> **Bằng chứng kiểm chứng:**
> - Phase 1: [docs/proof/phase-1/PROOF.md](docs/proof/phase-1/PROOF.md)
> - Phase 2: [docs/proof/phase-2/PROOF.md](docs/proof/phase-2/PROOF.md)
> - Phase 3: [docs/proof/phase-3/PROOF.md](docs/proof/phase-3/PROOF.md)
> - Phase 4: [docs/proof/phase-4/PROOF.md](docs/proof/phase-4/PROOF.md) · [docs/notes/phase-4-retro.md](docs/notes/phase-4-retro.md)

**Đảo Đèn Lồng** là game 3D sinh tồn phiêu lưu cổ tích góc nhìn thứ ba xây dựng bằng **TypeScript + Three.js (Vite)** kết hợp lõi mô phỏng thuần TypeScript chạy trên **Node.js** cho chế độ headless 60 tick/giây tất định 100%.

---

## Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js ≥ 20** (khuyến nghị Node 22/24).

```bash
npm ci
npm run build
npm run start
```

Mở trình duyệt tại `http://127.0.0.1:4173` để trải nghiệm trọn vẹn 3 Đêm:
- **Đêm 1 · Đảo Bến** (yên ả mở màn)
- **Đêm 2 · Đảo Cau** (gió giật định kỳ, bùa cản gió)
- **Đêm 3 · Đảo Chuông** (chuông đồng choáng diện rộng, đệm nhảy, Bóng Mực 4.5 m/s)

---

## Kiểm thử & Chế độ Headless (Test Contract v1.3)

```bash
# Chạy toàn bộ cổng kiểm chứng tự động (sync-check, typecheck, build, 11 tests)
npm run verify

# Chạy kiểm thử vitest
npm test

# Chạy trực tiếp CLI headless (tất định, không cần GPU)
node dist/headless.mjs --seed 42 --night 1 --ticks 1800 --snapshot-every 10 --out out.jsonl

# Xuất bảng xếp hạng cục bộ
node dist/headless.mjs --export-leaderboard leaderboard.json
```

---

## Benchmark & Soak Test (Ticket-04)

```bash
# 1. Đo hiệu năng 3D Benchmark (200 Bóng Mực, 100 đom đóm, 3 đèn sáng, camera bay tròn 30s)
npm run bench -- --seed 42 --duration 30 --out bench.json
# Kết quả thực tế: 262.5 FPS (ngưỡng ≥ 60 FPS), 1% low 229.2 FPS, tải 8 ms (≤ 10,000 ms)

# 2. Soak Test 10 Đêm liên tục trong một tiến trình (kiểm tra ổn định bộ nhớ và rò rỉ)
npm run soak -- --seed 7 --nights 10 --out soak.json
# Kết quả thực tế: 0 crashes, mem_end 54.1 MB ≤ 1.2 x mem_start 46.3 MB
```

---

## Bảng Xếp Hạng & Tiếp Cận (Accessibility)
- **Bảng xếp hạng cục bộ:** Lưu top 10 điểm cao nhất, lưu theo tên (3–12 ký tự), số đêm thắng, thời điểm đạt ISO 8601 kèm múi giờ.
- **Tiếp cận người chơi:**
  - **Bảng màu mù màu (Colorblind mode):** Phân biệt rõ Bóng Mực (`#00B3FF`) và cảnh báo (`#FFFFFF`).
  - **Cỡ chữ lớn (Large text):** 1.25x scaling, phông chuẩn ≥ 18px ở 1280×720.
  - **Giảm chuyển động (Reduced Motion):** Tắt rung lắc camera và hiệu ứng chớp sáng mạnh.
  - **Mũi tên định hướng:** Chỉ báo mép màn hình trỏ về đèn chưa thắp hoặc đèn cạn dầu gần nhất.

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| `W A S D` (hoặc `↑ ↓`) | Di chuyển Mây theo hướng camera 3D (tốc độ chuẩn 6.0 m/s) |
| `Space` | Nhảy (vận tốc 7.0 m/s, trọng lực −20 m/s²) |
| `Shift` | **Lướt (Dash)** — tốc độ 14 m/s trong 0.2s, hồi chiêu 1.5s |
| `E` | Nạp đom đóm / Châm dầu vào Đèn Lồng gần nhất |
| `F` / `Chuột phải` | **Tỏa Sáng (`pulse`)** — tốn 3 đom đóm, đẩy lùi 4m & làm choáng Bóng Mực 2s trong bán kính 5m |
| `Esc` / `P` | Tạm dừng trò chơi |
| `Kéo chuột trái` | Xoay camera tự do quanh Mây |

---

## Cấu trúc thư mục

- `src/core/` — Lõi mô phỏng tất định 60Hz (zero external/DOM dependencies)
- `src/headless/` — CLI contract v1.3, benchmark, soak test & export leaderboard
- `src/game/` — Three.js 3D client, VFX shader, WebAudio ngũ cung & HUD
- `docs/proof/` — Toàn bộ bằng chứng Phase 1, 2, 3, 4 (ảnh chụp, JSONL, hash, bench.json, soak.json)
- `docs/notes/` — ADR-001 kiến trúc châm dầu, nhật ký AI & hồi tưởng kết thúc dự án

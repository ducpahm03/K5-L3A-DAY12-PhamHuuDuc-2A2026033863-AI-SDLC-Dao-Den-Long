# Đảo Đèn Lồng — Day 12 AI SDLC Lab

> **Học viên:** Phạm Hữu Đức (`2A2026033863`) · **Lớp:** K5-L3A · **Phase hiện tại:** `phase-1` (PRD-0 · Test Contract v1.0)
> **Bằng chứng kiểm chứng Phase 1:** [docs/proof/phase-1/PROOF.md](docs/proof/phase-1/PROOF.md) · **Giả định & SDLC:** [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md)

**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba xây bằng **TypeScript + Three.js (Vite)** kết hợp lõi mô phỏng thuần TypeScript chạy trên **Node.js** cho chế độ headless 60 tick/giây tất định (chạy mượt trên macOS, Linux và Windows).

---

## Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js ≥ 20** (khuyến nghị Node 22/24).

```bash
npm ci
npm run build
npm run start
```

Mở trình duyệt tại `http://127.0.0.1:4173` để chơi **Đêm 1 – Đảo Bến**.

## Kiểm thử & Chế độ Headless (Test Contract v1.0)

```bash
# Chạy toàn bộ cổng kiểm chứng (sync-check, typecheck, build, 12 unit/contract tests, kiểm tra tất định 2 lần)
npm run verify

# Chạy trực tiếp CLI headless (không cần cửa sổ/GPU)
node dist/headless.mjs --seed 42 --night 1 --ticks 1800 --snapshot-every 10 --out out.jsonl
```

Khai báo contract tại gốc repo: [`game.contract.json`](game.contract.json).

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| `W A S D` (hoặc `↑ ↓`) | Di chuyển Mây theo hướng camera 3D |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `2.5m`) |
| `F` / `Q` / `Chuột phải` | **Tỏa Sáng (`pulse`)** — tốn 1 đom đóm, đẩy lùi `4m` & làm choáng Bóng Mực `3s` trong `7m` |
| `Kéo chuột trái` hoặc `← →` | Xoay camera 3D quanh Mây (có nút **Khóa chuột / Pointer Lock** tùy chọn trên HUD) |

---

## Cách tính điểm & Thông số chính (`game.contract.json`)

| Sự kiện / Luật | Giá trị |
|---|---:|
| Nhặt 1 đom đóm (`per_mote`, tối đa mang `5`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`, cần `3` đom đóm/đèn) | `+200` |
| Làm choáng 1 Bóng Mực bằng Tỏa Sáng (`per_stun`, hồi chiêu `2s`) | `+25` |
| Thưởng thời gian còn lại khi thắng (`per_second_left`, `floor(time_left_s)`) | `+5 / giây` |
| Thưởng ngọn lửa còn lại khi thắng (`per_flame_left`, khởi đầu `3` lửa) | `+100 / lửa` |
| Bị Bóng Mực chạm | Mất `1` lửa, rơi `floor(carried * 0.5)` đom đóm, bất tử `1.5s` |
| Rơi khỏi đảo (`fall_enabled`) | `false` — Đảo Bến (`R = 35m`) có rào đá & biển mây mềm bao quanh |

---

## Sáng tạo của tôi (không làm lệch Test Contract)

Toàn bộ phần sáng tạo nằm hoàn toàn trong tầng hiển thị và âm thanh (`src/game/`), **không chạm tới lõi mô phỏng `src/core/`** và **tự động tắt hoàn toàn khi chạy headless**:

1. **Mỹ thuật 3D Cổ Tích Procedural (100% mã nguồn, 0 asset ngoài):** Mây mặc áo choàng bay theo vận tốc, đội **nón lá** có **đèn lồng nhỏ treo đung đưa** tỏa ánh sáng điểm cùng các đom đóm đã nhặt bay xoay quanh; 5 Đèn Lồng Lớn mái đình hiện cột sáng và vòng an toàn `safe_radius = 6m` khi thắp; Đảo Bến có cầu gỗ vươn ra biển mây trôi, trăng sao và đèn trời bay xa.
2. **Thế giới biến chuyển theo tiến độ (0/5 → 5/5 đèn):** Bầu trời gradient shader và sương mù chuyển mượt từ tím đêm sâu sang ánh bình minh ấm áp theo từng ngọn đèn được thắp.
3. **Luồng gió đom đóm dẫn đường & Mini-la bàn:** Dải hạt sáng uốn lượn nhẹ từ Mây về phía đèn chưa thắp gần nhất giúp định hướng tự nhiên trong sương đêm.
4. **Âm thanh WebAudio Ngũ Cung Procedural:** Nhạc nền thang âm ngũ cung tự tổng hợp, mở thêm hòa âm theo số đèn đã thắp kèm hiệu ứng chuông gió, chuông đồng, sóng xung kích Tỏa Sáng (có nút tắt/bật trên HUD).

- **Bằng chứng không phá Contract:** `src/core/` không import `three` hay WebAudio; chạy `npm run verify` xác nhận 12/12 test xanh và 2 lần chạy headless (`--seed 1337`, 1800 ticks) cho SHA-256 trùng khớp tuyệt đối ([determinism.txt](docs/proof/phase-1/determinism.txt)).

---

## Cấu trúc dự án & Tài liệu SDLC

- `src/core/` — Lõi mô phỏng thuần TS 60Hz (dùng chung cho 3D và headless)
- `src/headless/` — CLI tuân thủ Test Contract v1.0 → `dist/headless.mjs`
- `src/game/` — Trình diễn 3D Three.js, VFX, WebAudio, HUD & điều khiển
- `tests/` — Unit tests, contract integration tests & scenario fixtures
- `AGENTS.md`, `.agents/skills/verify-phase/`, `.githooks/pre-commit`, `.github/workflows/ci.yml` — Harness AI & tự động hóa kiểm chứng
- `docs/notes/` — Giả định ([phase-1-assumptions.md](docs/notes/phase-1-assumptions.md)), Nhật ký AI & token ([ai-log.md](docs/notes/ai-log.md)), Đánh giá ([phase-1-eval.md](docs/notes/phase-1-eval.md))
- `docs/proof/phase-1/` — Bảng truy vết, JSONL thật, hash tất định và ảnh chụp 3D ([PROOF.md](docs/proof/phase-1/PROOF.md))
- Tài liệu gốc của lab: [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) · [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md) · [CREDITS.md](CREDITS.md)

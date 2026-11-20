# Phase 4 — Proof of Release & Non-Functional Verification (Contract v1.3)

Date: 2026-11-20  
Team: `2A2026033863-pham-huu-duc`  
Tag: `phase-4` + Release `v1.0.0`  
Test Contract: `v1.3`

---

## 1. 3D Benchmark Results (`bench.json`)
Command executed:
```bash
npm run bench -- --seed 42 --duration 30 --out bench.json
```
or via contract command:
```bash
node dist/bench.mjs --seed 42 --duration 30 --out bench.json
```

### Metrics & Thresholds Check:
| Metric | Benchmark Measurement | Ticket-04 Threshold | Status |
|---|---|---|---|
| **avg_fps** | **262.5 FPS** | ≥ 60.0 FPS | **PASS** |
| **p1_low_fps** | **229.2 FPS** | ≥ 30.0 FPS | **PASS** |
| **frame_ms_p95** | **3.8 ms** | ≤ 33.3 ms | **PASS** |
| **load_ms** | **8 ms** | ≤ 10,000 ms (10s) | **PASS** |
| **peak_mem_mb** | **54 MB** | Reasonable headroom | **PASS** |
| **frames** | **7877 frames** | > 1800 frames | **PASS** |
| **vsync_off** | **true** | Engine unconstrained | **PASS** |

Scene setup:
- Exactly 200 Bóng Mực wandering across island (`seed: 42`).
- Exactly 100 Đom đóm placed.
- 3 Lanterns (L1–L3) lit with 100 fuel.
- Orbiting camera at radius 30m, altitude Y=15m, center (0,0,0), 15s/orbit, 1280×720 viewport.

---

## 2. Soak Test Results (`soak.json`)
Command executed:
```bash
npm run soak -- --seed 7 --nights 10 --out soak.json
```
or:
```bash
node dist/soak.mjs --seed 7 --nights 10 --out soak.json
```

### Metrics & Stability Check:
| Metric | Soak Measurement | Pass Threshold | Status |
|---|---|---|---|
| **nights** | 10 nights | 10 | **PASS** |
| **crashes** | 0 | 0 | **PASS** |
| **mem_start_mb** | 46.3 MB | Baseline | **PASS** |
| **mem_end_mb** | 54.1 MB | ≤ 1.2 × 46.3 = 55.56 MB | **PASS** (1.16x) |
| **duration_s** | 0.2 s | Stable headless run | **PASS** |

No process leaks or unbound growth observed across consecutive Night 1 → Night 2 → Night 3 transitions.

---

## 3. Local Leaderboard & Export
- Top 10 persistent leaderboard implemented with name (3–12 alphanumeric/accented characters), score, nights won (0–3), ISO 8601 timestamp with timezone, and seed.
- Integrated into Web UI via `#overlay-leaderboard` and score entry modal on Victory/Defeat.
- Export CLI command:
```bash
node dist/headless.mjs --export-leaderboard leaderboard.json
```

---

## 4. Accessibility Enhancements (Ticket-04 §4)
- **Visual Cues & Subtitles**: Directional indicator arrow pointing to nearest offscreen unlit/low-fuel lantern; wind alert banners; countdown prompts.
- **Colorblind Palettes**: High-contrast blue shade tint (`#00B3FF`) and luminous white alert icons (`#FFFFFF`).
- **Large Text Scaling**: 1.25x scale mode toggle (`body.large-text`) ensuring font sizes ≥ 18px on 1280×720 displays.
- **Reduced Motion**: Option toggle disables camera shakes, screen flashes, and rapid pulse animations (`body.reduced-motion`).

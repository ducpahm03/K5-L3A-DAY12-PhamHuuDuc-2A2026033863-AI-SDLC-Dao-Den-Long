# Retrospective: Đảo Đèn Lồng (AI SDLC 4-Phase Lab)

**Project:** Đảo Đèn Lồng (Day 12 AI SDLC Lab)  
**Team:** `2A2026033863-pham-huu-duc`  
**Tags:** `phase-1` → `phase-2` → `phase-3` → `phase-4` (Release `v1.0.0`)  
**Contract Version:** `v1.0` → `v1.1` → `v1.2` → `v1.3`

---

## 1. Project Overview & Architecture
Over 4 structured phases, we developed **Đảo Đèn Lồng**, a stylized 3D atmospheric survival action game paired with a deterministically verifiable headless simulation engine:
- **Phase 1 (Ticket-01 & PRD-0):** Single island (Đảo Bến), 60Hz tick pipeline, deterministic integer math, Three.js client with low-poly aesthetics, and byte-for-byte replay verification via headless JSONL traces.
- **Phase 2 (Ticket-02):** Three-island campaign (Đảo Bến, Đảo Cau, Đảo Chuông), standardized physics (6 m/s run, 7 m/s jump, 14 m/s dash), wind physics, charms, drifters, jump pads, and full headless regression.
- **Phase 3 (Ticket-03):** Lantern fuel lifecycle (100% capacity, integer 1/60 units), shade oil draining, safe zone degradation under 30% fuel, progressive capacity (10..20), colorblind visual adjustments, and ADR-001 architectural rationale.
- **Phase 4 (Ticket-04):** Release v1.0.0, automated 3D benchmark (200 shades, 100 motes, orbiting camera at 262.5 FPS), 10-night continuous soak test (zero crashes, 1.16x memory stability), local persistent leaderboard, and comprehensive accessibility features (large text, reduced motion, directional arrow).

---

## 2. SDLC Harness Effectiveness
The most impactful architectural decision was **strictly decoupling the core simulation (`src/core/`) from the rendering/DOM environment (`src/game/`)**:
1. **Headless Speed & Verification:** Simulating 21,600 ticks of Night 3 took ~150 milliseconds in Node.js instead of 6 minutes of wall-clock time in a browser. This enabled instant unit testing, contract assertions, and automated determinism checks on every commit.
2. **Deterministic Integrity:** By avoiding unseeded random numbers and floating-point cumulative drift (using scaled integer units for fuel and time counters), traces generated on disparate machines matched byte-for-byte.
3. **Contract v1.0 → v1.3 Evolution:** Maintaining `game.contract.json` and running `scripts/sync-check.mjs` prevented drift between gameplay tuning parameters and test harness assertions.

---

## 3. AI Collaboration & Failure Modes Observed
Working with an AI coding partner throughout the lab revealed key lessons:
1. **Long Stream Dropouts (SSE Gateway Timeouts):** Generating overly large monolithic files (>300 lines) in a single tool call caused network stream interruptions. Switching to chunked writes and modular files (`leaderboard-node.ts`, `leaderboard.ts`) prevented timeouts.
2. **Platform Context Leakage:** Browser builds initially failed when Node-specific modules (`node:fs`) were imported into shared core modules. Establishing a clean boundary between platform-agnostic core logic and platform-specific CLI harnesses resolved the issue permanently.
3. **PowerShell Escaping:** When invoking commands on Windows PowerShell via automation, nested double-quotes in command strings caused syntax issues unless wrapped cleanly or separated into dedicated scripts.
4. **Independent Review Rigor:** Running independent verification subagents caught missing edge-cases (such as intermediate key release states during pause/resume toggling) before submitting tags.

---

## 4. Performance & Release Metrics Summary
- **Benchmark (`bench.json`):**
  - Average FPS: **262.5 FPS** (Threshold: ≥ 60 FPS)
  - 1% Low FPS: **229.2 FPS** (Threshold: ≥ 30 FPS)
  - 95th Percentile Frame Time: **3.8 ms**
  - Initial Load Time: **8 ms** (Threshold: ≤ 10,000 ms)
  - Peak Memory: **54 MB**
- **Soak Test (`soak.json`):**
  - 10 Nights continuous: **0 crashes**
  - Memory: 46.3 MB → 54.1 MB (Factor: 1.16x ≤ 1.20x limit)
- **Test Suite:**
  - 11/11 automated Vitest unit and contract tests passing 100%.

---

## 5. Conclusion
The four-phase AI SDLC journey successfully transformed a conceptual prototype into a production-grade, highly performant, accessible 3D game with zero compromises on determinism, documentation, or code quality.

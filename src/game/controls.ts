import type { ResolvedInput } from '../core/types.js';

export class InputController {
  public camYawDeg = 0;
  public camPitchRad = 0.44;
  public sensitivity = 1.0;

  private readonly keys = new Set<string>();
  private dragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private jumpQueued = false;
  private interactQueued = false;
  private pulseQueued = false;
  private dashQueued = false;
  private pauseQueued = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly onPauseKey?: () => void;

  constructor(canvas: HTMLCanvasElement, onPauseKey?: () => void) {
    this.canvas = canvas;
    this.onPauseKey = onPauseKey;
    this.bind();
  }

  private bind(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'KeyF' || e.code === 'KeyQ') this.pulseQueued = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashQueued = true;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pauseQueued = true;
        this.onPauseKey?.();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.pulseQueued = true;
        return;
      }
      if (e.button === 0) {
        this.dragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === this.canvas;
      let dx = 0;
      let dy = 0;
      if (locked) {
        dx = e.movementX;
        dy = e.movementY;
      } else if (this.dragging) {
        dx = e.clientX - this.lastMouseX;
        dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        return;
      }
      this.camYawDeg = (this.camYawDeg - dx * 0.25 * this.sensitivity + 360) % 360;
      this.camPitchRad = Math.max(0.18, Math.min(1.05, this.camPitchRad + dy * 0.004 * this.sensitivity));
    });
  }

  sampleForTick(dt: number): ResolvedInput {
    const yawSpeed = 115 * this.sensitivity;
    if (this.keys.has('ArrowLeft')) this.camYawDeg = (this.camYawDeg + yawSpeed * dt + 360) % 360;
    if (this.keys.has('ArrowRight')) this.camYawDeg = (this.camYawDeg - yawSpeed * dt + 360) % 360;

    let mx = 0;
    let mz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1;
    if (this.keys.has('KeyA')) mx += 1;
    if (this.keys.has('KeyD')) mx -= 1;

    const input: ResolvedInput = {
      move: [mx, mz],
      cam_yaw_deg: this.camYawDeg,
      jump: this.jumpQueued || this.keys.has('Space'),
      interact: this.interactQueued || this.keys.has('KeyE'),
      pulse: this.pulseQueued || this.keys.has('KeyF'),
      dash: this.dashQueued || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      pause: this.pauseQueued,
    };

    this.jumpQueued = false;
    this.interactQueued = false;
    this.pulseQueued = false;
    this.dashQueued = false;
    this.pauseQueued = false;
    return input;
  }

  resetCamera(): void {
    this.camYawDeg = 0;
    this.camPitchRad = 0.44;
    this.keys.clear();
    this.jumpQueued = false;
    this.interactQueued = false;
    this.pulseQueued = false;
    this.dashQueued = false;
    this.pauseQueued = false;
  }
}

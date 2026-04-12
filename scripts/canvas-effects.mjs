/**
 * Canvas Effects
 * Ambient particle effects behind the active speaker spotlight.
 * Uses FoundryVTT's bundled PIXI.js — no additional dependency.
 */

/**
 * Floating ambient particles that drift upward behind the spotlight.
 * Attach to any PIXI container (or create an overlay).
 */
export class SpotlightParticles {
  /**
   * @param {HTMLElement} container - DOM element to overlay particles on
   * @param {Object} [options]
   * @param {number} [options.color=0x5E81AC] - Particle tint (hex)
   * @param {number} [options.count=25] - Number of particles
   * @param {number} [options.opacity=0.4] - Max opacity
   */
  constructor(container, { color = 0x5E81AC, count = 25, opacity = 0.4 } = {}) {
    this._container = container;
    this._color = color;
    this._count = count;
    this._opacity = opacity;
    this._canvas = null;
    this._app = null;
    this._particles = [];
    this._running = false;
  }

  /**
   * Start the particle effect. Creates a PIXI canvas overlay.
   */
  start() {
    if (this._running) return;
    if (typeof PIXI === 'undefined') {
      console.warn('StoryFrame | PIXI not available, skipping canvas effects');
      return;
    }

    this._running = true;

    // Create an overlay canvas
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'sf-particle-overlay';
    this._canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;';
    this._container.appendChild(this._canvas);

    const w = this._container.offsetWidth;
    const h = this._container.offsetHeight;
    this._canvas.width = w;
    this._canvas.height = h;

    // Use simple 2D canvas for particles (lighter than full PIXI app)
    this._ctx = this._canvas.getContext('2d');
    this._width = w;
    this._height = h;

    // Create particle data
    this._particles = [];
    for (let i = 0; i < this._count; i++) {
      this._particles.push(this._createParticle());
    }

    this._raf = null;
    this._lastTime = performance.now();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  _createParticle(fromBottom = false) {
    return {
      x: Math.random() * this._width,
      y: fromBottom ? this._height + Math.random() * 20 : Math.random() * this._height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.15 + Math.random() * 0.4),
      radius: 1 + Math.random() * 2.5,
      alpha: (0.15 + Math.random() * this._opacity),
      decay: 0.0003 + Math.random() * 0.0005,
    };
  }

  _tick(now) {
    if (!this._running) return;

    const dt = Math.min(now - this._lastTime, 50); // Cap delta to avoid jumps
    this._lastTime = now;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._width, this._height);

    // Extract RGB from hex color
    const r = (this._color >> 16) & 0xFF;
    const g = (this._color >> 8) & 0xFF;
    const b = this._color & 0xFF;

    for (const p of this._particles) {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.alpha -= p.decay * (dt / 16);

      // Reset particles that fade out or leave the top
      if (p.alpha <= 0 || p.y < -10) {
        Object.assign(p, this._createParticle(true));
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
      ctx.fill();
    }

    this._raf = requestAnimationFrame(this._tick);
  }

  /**
   * Update particle color (e.g. when switching to secondary speaker's amber).
   * @param {number} color - Hex color value
   */
  setColor(color) {
    this._color = color;
  }

  /**
   * Handle container resize.
   */
  resize() {
    if (!this._canvas || !this._container) return;
    this._width = this._container.offsetWidth;
    this._height = this._container.offsetHeight;
    this._canvas.width = this._width;
    this._canvas.height = this._height;
  }

  /**
   * Stop and remove particle effect.
   */
  stop() {
    this._running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this._canvas?.remove();
    this._canvas = null;
    this._ctx = null;
    this._particles = [];
  }
}

/**
 * Simple particle system for combat feedback effects
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class ParticleManager {
  private particles: Particle[] = [];

  /**
   * Spawn hit particles at a world position
   */
  spawnHitParticles(x: number, y: number, count: number = 5, color: string = '#ff4444') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // bias upward
        life: 300 + Math.random() * 200,
        maxLife: 500,
        size: 2 + Math.random() * 2,
        color
      });
    }
  }

  /**
   * Spawn death particles (bigger burst)
   */
  spawnDeathParticles(x: number, y: number) {
    this.spawnHitParticles(x, y, 12, '#ff2222');
    // Add some darker particles
    this.spawnHitParticles(x, y, 6, '#880000');
  }

  /**
   * Update all particles (call each frame)
   */
  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Apply gravity
      p.vy += 0.1;

      // Apply friction
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Decrease life
      p.life -= dt;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles to context
   */
  render(ctx: CanvasRenderingContext2D, scale: number, cameraX: number, cameraY: number) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * alpha * scale;

      const screenX = (p.x - cameraX) * scale;
      const screenY = (p.y - cameraY) * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
  }

  /**
   * Get particle count (for debugging)
   */
  get count(): number {
    return this.particles.length;
  }
}

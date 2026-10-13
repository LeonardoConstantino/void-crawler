import { 
  PlayerState, 
  EnemyState, 
  MemoryFragment, 
  Particle, 
  GlitchEvent, 
  Direction,
  GhostFrame 
} from '../types';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private animFrame: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public setDimensions(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Main draw call
   */
  public render(
    grid: number[][],
    player: PlayerState,
    enemies: EnemyState[],
    fragments: MemoryFragment[],
    particles: Particle[],
    currentGlitch: GlitchEvent | null,
    ghostFrame: GhostFrame | null,
    tileSize: number,
    tensionLevel: number, // 0 to 1 based on proximity to enemies
    isVulnerableActive: boolean
  ) {
    this.animFrame++;
    const ctx = this.ctx;
    
    // Clear viewport with a high-contrast warm-neutral/dark theme: #050508
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, this.width, this.height);

    // Apply viewport-wide glitch displacement (Nível 2-3 Glitch)
    let glitchOffsetX = 0;
    let glitchOffsetY = 0;
    const isGlitching = currentGlitch && currentGlitch.active;
    
    if (isGlitching || tensionLevel > 0.8) {
      if (Math.random() < 0.15) {
        glitchOffsetX = (Math.random() - 0.5) * (isGlitching ? 8 : 3);
        glitchOffsetY = (Math.random() - 0.5) * (isGlitching ? 4 : 1.5);
      }
    }

    ctx.save();
    ctx.translate(glitchOffsetX, glitchOffsetY);

    // 1. Draw Maze Grid (Walls, Circuits & Warp Gates)
    this.drawMaze(grid, tileSize, currentGlitch);

    // 2. Draw Memory Fragments & Exploits
    this.drawFragments(fragments, tileSize);

    // 3. Draw Spectral Ghost Data (if any)
    if (ghostFrame) {
      this.drawGhost(ghostFrame, tileSize);
    }

    // 4. Draw Player
    this.drawPlayer(player, tileSize, tensionLevel);

    // 5. Draw Enemies (Specters)
    enemies.forEach(enemy => {
      this.drawEnemy(enemy, tileSize);
    });

    // 6. Draw Particle System
    this.drawParticles(particles);

    // 7. Post-processing effects (Vignette, CRT scanlines, chromatic aberration overlays)
    ctx.restore();
    
    this.applyPostProcessing(tensionLevel, isGlitching);
  }

  /**
   * Draws the maze with circuit tracks and gate portals
   */
  private drawMaze(grid: number[][], tileSize: number, currentGlitch: GlitchEvent | null) {
    const ctx = this.ctx;
    const h = grid.length;
    const w = grid[0].length;
    
    const pulseWall = 0.5 + 0.5 * Math.sin(this.animFrame * 0.04);
    const vanishActive = currentGlitch && currentGlitch.active && currentGlitch.type === 'WALL_VANISH';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const screenX = x * tileSize;
        const screenY = y * tileSize;

        if (cell === 1) { // Wall
          // If Wall Vanish glitch event is active, walls become transparent paths!
          if (vanishActive) {
            ctx.fillStyle = `rgba(26, 26, 46, 0.25)`;
            ctx.fillRect(screenX + 2, screenY + 2, tileSize - 4, tileSize - 4);
            continue;
          }

          // Render walls as stylized, tech-glowing circuit blocks
          ctx.fillStyle = '#0f0f1c'; // Inner core
          ctx.fillRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2);

          // Neon outline circuit lines
          ctx.strokeStyle = '#1b1b3a';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2);

          // Add glowing tracks/circuit wires
          ctx.strokeStyle = `rgba(0, 245, 255, ${0.15 + pulseWall * 0.15})`; // glowing ciano
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          // Connect to adjacent walls to draw seamless electronic layout
          const isLeftWall = x > 0 && grid[y][x - 1] === 1;
          const isRightWall = x < w - 1 && grid[y][x + 1] === 1;
          const isTopWall = y > 0 && grid[y - 1][x] === 1;
          const isBottomWall = y < h - 1 && grid[y + 1][x] === 1;

          const cx = screenX + tileSize / 2;
          const cy = screenY + tileSize / 2;

          ctx.moveTo(cx, cy);
          if (isLeftWall) ctx.lineTo(screenX, cy);
          if (isRightWall) ctx.lineTo(screenX + tileSize, cy);
          if (isTopWall) ctx.moveTo(cx, cy), ctx.lineTo(cx, screenY);
          if (isBottomWall) ctx.moveTo(cx, cy), ctx.lineTo(cx, screenY + tileSize);
          ctx.stroke();

          // Microchip solder nodes on intersection junctions
          if ((isLeftWall && isTopWall) || (isRightWall && isBottomWall)) {
            ctx.fillStyle = '#00f5ff';
            ctx.beginPath();
            ctx.arc(cx, cy, 2, 0, Math.PI * 2);
            ctx.fill();
          }

        } else if (cell === 2) { // Warp Gate Portal
          // Draw pulsing portal
          const portalPulse = Math.sin(this.animFrame * 0.1) * 3;
          ctx.fillStyle = `rgba(155, 89, 182, ${0.2 + Math.sin(this.animFrame * 0.1) * 0.1})`; // Violet portal
          ctx.fillRect(screenX, screenY, tileSize, tileSize);
          
          ctx.strokeStyle = '#9b59b6';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX, screenY, tileSize, tileSize);

          ctx.beginPath();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.arc(screenX + tileSize / 2, screenY + tileSize / 2, (tileSize / 2) - 4 + portalPulse, 0, Math.PI * 2);
          ctx.stroke();

        } else if (cell === 3) { // Inside Ghost House
          ctx.strokeStyle = 'rgba(155, 89, 182, 0.15)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, tileSize, tileSize);
        }
      }
    }
  }

  /**
   * Draws fragments & larger exploit powerups
   */
  private drawFragments(fragments: MemoryFragment[], tileSize: number) {
    const ctx = this.ctx;
    const pulse = Math.sin(this.animFrame * 0.08);

    fragments.forEach(frag => {
      if (frag.collected) return;

      const cx = frag.x * tileSize + tileSize / 2;
      const cy = frag.y * tileSize + tileSize / 2;

      if (frag.isExploit) {
        // Exploit / Star shape pulsing ciano
        const size = (tileSize * 0.35) + pulse * 1.5;
        ctx.fillStyle = '#00f5ff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(
            cx + Math.cos(((18 + i * 72) * Math.PI) / 180) * size,
            cy - Math.sin(((18 + i * 72) * Math.PI) / 180) * size
          );
          ctx.lineTo(
            cx + Math.cos(((54 + i * 72) * Math.PI) / 180) * (size * 0.4),
            cy - Math.sin(((54 + i * 72) * Math.PI) / 180) * (size * 0.4)
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Extra outer circle glow
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 1.6, 0, Math.PI * 2);
        ctx.stroke();

      } else {
        // Standard tiny memory dot
        const size = 2.5 + pulse * 0.5;
        ctx.fillStyle = '#f0e68c'; // warm gold
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /**
   * Draws Player as a fluid pulsing data core
   */
  private drawPlayer(player: PlayerState, tileSize: number, tensionLevel: number) {
    const ctx = this.ctx;
    
    // Elastic deformation based on movement
    let scaleX = 1.0;
    let scaleY = 1.0;
    const pulse = Math.sin(this.animFrame * 0.1) * 0.08;
    
    if (player.direction !== 'NONE') {
      // squash and stretch relative to movement direction
      if (player.direction === 'LEFT' || player.direction === 'RIGHT') {
        scaleX = 1.15;
        scaleY = 0.85;
      } else {
        scaleX = 0.85;
        scaleY = 1.15;
      }
    }

    ctx.save();
    ctx.translate(player.posX, player.posY);
    ctx.scale(scaleX + pulse, scaleY + pulse);

    // Draw glowing back aura
    const auraGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, tileSize * 1.1);
    auraGlow.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    auraGlow.addColorStop(0.3, 'rgba(155, 89, 182, 0.25)'); // violet corrupção
    auraGlow.addColorStop(1, 'rgba(155, 89, 182, 0)');
    ctx.fillStyle = auraGlow;
    ctx.beginPath();
    ctx.arc(0, 0, tileSize * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Fluid organic player shape (Draw morphing circle)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const radius = tileSize * 0.4;
    
    // Create an irregular morphing shape by tracing 8 directions with subtle offsets
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      // Irregularity increases with player tension (nearest enemy)
      const waveOffset = Math.sin(this.animFrame * 0.2 + i) * (1.5 + tensionLevel * 4);
      const r = radius + waveOffset;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw cyber/circuit eye or core line
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    // Rotate looking eye direction
    let eyeOffsetX = 0;
    let eyeOffsetY = 0;
    if (player.direction === 'LEFT') eyeOffsetX = -3;
    else if (player.direction === 'RIGHT') eyeOffsetX = 3;
    else if (player.direction === 'UP') eyeOffsetY = -3;
    else if (player.direction === 'DOWN') eyeOffsetY = 3;

    ctx.arc(eyeOffsetX, eyeOffsetY, 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws enemies (Specters) with distinct animated styles
   */
  private drawEnemy(enemy: EnemyState, tileSize: number) {
    if (enemy.isDead) return;

    const ctx = this.ctx;
    const px = enemy.posX;
    const py = enemy.posY;
    const radius = tileSize * 0.42;
    const pulse = Math.sin(this.animFrame * 0.12 + enemy.posX) * 1.5;

    ctx.save();
    ctx.translate(px, py);

    // 1. Draw vulnerability state (Fleeing/Kernel Exploit active)
    if (enemy.isVulnerable) {
      const isCritical = enemy.spawnTimer < 2500; // Flashing near expiration
      const pulseFlash = Math.floor(this.animFrame / 4) % 2 === 0;

      // Deep dark failure slate color, occasionally flashes white/cyan
      ctx.fillStyle = (isCritical && pulseFlash) ? '#ffffff' : '#1e3799';
      ctx.strokeStyle = (isCritical && pulseFlash) ? '#ff0000' : '#4a69bd';
      ctx.lineWidth = 1.5;

      // Draw digital ghost outline with wavy tentacles
      ctx.beginPath();
      ctx.arc(0, -2, radius, Math.PI, 0, false);
      ctx.lineTo(radius, radius);
      
      // Waviness
      const waveCount = 3;
      const waveW = radius * 2 / waveCount;
      const waveH = 4 + Math.sin(this.animFrame * 0.15) * 3;
      for (let i = 0; i < waveCount; i++) {
        const cx = radius - (i * waveW) - (waveW / 2);
        const cy = radius + (i % 2 === 0 ? waveH : -waveH);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(-radius, radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sick digital eyes
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(-5, -4, 3, 3);
      ctx.fillRect(2, -4, 3, 3);
      ctx.restore();
      return;
    }

    // 2. Draw normal states according to custom personalities (GDD Section 8.1.3)
    ctx.fillStyle = enemy.color;
    ctx.strokeStyle = enemy.color;

    switch (enemy.type) {
      case 'SPECTER_A': { // Pursuer (Aggressive Blinky): Blocky, sharp-cornered digital ghost
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.lineWidth = 3;

        // Pulse outer digital ring
        ctx.beginPath();
        ctx.arc(0, 0, radius + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Polygon tech ghost body
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius * 0.8, -radius * 0.5);
        ctx.lineTo(radius, radius * 0.6);
        ctx.lineTo(radius * 0.5, radius * 0.9);
        ctx.lineTo(0, radius * 0.6);
        ctx.lineTo(-radius * 0.5, radius * 0.9);
        ctx.lineTo(-radius, radius * 0.6);
        ctx.lineTo(-radius * 0.8, -radius * 0.5);
        ctx.closePath();
        ctx.fill();

        // Focused tracking red eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);
        
        ctx.fillStyle = '#000';
        let lookX = 0; let lookY = 0;
        if (enemy.direction === 'LEFT') lookX = -2;
        else if (enemy.direction === 'RIGHT') lookX = 2;
        else if (enemy.direction === 'UP') lookY = -2;
        else if (enemy.direction === 'DOWN') lookY = 2;
        
        ctx.fillRect(-6 + lookX, -4 + lookY, 2, 2);
        ctx.fillRect(2 + lookX, -4 + lookY, 2, 2);
        break;
      }

      case 'SPECTER_B': { // Ambush (Pinky): Smooth elongated geometric arrow-head shroud
        ctx.fillStyle = '#9b59b6';
        
        ctx.beginPath();
        // Pointed head
        ctx.moveTo(0, -radius * 1.3);
        ctx.lineTo(radius, radius * 0.3);
        ctx.quadraticCurveTo(0, radius * 0.9, -radius, radius * 0.3);
        ctx.closePath();
        ctx.fill();

        // Ring particles orbiting
        const orbitAngle = (this.animFrame * 0.05) % (Math.PI * 2);
        ctx.strokeStyle = 'rgba(155, 89, 182, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.3, radius * 0.5, Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(Math.cos(orbitAngle) * radius * 1.3, Math.sin(orbitAngle) * radius * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Geometric eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-5, -3); ctx.lineTo(-2, -6); ctx.lineTo(-1, -3); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, -3); ctx.lineTo(2, -6); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill();
        break;
      }

      case 'SPECTER_C': { // Swarm (Inky): Modular fragment orbits magnetizing
        ctx.fillStyle = '#1abc9c';
        
        // Inner core
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.5 + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // 4 satellites orbiting tightly
        const numSatellites = 4;
        for (let i = 0; i < numSatellites; i++) {
          const satAngle = (this.animFrame * 0.07) + (i * Math.PI / 2);
          const dist = radius * 0.85 + Math.sin(this.animFrame * 0.1 + i) * 1.5;
          const sx = Math.cos(satAngle) * dist;
          const sy = Math.sin(satAngle) * dist;

          ctx.fillStyle = 'rgba(26, 188, 156, 0.85)';
          ctx.fillRect(sx - 3, sy - 3, 6, 6);
          
          // Tiny connections
          ctx.strokeStyle = 'rgba(26, 188, 156, 0.15)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }

        // Tech eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -2, 2, 4);
        ctx.fillRect(3, -2, 2, 4);
        break;
      }

      case 'SPECTER_D': { // Chaotic (Clyde): Asymmetric flickering unstable digital cluster
        ctx.fillStyle = '#f39c12';
        
        // Flickering geometry
        const randPoints = 6;
        ctx.beginPath();
        for (let i = 0; i < randPoints; i++) {
          const angle = (i * Math.PI * 2) / randPoints;
          const r = radius * 0.7 + (Math.random() - 0.5) * 5;
          const rx = Math.cos(angle) * r;
          const ry = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill();

        // Noise block trails
        if (Math.random() < 0.4) {
          ctx.fillStyle = 'rgba(243, 156, 18, 0.4)';
          ctx.fillRect((Math.random() - 0.5) * 20, radius + 2, Math.random() * 8 + 2, Math.random() * 8 + 2);
        }

        // Glitched binary eyes
        ctx.fillStyle = '#fff';
        ctx.font = '7px monospace';
        ctx.fillText('1', -7, -2);
        ctx.fillText('0', 3, -2);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Draws Ghost Replay Frame of a previous run
   */
  private drawGhost(ghost: GhostFrame, tileSize: number) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.translate(ghost.posX, ghost.posY);
    
    // Draw trail pixels
    if (Math.random() < 0.3) {
      ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
      ctx.fillRect((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 4, 4);
    }

    // Ghost body - low opacity violet morphing core
    const pulse = Math.sin(this.animFrame * 0.08) * 1.5;
    ctx.fillStyle = 'rgba(155, 89, 182, 0.22)'; // semi transparent violet
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.45)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(0, 0, tileSize * 0.35 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Geometric lines inside ghost
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(-tileSize * 0.2, 0);
    ctx.lineTo(tileSize * 0.2, 0);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render particles
   */
  private drawParticles(particles: Particle[]) {
    const ctx = this.ctx;

    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;

      const alpha = p.life;
      ctx.globalAlpha = alpha;

      if (p.type === 'DEATH') {
        // Draw glitched tiny blocks or binary characters (0 and 1)
        ctx.font = `${Math.floor(p.size * 2)}px monospace`;
        ctx.fillText(Math.random() < 0.5 ? '0' : '1', 0, 0);
      } else if (p.type === 'EXPLOIT') {
        // Draw little squares
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        // Draw simple circular bits
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
    
    ctx.globalAlpha = 1.0;
  }

  /**
   * Apply screen scanlines, CRT vignetting, chromatic aberration row-shifts
   */
  private applyPostProcessing(tension: number, isGlitching: boolean) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Draw CRT Scanlines over the screen (Horizontal semi-transparent rows)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // 2. High threat flicker (glimmer of white noise)
    if (tension > 0.88 && Math.random() < 0.04) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Draw CRT Vignette Overlay (radial dark gradient toward corners)
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.85);
    
    // Vignette gets tighter and reddish during high threat (Colapso)
    const opacity = 0.5 + tension * 0.3;
    const innerColor = 'rgba(5, 5, 8, 0)';
    const outerColor = tension > 0.8 ? `rgba(139, 0, 0, ${opacity})` : `rgba(5, 5, 8, ${opacity})`;

    vignette.addColorStop(0, innerColor);
    vignette.addColorStop(1, outerColor);
    
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 4. Glitch horizontal bar shift overlay (Digital operating system failure)
    if (isGlitching && Math.random() < 0.2) {
      const sliceY = Math.random() * h;
      const sliceH = Math.random() * 40 + 10;
      const shiftX = (Math.random() - 0.5) * 30;
      
      ctx.drawImage(ctx.canvas, 0, sliceY, w, sliceH, shiftX, sliceY, w, sliceH);
    }
  }
}

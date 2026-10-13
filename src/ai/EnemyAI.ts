import { GridPos, EnemyState, PlayerState, Direction } from '../types';

export class EnemyAI {
  /**
   * Breadth-First Search pathfinder that returns the best next Direction to reach a target.
   * Restricts reversing direction to match classic Pac-Man movement patterns.
   */
  public static findNextDirection(
    grid: number[][],
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    currentDir: Direction,
    allowReverse: boolean = false
  ): Direction {
    const height = grid.length;
    const width = grid[0].length;
    
    // Valid movements
    const directions: { dir: Direction; dx: number; dy: number }[] = [
      { dir: 'UP', dx: 0, dy: -1 },
      { dir: 'DOWN', dx: 0, dy: 1 },
      { dir: 'LEFT', dx: -1, dy: 0 },
      { dir: 'RIGHT', dx: 1, dy: 0 }
    ];

    // Determine opposite direction to restrict it
    const opposite: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT',
      'NONE': 'NONE'
    };

    const forbiddenDir = allowReverse ? 'NONE' : opposite[currentDir];

    let bestDir = currentDir;
    let minDistance = Infinity;

    // Check all neighboring tiles (UP, DOWN, LEFT, RIGHT) from current tile
    for (const option of directions) {
      if (option.dir === forbiddenDir) continue; // No backtracking

      const nextX = startX + option.dx;
      const nextY = startY + option.dy;

      // Wrap around grid boundaries (tunnels)
      let wrappedX = nextX;
      if (wrappedX < 0) wrappedX = width - 1;
      else if (wrappedX >= width) wrappedX = 0;

      // Check boundary and solid wall blockages
      if (nextY >= 0 && nextY < height) {
        const tile = grid[nextY][wrappedX];
        if (tile !== 1) { // Walkable path, ghost cage, or warp gate
          // Calculate straight-line Euclidean distance to target from this adjacent tile
          const dist = Math.hypot(wrappedX - targetX, nextY - targetY);
          
          if (dist < minDistance) {
            minDistance = dist;
            bestDir = option.dir;
          }
        }
      }
    }

    return bestDir;
  }

  /**
   * Calculates the target tile and updates the next direction for a specific specter
   */
  public static updateSpecterAI(
    grid: number[][],
    specter: EnemyState,
    player: PlayerState,
    specterA: EnemyState | null
  ): Direction {
    const width = grid[0].length;
    const height = grid.length;

    // If vulnerable, flee to random corners or away from player
    if (specter.isVulnerable) {
      // Target opposite corner of player
      const targetX = player.gridX < width / 2 ? width - 2 : 1;
      const targetY = player.gridY < height / 2 ? height - 2 : 1;
      return this.findNextDirection(grid, specter.gridX, specter.gridY, targetX, targetY, specter.direction);
    }

    // Default target coords
    let targetX = player.gridX;
    let targetY = player.gridY;

    switch (specter.type) {
      case 'SPECTER_A': // Pursuer (Blinky): Targets player tile directly
        targetX = player.gridX;
        targetY = player.gridY;
        break;

      case 'SPECTER_B': // Ambush (Pinky): Target 4 tiles ahead of player's moving direction
        const offset = 4;
        if (player.direction === 'UP') {
          targetX = player.gridX - offset; // Original Pac-Man overflow offset emulation!
          targetY = player.gridY - offset;
        } else if (player.direction === 'DOWN') {
          targetY = player.gridY + offset;
        } else if (player.direction === 'LEFT') {
          targetX = player.gridX - offset;
        } else if (player.direction === 'RIGHT') {
          targetX = player.gridX + offset;
        }
        break;

      case 'SPECTER_C': // Swarm (Inky): Relative vector from Specter A to player
        if (specterA) {
          // Double the vector from Specter A to 2 tiles ahead of player
          let aheadX = player.gridX;
          let aheadY = player.gridY;
          if (player.direction === 'UP') {
            aheadX -= 2; aheadY -= 2;
          } else if (player.direction === 'DOWN') {
            aheadY += 2;
          } else if (player.direction === 'LEFT') {
            aheadX -= 2;
          } else if (player.direction === 'RIGHT') {
            aheadX += 2;
          }

          const vecX = aheadX - specterA.gridX;
          const vecY = aheadY - specterA.gridY;
          
          targetX = specterA.gridX + vecX * 2;
          targetY = specterA.gridY + vecY * 2;
        } else {
          // Fallback to player's tile
          targetX = player.gridX;
          targetY = player.gridY;
        }
        break;

      case 'SPECTER_D': // Chaotic (Clyde): Pursuit if far, scatter to bottom-left corner if near
        const distanceToPlayer = Math.hypot(specter.gridX - player.gridX, specter.gridY - player.gridY);
        if (distanceToPlayer > 8) {
          // Far enough: target player directly
          targetX = player.gridX;
          targetY = player.gridY;
        } else {
          // Too close: flee/scatter to Clyde's home corner (Bottom Left)
          targetX = 1;
          targetY = height - 2;
        }
        break;
    }

    // Clamp targets to grid boundaries to be safe
    targetX = Math.max(1, Math.min(width - 2, targetX));
    targetY = Math.max(1, Math.min(height - 2, targetY));

    return this.findNextDirection(grid, specter.gridX, specter.gridY, targetX, targetY, specter.direction);
  }
}

import { GridPos, MemoryFragment, LayerType } from '../types';

export interface MazeData {
  width: number;
  height: number;
  grid: number[][]; // 0: path, 1: wall, 2: warp gate, 3: ghost house
  fragments: MemoryFragment[];
  playerStart: GridPos;
  ghostSpawn: GridPos;
}

export class MazeGenerator {
  /**
   * Generates a fully connected symmetric maze for Void Crawler
   * @param size Grid width/height (should be odd)
   * @param density Percentage of walls (0 to 1)
   * @param exploitsCount Number of Kernel Exploits to place
   * @param warpCount Number of warp tunnel pairs
   */
  public static generate(
    size: number,
    density: number,
    exploitsCount: number,
    warpCount: number
  ): MazeData {
    const width = size;
    const height = size;
    
    // Initialize with empty paths
    const grid: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));

    // 1. Build surrounding outer walls
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          grid[y][x] = 1;
        }
      }
    }

    // 2. Create the central Ghost House (5x5, odd centered)
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    
    for (let y = midY - 2; y <= midY + 2; y++) {
      for (let x = midX - 2; x <= midX + 2; x++) {
        if (y === midY - 2 || y === midY + 2 || x === midX - 2 || x === midX + 2) {
          grid[y][x] = 1; // Wall of ghost house
        } else {
          grid[y][x] = 3; // Inside ghost house
        }
      }
    }
    // Create ghost house exit/gate at the top of the house
    grid[midY - 2][midX] = 0; // Walkable door
    grid[midY - 1][midX] = 3; // Inside

    // 3. Procedural Circuit-styled Symmetric Maze Generation
    // We populate only the left half, then mirror to the right half to ensure perfect arcade balance
    const halfW = Math.floor(width / 2);
    
    // Add horizontal and vertical divisions & block structures symmetrically
    // Based on grids we place block structures
    for (let y = 2; y < height - 2; y += 2) {
      for (let x = 2; x < halfW; x += 2) {
        // Skip ghost house area
        if (x >= midX - 3 && y >= midY - 3 && y <= midY + 3) {
          continue;
        }
        
        // Randomly draw a solid block or line segment
        if (Math.random() < density + 0.1) {
          grid[y][x] = 1;
          
          // Connect to adjacent walls to create neat corridors
          const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
          const dir = directions[Math.floor(Math.random() * directions.length)];
          
          const nx = x + dir[0];
          const ny = y + dir[1];
          if (nx > 0 && nx < halfW && ny > 0 && ny < height - 1) {
            // Don't overwrite ghost house
            if (grid[ny][nx] !== 3) {
              grid[ny][nx] = 1;
            }
          }
        }
      }
    }

    // 4. Ensure perfect symmetry (mirror left side to right side)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < halfW; x++) {
        // Check if inside ghost house: don't overwrite
        if (grid[y][x] === 3) continue;
        
        const mirrorX = width - 1 - x;
        grid[y][mirrorX] = grid[y][x];
      }
    }

    // 5. Build Warp Gates on sides (perimeter passages)
    // Always vertical centers or symmetric side tunnels
    const warpYPositions = [midY];
    if (warpCount > 1) {
      warpYPositions.push(Math.floor(height * 0.25) | 1); // Ensure odd index
      warpYPositions.push(Math.floor(height * 0.75) | 1);
    }
    
    // Apply warp gates
    const actualWarpY = warpYPositions.slice(0, warpCount);
    actualWarpY.forEach(wy => {
      grid[wy][0] = 2; // Warp gate Left
      grid[wy][width - 1] = 2; // Warp gate Right
      
      // Clear paths leading into warp gates
      grid[wy][1] = 0;
      grid[wy][width - 2] = 0;
    });

    // 6. Connect Verification: Ensure all walkable tiles are reachable from Player Start
    // If not, we carve paths. First, choose player start position.
    // Standard player start is at lower center: (midX, height - 3)
    let playerStart: GridPos = { x: midX, y: height - 3 };
    if (grid[playerStart.y][playerStart.x] === 1) {
      grid[playerStart.y][playerStart.x] = 0;
    }
    
    // Clean up player start surroundings
    grid[playerStart.y][playerStart.x - 1] = 0;
    grid[playerStart.y][playerStart.x + 1] = 0;

    // Validate connectivity and carve paths if any island is found
    this.ensureConnectivity(grid, width, height, playerStart);

    // 7. Distribute Memory Fragments & Kernel Exploits
    const fragments: MemoryFragment[] = [];
    let idCounter = 0;
    
    // Potential positions for Exploits (power pellets near corners)
    const corners = [
      { x: 2, y: 2 },
      { x: width - 3, y: 2 },
      { x: 2, y: height - 3 },
      { x: width - 3, y: height - 3 }
    ];

    // Mark corners as empty if walled
    corners.forEach(corner => {
      if (grid[corner.y][corner.x] === 1) {
        grid[corner.y][corner.x] = 0;
      }
    });

    const activeExploitPoints: GridPos[] = corners.slice(0, exploitsCount);

    // Populate paths with fragments
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Skip inside ghost house
        if (grid[y][x] === 3) continue;
        
        // Skip outer walls
        if (grid[y][x] === 1) continue;
        
        // Skip warp gates
        if (grid[y][x] === 2) continue;
        
        // Skip player exact starting square to give them breathing space
        if (Math.abs(x - playerStart.x) <= 1 && Math.abs(y - playerStart.y) <= 1) {
          continue;
        }

        const isExploit = activeExploitPoints.some(cp => cp.x === x && cp.y === y);
        
        fragments.push({
          x,
          y,
          collected: false,
          isExploit,
          id: `frag_${idCounter++}`
        });
      }
    }

    return {
      width,
      height,
      grid,
      fragments,
      playerStart,
      ghostSpawn: { x: midX, y: midY }
    };
  }

  /**
   * Breadth-First Search to verify all walkable tiles are in a single connected component.
   * If there are isolated pockets, carve connecting paths.
   */
  private static ensureConnectivity(grid: number[][], w: number, h: number, start: GridPos) {
    const visited: boolean[][] = Array(h).fill(null).map(() => Array(w).fill(false));
    const queue: GridPos[] = [start];
    visited[start.y][start.x] = true;
    
    let visitedCount = 1;
    let totalWalkable = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y][x] === 0 || grid[y][x] === 2) {
          totalWalkable++;
        }
      }
    }

    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      
      for (const d of dirs) {
        const nx = curr.x + d[0];
        const ny = curr.y + d[1];
        
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (!visited[ny][nx] && (grid[ny][nx] === 0 || grid[ny][nx] === 2)) {
            visited[ny][nx] = true;
            visitedCount++;
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    // If we didn't reach everything, carve routes
    if (visitedCount < totalWalkable) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if ((grid[y][x] === 0 || grid[y][x] === 2) && !visited[y][x]) {
            // It's isolated! Carve a path towards a visited cell
            let carved = false;
            for (let r = 1; r < 4 && !carved; r++) {
              for (const d of dirs) {
                const vx = x + d[0] * r;
                const vy = y + d[1] * r;
                if (vx > 0 && vx < w - 1 && vy > 0 && vy < h - 1) {
                  if (visited[vy][vx] && grid[vy][vx] === 0) {
                    // Carve between (x,y) and (vx,vy)
                    let cx = x;
                    let cy = y;
                    while (cx !== vx || cy !== vy) {
                      if (cx < vx) cx++;
                      else if (cx > vx) cx--;
                      if (cy < vy) cy++;
                      else if (cy > vy) cy--;
                      
                      if (grid[cy][cx] === 1) {
                        grid[cy][cx] = 0; // Make path
                      }
                    }
                    carved = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

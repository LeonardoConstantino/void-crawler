export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export interface GridPos {
  x: number;
  y: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export type GameState = 'MENU' | 'INTRO' | 'PLAYING' | 'GAMEOVER' | 'SUMMARY';

export type LayerType = 'RAM' | 'KERNEL' | 'BIOS';

export interface LayerConfig {
  type: LayerType;
  name: string;
  gridSize: number;
  wallDensity: number; // For maze generation
  warpGatesCount: number;
  exploitsCount: number;
  glitchInterval: number; // in ms
  ambientFreq: number;
  enemySpeed: number;
  enemyVulnerableSpeed: number;
}

export type EnemyType = 'SPECTER_A' | 'SPECTER_B' | 'SPECTER_C' | 'SPECTER_D';

export interface EnemyState {
  id: string;
  type: EnemyType;
  name: string;
  gridX: number;
  gridY: number;
  posX: number; // Canvas absolute X
  posY: number; // Canvas absolute Y
  direction: Direction;
  nextDirection: Direction;
  speed: number;
  color: string;
  isVulnerable: boolean; // Kernel Exploit active
  isDead: boolean;
  spawnTimer: number; // delay before active
  behaviorTimer: number;
}

export interface PlayerState {
  gridX: number;
  gridY: number;
  posX: number;
  posY: number;
  direction: Direction;
  nextDirection: Direction;
  speed: number;
  instances: number; // Lives
  maxInstances: number;
  integrity: number; // Score/percentage
  combo: number;
  comboTimer: number;
}

export interface MemoryFragment {
  x: number;
  y: number;
  collected: boolean;
  isExploit: boolean; // Power pellet
  id: string;
}

export interface GlitchEvent {
  type: 'WALL_VANISH' | 'SHUFFLE' | 'GRAVITY_INVERT' | 'WARP_TEMP';
  name: string;
  description: string;
  active: boolean;
  duration: number; // remaining duration in ms
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
  maxLife: number;
  type: 'COSMETIC' | 'COLLECT' | 'EXPLOIT' | 'DEATH' | 'WARP';
}

export interface GhostFrame {
  gridX: number;
  gridY: number;
  posX: number;
  posY: number;
  direction: Direction;
}

export interface GhostRun {
  timestamp: number;
  score: number;
  layer: LayerType;
  frames: GhostFrame[];
}

export interface ScoreRecord {
  id: string;
  date: string;
  layer: LayerType;
  integrity: number;
  score: number;
}

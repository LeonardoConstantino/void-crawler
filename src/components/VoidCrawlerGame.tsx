import React, { useEffect, useRef, useState } from 'react';
import { 
  GameState, 
  PlayerState, 
  EnemyState, 
  MemoryFragment, 
  Particle, 
  GlitchEvent, 
  Direction, 
  LayerType, 
  LayerConfig,
  GhostFrame,
  GhostRun,
  ScoreRecord
} from '../types';
import { audio } from '../audio/AudioEngine';
import { MazeGenerator, MazeData } from '../maze/MazeGenerator';
import { EnemyAI } from '../ai/EnemyAI';
import { GameRenderer } from '../renderer/GameRenderer';
import { Storage } from '../persistence/Storage';
import { Shield, Cpu, Activity, Volume2, VolumeX, RefreshCw, Layers, Award, Terminal as TerminalIcon, Skull } from 'lucide-react';

const TILE_SIZE = 24; // Must be divisible by speeds (e.g., 2, 3, 4)
const PLAYER_SPEED = 4; // Fast, responsive player core (24 / 4 = 6 frames per step)

const LAYERS_CONFIG: Record<LayerType, LayerConfig> = {
  RAM: {
    type: 'RAM',
    name: 'RAM Layer (Local Memory)',
    gridSize: 21,
    wallDensity: 0.32, // slightly less claustrophobic maze
    warpGatesCount: 1,
    exploitsCount: 4,
    glitchInterval: 20000,
    ambientFreq: 110,
    enemySpeed: 2, // Slower normal speed (12 frames per step)
    enemyVulnerableSpeed: 1 // Crawl speed when vulnerable (24 frames per step)
  },
  KERNEL: {
    type: 'KERNEL',
    name: 'Kernel Space (Operating OS)',
    gridSize: 27,
    wallDensity: 0.38,
    warpGatesCount: 2,
    exploitsCount: 4, // More power exploits to turn the tide!
    glitchInterval: 14000, // slightly more breathing room
    ambientFreq: 147,
    enemySpeed: 2, // Slower normal speed (12 frames per step)
    enemyVulnerableSpeed: 1
  },
  BIOS: {
    type: 'BIOS',
    name: 'BIOS Core (Basic Output)',
    gridSize: 33,
    wallDensity: 0.44,
    warpGatesCount: 3,
    exploitsCount: 3,
    glitchInterval: 10000, // more breathing room between glitch events
    ambientFreq: 82,
    enemySpeed: 3, // Standard normal speed (8 frames per step)
    enemyVulnerableSpeed: 2 // Crawl speed when vulnerable
  }
};

export default function VoidCrawlerGame() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [currentLayer, setCurrentLayer] = useState<LayerType>('RAM');
  const [integrityPercent, setIntegrityPercent] = useState<number>(0);
  const [instances, setInstances] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [ghostEchoActive, setGhostEchoActive] = useState<boolean>(false);
  const [activeGlitch, setActiveGlitch] = useState<GlitchEvent | null>(null);
  const [glitchTerminalMessage, setGlitchTerminalMessage] = useState<string>('SYSTEM RUNNING NOMINAL...');

  // Canvas and game loop refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Mutable game states for high speed loop (avoiding state lag)
  const gameData = useRef<{
    maze: MazeData | null;
    player: PlayerState | null;
    enemies: EnemyState[];
    particles: Particle[];
    fragments: MemoryFragment[];
    vulnerableTimer: number; // in ms
    glitchTimer: number; // time until next glitch in ms
    glitchEventTimer: number; // remaining active glitch duration in ms
    recordingGhost: GhostFrame[];
    replayingGhost: GhostFrame[] | null;
    replayIndex: number;
    collectedInLevel: number;
    totalInLevel: number;
    threatDistance: number; // nearest enemy distance 0 to 1
    currentConfig: LayerConfig | null;
  }>({
    maze: null,
    player: null,
    enemies: [],
    particles: [],
    fragments: [],
    vulnerableTimer: 0,
    glitchTimer: 0,
    glitchEventTimer: 0,
    recordingGhost: [],
    replayingGhost: null,
    replayIndex: 0,
    collectedInLevel: 0,
    totalInLevel: 0,
    threatDistance: 0,
    currentConfig: null
  });

  // Load Highscores initially
  useEffect(() => {
    setLeaderboard(Storage.getScores());
    audio.resume();
  }, []);

  // Handle key inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING' || !gameData.current.player) return;

      const p = gameData.current.player;
      
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          p.nextDirection = 'UP';
          break;
        case 'arrowdown':
        case 's':
          p.nextDirection = 'DOWN';
          break;
        case 'arrowleft':
        case 'a':
          p.nextDirection = 'LEFT';
          break;
        case 'arrowright':
        case 'd':
          p.nextDirection = 'RIGHT';
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Start the game run
  const initiateRun = (layerType: LayerType) => {
    audio.resume();
    audio.playStartJingle();
    setCurrentLayer(layerType);
    
    const config = LAYERS_CONFIG[layerType];
    const maze = MazeGenerator.generate(
      config.gridSize,
      config.wallDensity,
      config.exploitsCount,
      config.warpGatesCount
    );

    const totalFrags = maze.fragments.length;

    // Set player starting structure
    const player: PlayerState = {
      gridX: maze.playerStart.x,
      gridY: maze.playerStart.y,
      posX: maze.playerStart.x * TILE_SIZE + TILE_SIZE / 2,
      posY: maze.playerStart.y * TILE_SIZE + TILE_SIZE / 2,
      direction: 'NONE',
      nextDirection: 'NONE',
      speed: PLAYER_SPEED,
      instances: 3,
      maxInstances: 3,
      integrity: 0,
      combo: 1,
      comboTimer: 0
    };

    // Spawn 4 core enemies (Specters) with custom stats
    const enemyConfigs = [
      { type: 'SPECTER_A' as const, name: 'Blinky_Pursuer', color: '#ff4444', spawnDelay: 1000 },
      { type: 'SPECTER_B' as const, name: 'Pinky_Ambush', color: '#9b59b6', spawnDelay: 2500 },
      { type: 'SPECTER_C' as const, name: 'Inky_Swarm', color: '#1abc9c', spawnDelay: 4500 },
      { type: 'SPECTER_D' as const, name: 'Clyde_Chaotic', color: '#f39c12', spawnDelay: 6000 }
    ];

    const enemies: EnemyState[] = enemyConfigs.map((cfg) => ({
      id: `enemy_${cfg.type}`,
      type: cfg.type,
      name: cfg.name,
      gridX: maze.ghostSpawn.x,
      gridY: maze.ghostSpawn.y,
      posX: maze.ghostSpawn.x * TILE_SIZE + TILE_SIZE / 2,
      posY: maze.ghostSpawn.y * TILE_SIZE + TILE_SIZE / 2,
      direction: 'UP',
      nextDirection: 'UP',
      speed: config.enemySpeed,
      color: cfg.color,
      isVulnerable: false,
      isDead: false,
      spawnTimer: cfg.spawnDelay,
      behaviorTimer: 0
    }));

    // Reset loop mutable reference values
    gameData.current = {
      maze,
      player,
      enemies,
      particles: [],
      fragments: maze.fragments,
      vulnerableTimer: 0,
      glitchTimer: config.glitchInterval, // starting cooldown
      glitchEventTimer: 0,
      recordingGhost: [],
      replayingGhost: null,
      replayIndex: 0,
      collectedInLevel: 0,
      totalInLevel: totalFrags,
      threatDistance: 0,
      currentConfig: config
    };

    // Load specter Ghost replay if exists
    const ghost = Storage.getGhostRunForLayer(layerType);
    if (ghost) {
      gameData.current.replayingGhost = ghost.frames;
      setGhostEchoActive(true);
    } else {
      setGhostEchoActive(false);
    }

    setInstances(3);
    setScore(0);
    setCombo(1);
    setIntegrityPercent(0);
    setGlitchTerminalMessage('INITIATING SUBPROCESS: STATUS SAFE');
    setActiveGlitch(null);
    setGameState('INTRO');
  };

  const startPlaying = () => {
    setGameState('PLAYING');
  };

  // Main high frequency game ticking frame loop
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new GameRenderer(ctx);
    
    // Resize to fit the grid perfectly
    const gridW = gameData.current.maze?.width || 21;
    const gridH = gameData.current.maze?.height || 21;
    canvas.width = gridW * TILE_SIZE;
    canvas.height = gridH * TILE_SIZE;
    rendererRef.current.setDimensions(canvas.width, canvas.height);

    let lastTime = performance.now();

    const gameLoop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      update(dt);
      draw();

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  // Handle simulation updates
  const update = (dt: number) => {
    const data = gameData.current;
    if (!data.player || !data.maze) return;

    const player = data.player;
    const grid = data.maze.grid;
    const w = data.maze.width;
    const h = data.maze.height;

    // 1. Particle life simulation
    data.particles = data.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 16 / p.maxLife; // speed of decay
      return p.life > 0;
    });

    // 2. Glitch Events cooldown tracker
    if (data.glitchEventTimer > 0) {
      data.glitchEventTimer -= dt;
      if (data.glitchEventTimer <= 0) {
        // End active glitch
        setActiveGlitch(null);
        setGlitchTerminalMessage('GLITCH EVENT SOLVED. INTEGRITY RECOVERED.');
      }
    } else {
      data.glitchTimer -= dt;
      if (data.glitchTimer <= 0) {
        triggerGlitchEvent();
      }
    }

    // 3. Vulnerable active power-up counter
    if (data.vulnerableTimer > 0) {
      data.vulnerableTimer -= dt;
      if (data.vulnerableTimer <= 0) {
        audio.setVulnerableTheme(false);
        data.enemies.forEach(e => {
          e.isVulnerable = false;
        });
      }
    }

    // 4. Update Ghost frame indexing
    if (data.replayingGhost && data.replayingGhost.length > 0) {
      data.replayIndex = (data.replayIndex + 1) % data.replayingGhost.length;
    }

    // 5. Grid alignment snapping player movement (Lock step grid slide)
    updateEntityMovement(player, grid, w, h, true);

    // Record player frames for saving ghosts
    data.recordingGhost.push({
      gridX: player.gridX,
      gridY: player.gridY,
      posX: player.posX,
      posY: player.posY,
      direction: player.direction
    });

    // 6. Memory collection detection
    const onTileX = Math.floor(player.posX / TILE_SIZE);
    const onTileY = Math.floor(player.posY / TILE_SIZE);

    const activeVanish = activeGlitch?.active && activeGlitch.type === 'WALL_VANISH';

    data.fragments.forEach(frag => {
      if (!frag.collected && frag.x === onTileX && frag.y === onTileY) {
        frag.collected = true;
        data.collectedInLevel++;
        
        // Accumulate Combo streak
        player.comboTimer = 3000; // 3 seconds streak buffer
        setCombo(prev => prev + 1);

        // Core score points calculation
        const points = (frag.isExploit ? 100 : 10) * combo;
        setScore(prev => prev + points);

        // Visual collection debris
        spawnCollectParticles(cx(frag.x), cy(frag.y), frag.isExploit ? '#00f5ff' : '#f0e68c');

        if (frag.isExploit) {
          // Trigger Kernel Exploit vulnerable state
          data.vulnerableTimer = 8000; // 8 seconds of pure power
          audio.playExploitActive();
          audio.setVulnerableTheme(true);
          data.enemies.forEach(e => {
            if (!e.isDead) {
              e.isVulnerable = true;
            }
          });
          spawnExploitRing(player.posX, player.posY);
          setGlitchTerminalMessage('KERNEL EXPLOIT INJECTED // HOSTILE PROCESSES INHIBITED');
        } else {
          audio.playCollect(false);
        }

        // recalculate system integrity
        const integrity = Math.min(100, Math.floor((data.collectedInLevel / data.totalInLevel) * 100));
        setIntegrityPercent(integrity);

        // LEVEL COMPLETE TRIGGER (All fragments consumed)
        if (data.collectedInLevel >= data.totalInLevel) {
          handleLevelVictory();
        }
      }
    });

    // Combo streak decay
    if (player.comboTimer > 0) {
      player.comboTimer -= dt;
      if (player.comboTimer <= 0) {
        setCombo(1);
      }
    }

    // 7. Update Specters AI movement
    let nearestEnemyDist = Infinity;
    const playerX = player.posX;
    const playerY = player.posY;

    const specterA = data.enemies.find(e => e.type === 'SPECTER_A') || null;

    data.enemies.forEach(enemy => {
      // Spawn timer counter
      if (enemy.spawnTimer > 0) {
        enemy.spawnTimer -= dt;
        return; // wait in ghost house cage
      }

      // Set speed based on vulnerability and layer config
      const normalSpeed = data.currentConfig?.enemySpeed ?? 2;
      const vulnerableSpeed = data.currentConfig?.enemyVulnerableSpeed ?? 1;
      enemy.speed = enemy.isVulnerable ? vulnerableSpeed : normalSpeed;

      // Check grid slide updates
      updateEntityMovement(enemy, grid, w, h, false, specterA);

      // Track distance to calculate real-time sound threat levels
      if (!enemy.isDead && !enemy.isVulnerable) {
        const dist = Math.hypot(enemy.posX - playerX, enemy.posY - playerY);
        if (dist < nearestEnemyDist) {
          nearestEnemyDist = dist;
        }
      }

      // 8. Collision detection with player
      const collisionThreshold = TILE_SIZE * 0.7;
      if (!enemy.isDead && Math.hypot(enemy.posX - playerX, enemy.posY - playerY) < collisionThreshold) {
        if (enemy.isVulnerable) {
          // Devour vulnerable enemy!
          enemy.isDead = true;
          enemy.spawnTimer = 6000; // reset respawn cage delay
          enemy.posX = mazeSpawnX();
          enemy.posY = mazeSpawnY();
          enemy.gridX = data.maze!.ghostSpawn.x;
          enemy.gridY = data.maze!.ghostSpawn.y;
          enemy.isVulnerable = false;
          
          audio.playCollect(true);
          setScore(prev => prev + 500 * combo);
          spawnCollectParticles(enemy.posX, enemy.posY, '#ffffff', 18);
          setGlitchTerminalMessage('HOSTILE PROCESS OVERWRITTEN // MEMORY FREED');
        } else {
          // Player hit!
          handlePlayerHit();
        }
      }
    });

    // Modulate Generative Synth Tension based on closest threats (max distance of 300 pixels)
    const normalizedThreat = 1 - Math.min(Math.max(nearestEnemyDist, 0) / 300, 1);
    audio.updateTension(normalizedThreat);
  };

  // Snapped grid sliding mechanism (lock step slide translation)
  const updateEntityMovement = (
    ent: PlayerState | EnemyState,
    grid: number[][],
    w: number,
    h: number,
    isPlayer: boolean,
    specterA: EnemyState | null = null
  ) => {
    const isAtCenter = ent.posX === cx(ent.gridX) && ent.posY === cy(ent.gridY);
    
    // Check if Wall Vanish glitch event is active (makes all cells walkable)
    const isVanishActive = activeGlitch?.active && activeGlitch.type === 'WALL_VANISH';

    const checkWalkable = (gx: number, gy: number): boolean => {
      if (gy < 0 || gy >= h) return false;
      
      // Wrap around grid tunnels
      let wrappedX = gx;
      if (wrappedX < 0) wrappedX = w - 1;
      else if (wrappedX >= w) wrappedX = 0;

      const cell = grid[gy][wrappedX];
      if (isVanishActive) return true; // everything passable
      return cell !== 1; // Can't walk in solid blocks
    };

    if (isAtCenter) {
      // Determine next path step
      if (isPlayer) {
        const p = ent as PlayerState;
        
        // Apply Gravity Invert glitch causing inverted steering controls
        if (activeGlitch?.active && activeGlitch.type === 'GRAVITY_INVERT') {
          const invertMap: Record<Direction, Direction> = {
            'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT', 'NONE': 'NONE'
          };
          p.nextDirection = invertMap[p.nextDirection] || p.nextDirection;
        }

        const nextX = p.gridX + dx(p.nextDirection);
        const nextY = p.gridY + dy(p.nextDirection);

        if (p.nextDirection !== 'NONE' && checkWalkable(nextX, nextY)) {
          p.direction = p.nextDirection;
        }
      } else {
        const enemy = ent as EnemyState;
        // Compute optimal path via AI systems
        const nextDir = EnemyAI.updateSpecterAI(grid, enemy, gameData.current.player!, specterA);
        enemy.direction = nextDir;
      }

      // Check boundary blocks in current direction
      const nextX = ent.gridX + dx(ent.direction);
      const nextY = ent.gridY + dy(ent.direction);

      if (ent.direction !== 'NONE' && checkWalkable(nextX, nextY)) {
        // Prepare interpolation steps
        ent.gridX = nextX;
        ent.gridY = nextY;
        
        // Wrap around tunnels (Warp gates)
        if (ent.gridX < 0) ent.gridX = w - 1;
        else if (ent.gridX >= w) ent.gridX = 0;
      } else {
        ent.direction = 'NONE';
      }
    }

    // Interpolate pixel position smoothly towards current targeted grid coordinates
    if (ent.direction !== 'NONE') {
      const destX = cx(ent.gridX);
      const destY = cy(ent.gridY);

      // Interpolate X
      if (ent.posX < destX) {
        ent.posX = Math.min(ent.posX + ent.speed, destX);
      } else if (ent.posX > destX) {
        ent.posX = Math.max(ent.posX - ent.speed, destX);
      }

      // Interpolate Y
      if (ent.posY < destY) {
        ent.posY = Math.min(ent.posY + ent.speed, destY);
      } else if (ent.posY > destY) {
        ent.posY = Math.max(ent.posY - ent.speed, destY);
      }
    }
  };

  // Helper conversions
  const cx = (gridX: number) => gridX * TILE_SIZE + TILE_SIZE / 2;
  const cy = (gridY: number) => gridY * TILE_SIZE + TILE_SIZE / 2;
  const dx = (dir: Direction) => dir === 'LEFT' ? -1 : dir === 'RIGHT' ? 1 : 0;
  const dy = (dir: Direction) => dir === 'UP' ? -1 : dir === 'DOWN' ? 1 : 0;
  const mazeSpawnX = () => (gameData.current.maze?.ghostSpawn.x || 10) * TILE_SIZE + TILE_SIZE / 2;
  const mazeSpawnY = () => (gameData.current.maze?.ghostSpawn.y || 10) * TILE_SIZE + TILE_SIZE / 2;

  // Render trigger
  const draw = () => {
    const r = rendererRef.current;
    const data = gameData.current;
    if (!r || !data.maze || !data.player) return;

    // Get active ghost frames
    let currentGhostFrame: GhostFrame | null = null;
    if (data.replayingGhost && data.replayingGhost.length > 0) {
      currentGhostFrame = data.replayingGhost[data.replayIndex];
    }

    r.render(
      data.maze.grid,
      data.player,
      data.enemies,
      data.fragments,
      data.particles,
      activeGlitch,
      currentGhostFrame,
      TILE_SIZE,
      data.threatDistance,
      data.vulnerableTimer > 0
    );
  };

  // Glitch events triggering
  const triggerGlitchEvent = () => {
    const glitches: GlitchEvent['type'][] = ['WALL_VANISH', 'SHUFFLE', 'GRAVITY_INVERT', 'WARP_TEMP'];
    const chosenType = glitches[Math.floor(Math.random() * glitches.length)];
    const config = LAYERS_CONFIG[currentLayer];

    let name = '';
    let description = '';

    switch (chosenType) {
      case 'WALL_VANISH':
        name = 'DEFRAGMENT_FAILURE // COLLAPSED_WALLS';
        description = 'Todas as paredes do labirinto tornam-se corredores temporários!';
        break;
      case 'SHUFFLE':
        name = 'MEM_SHUFFLE_INTERRUPT // FRAGMENTS_RELOCATED';
        description = 'Os fragmentos restantes foram movidos para posições aleatórias!';
        // Implement shuffle logic
        const openTiles: {x: number, y: number}[] = [];
        const grid = gameData.current.maze!.grid;
        for (let y = 1; y < grid.length - 1; y++) {
          for (let x = 1; x < grid[0].length - 1; x++) {
            if (grid[y][x] === 0) openTiles.push({x, y});
          }
        }
        gameData.current.fragments.forEach(frag => {
          if (!frag.collected && openTiles.length > 0) {
            const randIdx = Math.floor(Math.random() * openTiles.length);
            const chosen = openTiles.splice(randIdx, 1)[0];
            frag.x = chosen.x;
            frag.y = chosen.y;
          }
        });
        break;
      case 'GRAVITY_INVERT':
        name = 'VECTOR_BUS_INVERSION // DIRECTIONAL_FLIP';
        description = 'Os comandos direcionais do teclado foram invertidos!';
        break;
      case 'WARP_TEMP':
        name = 'GATE_LEAK // TEMPORARY_PORTALS_OPEN';
        description = 'Novos canais de dobra surgiram no centro do mapa!';
        // Temp portals on center lanes
        const m = gameData.current.maze!;
        m.grid[1][Math.floor(m.width / 2)] = 2; // temporary portal top
        m.grid[m.height - 2][Math.floor(m.width / 2)] = 2; // bottom
        break;
    }

    const event: GlitchEvent = {
      type: chosenType,
      name,
      description,
      active: true,
      duration: 6000 // 6 seconds duration
    };

    setActiveGlitch(event);
    setGlitchTerminalMessage(`WARNING: ${name}`);
    audio.playGlitch();

    gameData.current.glitchEventTimer = 6000;
    gameData.current.glitchTimer = config.glitchInterval; // reset cooldown
  };

  // Player gets hit by specters
  const handlePlayerHit = () => {
    const data = gameData.current;
    if (!data.player) return;

    data.player.instances--;
    setInstances(data.player.instances);
    audio.playDamage();
    setCombo(1);

    // Blast particles of impact
    spawnCollectParticles(data.player.posX, data.player.posY, '#ff0000', 30, 'DEATH');

    if (data.player.instances <= 0) {
      handleGameOver();
    } else {
      // Soft reset positions (Flicker/Respawn effect)
      setGlitchTerminalMessage('INSTANCE CRASH DETECTED // REALLOCATING ADDRESS CODES...');
      
      data.player.posX = cx(data.maze!.playerStart.x);
      data.player.posY = cy(data.maze!.playerStart.y);
      data.player.gridX = data.maze!.playerStart.x;
      data.player.gridY = data.maze!.playerStart.y;
      data.player.direction = 'NONE';
      data.player.nextDirection = 'NONE';

      data.enemies.forEach(e => {
        e.posX = mazeSpawnX();
        e.posY = mazeSpawnY();
        e.gridX = data.maze!.ghostSpawn.x;
        e.gridY = data.maze!.ghostSpawn.y;
        e.direction = 'UP';
        e.nextDirection = 'UP';
        e.isVulnerable = false;
        e.isDead = false;
        // set individual minor delays
        e.spawnTimer = e.type === 'SPECTER_A' ? 1000 : e.type === 'SPECTER_B' ? 2500 : 4000;
      });
    }
  };

  const handleGameOver = () => {
    setGameState('GAMEOVER');
    audio.playDamage();
    // Save high score if relevant
    Storage.saveScore({
      layer: currentLayer,
      integrity: integrityPercent,
      score: score
    });
    setLeaderboard(Storage.getScores());
  };

  const handleLevelVictory = () => {
    setGameState('SUMMARY');
    audio.playExploitActive();

    // Save successful Ghost Replay
    if (gameData.current.recordingGhost.length > 0) {
      Storage.saveGhostRun({
        timestamp: Date.now(),
        score: score,
        layer: currentLayer,
        frames: gameData.current.recordingGhost
      });
    }

    // Save leaderboard record
    Storage.saveScore({
      layer: currentLayer,
      integrity: 100,
      score: score + 1000 // Victory bonus points
    });
    setLeaderboard(Storage.getScores());
  };

  // Particles generator helpers
  const spawnCollectParticles = (x: number, y: number, color: string, count = 10, type: Particle['type'] = 'COLLECT') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      gameData.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 2 + 1,
        life: 1.0,
        maxLife: Math.random() * 300 + 200,
        type
      });
    }
  };

  const spawnExploitRing = (x: number, y: number) => {
    const num = 24;
    for (let i = 0; i < num; i++) {
      const angle = (i * Math.PI * 2) / num;
      gameData.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        color: '#00f5ff',
        size: 3,
        life: 1.0,
        maxLife: 400,
        type: 'EXPLOIT'
      });
    }
  };

  const resetAllScores = () => {
    Storage.clearAll();
    setLeaderboard([]);
    setGhostEchoActive(false);
    gameData.current.replayingGhost = null;
  };

  // Toggle Mute Audio
  const handleToggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div id="void-crawler-root" className="min-h-screen bg-[#07070a] text-[#c9d1d9] flex flex-col font-mono relative overflow-hidden select-none">
      
      {/* GLITCH SCANLINE BG LAYER */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(16,16,24,0)_0%,rgba(5,5,8,0.85)_100%)] z-10" />

      {/* HEADER BAR */}
      <header className="border-b border-[#1b1b2a] bg-[#0c0c14] px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <Activity className="text-[#00f5ff] h-5 w-5 animate-pulse" />
          <h1 className="text-lg font-bold tracking-widest text-[#ffffff] flex items-center">
            VOID <span className="text-[#9b59b6] ml-1">CRAWLER</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="hidden md:flex items-center space-x-2 border border-[#1b1b3a] px-3 py-1 bg-[#09090f]">
            <span className="text-gray-500">HOSTILE ECHO:</span>
            <span className={ghostEchoActive ? "text-[#9b59b6]" : "text-gray-600"}>
              {ghostEchoActive ? "STABLE REPLAY (ACTIVE)" : "NO ECHO TARGETS"}
            </span>
          </div>

          <button 
            onClick={handleToggleMute}
            className="p-1.5 border border-[#1b1b2a] hover:bg-[#151524] text-gray-400 hover:text-white transition"
            title="Toggle Mute Synthesizer"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-[#00f5ff]" />}
          </button>
        </div>
      </header>

      {/* CORE DISPLAY STAGE */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 items-center justify-center z-20">
        
        {/* LEFT COLUMN: CONTEXT METRICS */}
        {gameState !== 'MENU' && (
          <div className="w-full lg:w-72 flex flex-col gap-3 self-stretch justify-between">
            {/* TERMINAL ADAPTER */}
            <div className="border border-[#1b1b3a] bg-[#09090f] p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 border-b border-[#1b1b2a] pb-2 mb-3">
                  <TerminalIcon className="text-[#00f5ff] h-4 w-4" />
                  <span className="text-xs font-semibold tracking-wider text-white">SYSTEM BUS METRICS</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-gray-500 block">CURRENT LAYER LAYER</span>
                    <span className="text-white font-bold">{LAYERS_CONFIG[currentLayer].name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">HOST PROCESS STATE</span>
                    <span className={`font-bold uppercase ${activeGlitch ? 'text-red-500 animate-pulse' : 'text-[#00f5ff]'}`}>
                      {activeGlitch ? activeGlitch.name : 'STATE INTEGRAL'}
                    </span>
                  </div>
                  {activeGlitch && (
                    <div className="border border-red-900/40 bg-red-950/20 p-2 text-[10px] text-red-300">
                      {activeGlitch.description}
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE TERMINAL FEED */}
              <div className="mt-4 pt-3 border-t border-[#1b1b2a] text-[10px] text-gray-500 font-mono h-24 overflow-hidden flex flex-col justify-end">
                <div className="text-gray-600">&gt;_ sys_com_pipe open</div>
                <div className="text-gray-600">&gt;_ memory_allocation: complete</div>
                <div className="text-[#9b59b6] animate-pulse">&gt;_ {glitchTerminalMessage}</div>
              </div>
            </div>

            {/* STATUS CARDS */}
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
              <div className="border border-[#1b1b3a] bg-[#09090f] p-3 text-center lg:text-left flex items-center lg:space-x-3">
                <Shield className="text-[#00f5ff] h-5 w-5 hidden lg:block" />
                <div>
                  <span className="text-[10px] text-gray-500 block">MEM INTEGRITY</span>
                  <span className="text-lg font-bold text-white tracking-widest">{integrityPercent}%</span>
                </div>
              </div>
              
              <div className="border border-[#1b1b3a] bg-[#09090f] p-3 text-center lg:text-left flex items-center lg:space-x-3">
                <Cpu className="text-[#9b59b6] h-5 w-5 hidden lg:block" />
                <div>
                  <span className="text-[10px] text-gray-500 block">LIVES SOCKETS</span>
                  <div className="flex space-x-1 justify-center lg:justify-start mt-1">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-2.5 w-2.5 rounded-full border border-black ${idx < instances ? 'bg-green-400 shadow-[0_0_5px_#2ecc71]' : 'bg-gray-800'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-[#1b1b3a] bg-[#09090f] p-3 text-center lg:text-left flex items-center lg:space-x-3">
                <Award className="text-[#f1c40f] h-5 w-5 hidden lg:block" />
                <div>
                  <span className="text-[10px] text-gray-500 block">ACCUMULATOR</span>
                  <span className="text-sm font-bold text-white tracking-widest">{score.toLocaleString()} PTS</span>
                  {combo > 1 && (
                    <span className="text-[10px] text-red-400 block animate-pulse">MULTIPLIER: x{combo}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CENTER COLUMN: MAIN VIEW STAGE */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-full">
          
          {/* MENU SCREEN */}
          {gameState === 'MENU' && (
            <div className="w-full max-w-xl border border-[#1b1b3a] bg-[#090914] p-8 text-center flex flex-col items-center">
              <div className="mb-6">
                <Cpu className="text-[#00f5ff] h-12 w-12 mx-auto animate-pulse mb-3" />
                <h2 className="text-2xl font-bold tracking-widest text-white">VOID CRAWLER</h2>
                <p className="text-xs text-gray-400 mt-2">Roguelike de exploração retro-generativa em labirinto procedural</p>
              </div>

              <div className="w-full bg-[#050508] border border-[#1b1b2a] p-4 text-xs text-left text-gray-400 mb-6 space-y-2">
                <p className="text-white font-semibold flex items-center">
                  <TerminalIcon className="h-3.5 w-3.5 mr-2 text-[#9b59b6]" />
                  ASSINATURA DE CONTROLE:
                </p>
                <p>• Use as Teclas <span className="text-white font-bold">W, A, S, D</span> ou as <span className="text-white font-bold">Setas Direcionais</span> para mover o núcleo de dados.</p>
                <p>• Colete <span className="text-[#f0e68c] font-bold">Pedaços de Memória (Pontos Amarelos)</span> para aumentar a Integridade do Sistema.</p>
                <p>• Evite <span className="text-red-400 font-bold">Processos Corrompidos (Specters)</span> que caçam você implacavelmente.</p>
                <p>• Colete <span className="text-[#00f5ff] font-bold">Kernel Exploits (Estrelas Azuis)</span> para expor e desintegrar temporariamente os Specters.</p>
                <p>• Seus replays bem-sucedidos anteriores aparecem como <span className="text-[#9b59b6] font-bold">Fantasmas de Dados</span> assíncronos na próxima run.</p>
              </div>

              <div className="w-full space-y-3 mb-6">
                <span className="text-xs text-gray-500 block uppercase tracking-wider">SELECIONE O LAYER DO SISTEMA OPERACIONAL</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button 
                    onClick={() => initiateRun('RAM')}
                    className="border border-[#1abc9c] hover:bg-[#1abc9c]/10 text-[#1abc9c] px-4 py-3 font-semibold text-xs tracking-wider transition"
                  >
                    RAM LAYER
                    <span className="text-[10px] block text-gray-400 font-normal mt-1">21x21 - Iniciante</span>
                  </button>
                  <button 
                    onClick={() => initiateRun('KERNEL')}
                    className="border border-[#9b59b6] hover:bg-[#9b59b6]/10 text-[#9b59b6] px-4 py-3 font-semibold text-xs tracking-wider transition"
                  >
                    KERNEL SPACE
                    <span className="text-[10px] block text-gray-400 font-normal mt-1">27x27 - Moderado</span>
                  </button>
                  <button 
                    onClick={() => initiateRun('BIOS')}
                    className="border border-[#f39c12] hover:bg-[#f39c12]/10 text-[#f39c12] px-4 py-3 font-semibold text-xs tracking-wider transition"
                  >
                    BIOS CORE
                    <span className="text-[10px] block text-gray-400 font-normal mt-1">33x33 - Extremo</span>
                  </button>
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="w-full border-t border-[#1b1b2a] pt-4 text-left">
                  <span className="text-xs text-gray-500 font-bold block mb-2 tracking-wider flex items-center">
                    <Award className="h-4 w-4 mr-1 text-yellow-500" /> HISTÓRICO DE INTEGRANTES (LEADERBOARD):
                  </span>
                  <div className="bg-[#050508] p-3 max-h-36 overflow-y-auto text-xs space-y-1.5 border border-[#1b1b2a]">
                    {leaderboard.map((item, index) => (
                      <div key={item.id} className="flex justify-between items-center text-gray-400">
                        <span>
                          {index + 1}. <span className="text-white font-bold">{item.layer}</span> - {item.date}
                        </span>
                        <span className="text-[#00f5ff] font-bold">
                          {item.score} PTS ({item.integrity}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={resetAllScores}
                    className="text-[10px] text-red-400 hover:underline mt-2 flex items-center"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Apagar banco de dados e registros
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INTRO SCREEN */}
          {gameState === 'INTRO' && (
            <div className="w-full max-w-lg border border-[#1b1b3a] bg-[#090914] p-8 text-center flex flex-col items-center">
              <Layers className="text-[#9b59b6] h-10 w-10 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-white tracking-widest uppercase">CARREGANDO INSTÂNCIA DO LAYER</h3>
              <p className="text-xs text-gray-400 mt-2 italic">“A máquina está tentando lembrar deste endereço de dados...”</p>

              <div className="w-full my-6 p-4 bg-[#050508] border border-[#1b1b2a] text-left text-xs space-y-3">
                <div>
                  <span className="text-gray-500">Mapeamento Geométrico:</span>
                  <span className="text-[#00f5ff] font-bold ml-1">
                    {LAYERS_CONFIG[currentLayer].gridSize} x {LAYERS_CONFIG[currentLayer].gridSize} Circuit Grid
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Intensidade de Resistência:</span>
                  <span className="text-[#00f5ff] font-bold ml-1">
                    {LAYERS_CONFIG[currentLayer].wallDensity * 100}% densidade de barreira
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Fantasmas de Sessão Reconstruídos:</span>
                  <span className="text-[#9b59b6] font-bold ml-1">
                    {ghostEchoActive ? "Sincronizado via Echo.dat" : "Nenhum Ghost Data encontrado"}
                  </span>
                </div>
              </div>

              <button 
                onClick={startPlaying}
                className="w-full bg-white text-black font-bold py-3 text-xs tracking-widest hover:bg-gray-200 transition"
              >
                SINALIZAR READY & CARREGAR PROCESSO
              </button>
            </div>
          )}

          {/* CANVAS STAGE VIEWPORTS */}
          {gameState === 'PLAYING' && (
            <div className="border-4 border-[#1b1b3a] bg-[#050508] relative group select-none shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              {/* VINTAGE CRT SHADOW GRID */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.3)_100%)] z-10" />
              <canvas 
                ref={canvasRef} 
                className="block max-w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          )}

          {/* SUMMARY / LEVEL VICTORY SCREEN */}
          {gameState === 'SUMMARY' && (
            <div className="w-full max-w-md border border-[#2ecc71] bg-[#090914] p-8 text-center flex flex-col items-center">
              <Cpu className="text-green-400 h-12 w-12 animate-pulse mb-3" />
              <h2 className="text-xl font-bold tracking-widest text-[#2ecc71]">INTEGRIDADE ADQUIRIDA (100%)</h2>
              <p className="text-xs text-gray-400 mt-1">Todos os fragmentos de memória foram assimilados com sucesso!</p>

              <div className="w-full bg-[#050508] border border-[#1b1b2a] my-6 p-4 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">LAYER SOLVIDO:</span>
                  <span className="text-white font-bold">{currentLayer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ACÚMULO DE SESSÃO:</span>
                  <span className="text-[#00f5ff] font-bold">{score} PONTOS</span>
                </div>
                <div className="flex justify-between text-[#9b59b6]">
                  <span>GHOST ECHO SALVO:</span>
                  <span className="font-bold">SUCESSO (MEM_TRACE_REPLAY)</span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => initiateRun(currentLayer)}
                  className="bg-green-500 hover:bg-green-600 text-black font-bold py-3 text-xs tracking-widest transition"
                >
                  REPETIR RUN NESSE LAYER
                </button>
                <button 
                  onClick={() => setGameState('MENU')}
                  className="border border-[#1b1b3a] hover:bg-[#151524] text-white py-3 text-xs tracking-widest transition"
                >
                  VOLTAR AO MENU PRINCIPAL
                </button>
              </div>
            </div>
          )}

          {/* GAMEOVER SCREEN */}
          {gameState === 'GAMEOVER' && (
            <div className="w-full max-w-md border border-red-900 bg-[#090914] p-8 text-center flex flex-col items-center">
              <Skull className="text-red-500 h-12 w-12 mb-3" />
              <h2 className="text-xl font-bold tracking-widest text-red-500 uppercase">PROCESSO TERMINADO</h2>
              <p className="text-xs text-gray-400 mt-1">A instância sofreu um despejo de memória completo.</p>

              <div className="w-full bg-[#050508] border border-[#1b1b2a] my-6 p-4 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">INTEGRIDADE RESTANTE:</span>
                  <span className="text-white font-bold">{integrityPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ACÚMULO FINAL:</span>
                  <span className="text-[#00f5ff] font-bold">{score} PONTOS</span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => initiateRun(currentLayer)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-xs tracking-widest transition"
                >
                  REINICIALIZAR INSTÂNCIA
                </button>
                <button 
                  onClick={() => setGameState('MENU')}
                  className="border border-[#1b1b3a] hover:bg-[#151524] text-white py-3 text-xs tracking-widest transition"
                >
                  VOLTAR AO MENU PRINCIPAL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: GHOST LOGS & CONTROLS SCREEN */}
        {gameState === 'PLAYING' && (
          <div className="w-full lg:w-72 border border-[#1b1b3a] bg-[#09090f] p-4 flex flex-col justify-between self-stretch">
            <div>
              <div className="flex items-center space-x-2 border-b border-[#1b1b2a] pb-2 mb-3">
                <Cpu className="text-[#9b59b6] h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider text-white">ACTIVE PROCESS MONITOR</span>
              </div>

              <div className="space-y-4 text-xs">
                {gameData.current.enemies.map(enemy => (
                  <div key={enemy.id} className="border border-[#151524] p-2 bg-[#0c0c14]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold" style={{ color: enemy.color }}>
                        {enemy.name.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        enemy.spawnTimer > 0 ? 'bg-yellow-950/40 text-yellow-400' :
                        enemy.isDead ? 'bg-red-950/40 text-red-400' :
                        enemy.isVulnerable ? 'bg-blue-950/40 text-blue-400' :
                        'bg-green-950/40 text-green-400'
                      }`}>
                        {enemy.spawnTimer > 0 ? 'SPAWNING' :
                         enemy.isDead ? 'FLUSHED' :
                         enemy.isVulnerable ? 'FAILSAFE' :
                         'ACTIVE'}
                      </span>
                    </div>
                    <div className="w-full bg-[#050508] h-1.5 mt-1">
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: enemy.spawnTimer > 0 ? `${(1 - enemy.spawnTimer / 6000) * 100}%` : '100%',
                          backgroundColor: enemy.isVulnerable ? '#3498db' : enemy.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#1b1b2a] text-center">
              <span className="text-[10px] text-gray-500 block uppercase">CONTROLES MÓVEIS / D-PAD</span>
              <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto mt-2">
                <div />
                <button 
                  onClick={() => { if(gameData.current.player) gameData.current.player.nextDirection = 'UP'; }}
                  className="bg-[#1c1c30] text-white p-2 text-xs font-bold hover:bg-[#282845] rounded active:scale-95 transition"
                >
                  ▲
                </button>
                <div />
                <button 
                  onClick={() => { if(gameData.current.player) gameData.current.player.nextDirection = 'LEFT'; }}
                  className="bg-[#1c1c30] text-white p-2 text-xs font-bold hover:bg-[#282845] rounded active:scale-95 transition"
                >
                  ◀
                </button>
                <button 
                  onClick={() => { if(gameData.current.player) gameData.current.player.nextDirection = 'DOWN'; }}
                  className="bg-[#1c1c30] text-white p-2 text-xs font-bold hover:bg-[#282845] rounded active:scale-95 transition"
                >
                  ▼
                </button>
                <button 
                  onClick={() => { if(gameData.current.player) gameData.current.player.nextDirection = 'RIGHT'; }}
                  className="bg-[#1c1c30] text-white p-2 text-xs font-bold hover:bg-[#282845] rounded active:scale-95 transition"
                >
                  ▶
                </button>
              </div>

              <button 
                onClick={() => setGameState('MENU')}
                className="w-full text-xs text-red-400 hover:underline mt-4 text-center block"
              >
                Abortar run e voltar ao menu
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER METRICS */}
      <footer className="border-t border-[#1b1b2a] bg-[#0c0c14] px-4 py-2 text-center text-[10px] text-gray-600 z-20">
        VOID CRAWLER v1.0 — PROJETADO DE FORMA MAGNÍFICA EM VITE + REACT + WEB AUDIO API
      </footer>
    </div>
  );
}

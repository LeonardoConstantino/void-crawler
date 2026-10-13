import { ScoreRecord, GhostRun, LayerType } from '../types';

export class Storage {
  private static SCORE_KEY = 'void_crawler_highscores';
  private static GHOST_KEY = 'void_crawler_ghost_data';

  /**
   * Retrieves high scores list
   */
  public static getScores(): ScoreRecord[] {
    try {
      const data = localStorage.getItem(this.SCORE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to read highscores from localStorage:", e);
    }
    return [];
  }

  /**
   * Saves a new score record
   */
  public static saveScore(record: Omit<ScoreRecord, 'id' | 'date'>): ScoreRecord[] {
    const scores = this.getScores();
    const newRecord: ScoreRecord = {
      ...record,
      id: `score_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: new Date().toLocaleDateString()
    };
    
    scores.push(newRecord);
    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);
    
    // Limit to top 15 scores
    const topScores = scores.slice(0, 15);
    
    try {
      localStorage.setItem(this.SCORE_KEY, JSON.stringify(topScores));
    } catch (e) {
      console.error("Failed to save highscores to localStorage:", e);
    }
    
    return topScores;
  }

  /**
   * Saves ghost recording for a successful or highly integrity run
   */
  public static saveGhostRun(ghost: GhostRun) {
    try {
      const ghosts = this.getAllGhosts();
      // Keep only the best run per layer to conserve storage
      const existingIdx = ghosts.findIndex(g => g.layer === ghost.layer);
      
      if (existingIdx !== -1) {
        if (ghost.score > ghosts[existingIdx].score) {
          ghosts[existingIdx] = ghost;
        }
      } else {
        ghosts.push(ghost);
      }
      
      localStorage.setItem(this.GHOST_KEY, JSON.stringify(ghosts));
    } catch (e) {
      console.error("Failed to save ghost run to localStorage:", e);
    }
  }

  /**
   * Retrieves the recorded ghost run for a specific layer
   */
  public static getGhostRunForLayer(layer: LayerType): GhostRun | null {
    const ghosts = this.getAllGhosts();
    const found = ghosts.find(g => g.layer === layer);
    return found || null;
  }

  /**
   * Retrieves all ghost recordings
   */
  private static getAllGhosts(): GhostRun[] {
    try {
      const data = localStorage.getItem(this.GHOST_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to read ghost data:", e);
    }
    return [];
  }

  /**
   * Resets all leaderboard and ghost data
   */
  public static clearAll() {
    try {
      localStorage.removeItem(this.SCORE_KEY);
      localStorage.removeItem(this.GHOST_KEY);
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  }
}

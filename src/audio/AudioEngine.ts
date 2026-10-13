/**
 * VOID CRAWLER Generative Audio Engine
 * Pure Web Audio API synthesis without external assets.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Drone Synth
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;

  // Sequencer Settings
  private seqInterval: any = null;
  private nextNoteTime: number = 0;
  private stepDuration: number = 0.25; // Speed of step sequence
  private isMuted: boolean = false;
  private isVulnerableActive: boolean = false;

  // Scaler notes frequencies (A minor pentatonic: A3, C4, D4, E4, G4, A4)
  private pentatonicScale = [110.00, 130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
  // Heroic Lydian Scale for Kernel Exploit (A Lydian: A, B, C#, D#, E, F#, G#)
  private lydianScale = [110.00, 123.47, 138.59, 155.56, 164.81, 185.00, 207.65, 220.00, 246.94, 277.18, 311.13, 329.63];

  constructor() {
    // Lazy initialize to bypass browser autoplay blocks
  }

  public init() {
    if (this.ctx) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // default volume
      this.masterGain.connect(this.ctx.destination);
      
      this.setupDrone();
      this.startSequencer();
    } catch (e) {
      console.warn("Failed to initialize Web Audio API:", e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  private setupDrone() {
    if (!this.ctx || !this.masterGain) return;

    try {
      // 110Hz Base square/sub drone
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sawtooth';
      this.droneOsc.frequency.setValueAtTime(55.0, this.ctx.currentTime); // Deep A1 base frequency

      // Filter to make it warm and moody
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      // Drone specific gain
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      // Connect: Osc -> Filter -> Gain -> Master
      this.droneOsc.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc.start();
    } catch (e) {
      console.warn("Error starting drone synth:", e);
    }
  }

  /**
   * Modulates the music pacing and drone tension according to player threat level
   * @param normalizedDistance 0 = player is safe (far away), 1 = collision imminent
   */
  public updateTension(normalizedDistance: number) {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;

    // Modulate cutoff frequency: 150Hz (very tense/filtered) when close, 1200Hz when safe
    if (this.droneFilter) {
      const cutoff = 200 + (1 - normalizedDistance) * 1000;
      this.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.1);
    }

    // Modulate drone volume: gets louder and harsher as enemies get closer
    if (this.droneGain) {
      const baseGain = 0.06 + normalizedDistance * 0.12;
      this.droneGain.gain.setTargetAtTime(baseGain, now, 0.1);
    }

    // Modulate sequencer speed: step duration goes from 0.35s (safe/slow) down to 0.12s (fast/panic)
    this.stepDuration = 0.35 - normalizedDistance * 0.23;
  }

  public setVulnerableTheme(active: boolean) {
    this.isVulnerableActive = active;
  }

  private startSequencer() {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime;
    
    // Check and trigger notes periodically
    this.seqInterval = setInterval(() => {
      this.scheduler();
    }, 50);
  }

  private scheduler() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleNextNote(this.nextNoteTime);
      this.nextNoteTime += this.stepDuration;
    }
  }

  private scheduleNextNote(time: number) {
    if (!this.ctx || !this.masterGain) return;

    // Generative sequencing: pick a note from pentatonic or Lydian scale
    const scale = this.isVulnerableActive ? this.lydianScale : this.pentatonicScale;
    
    // Choose a random index but biased to create melodic phrasing
    const noteIndex = Math.floor(Math.pow(Math.random(), 1.5) * scale.length);
    const freq = scale[noteIndex];

    try {
      // 8-Bit synth voice
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Vulnerable active: use bright triangle wave, otherwise square wave (classic digital feel)
      osc.type = this.isVulnerableActive ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, time);

      // Filter to dampen harmonics
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.isVulnerableActive ? 1500 : 800, time);

      // Envelope
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(this.isVulnerableActive ? 0.08 : 0.04, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + this.stepDuration - 0.01);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + this.stepDuration);
    } catch (e) {
      // suppress occasional Web Audio node exceptions
    }
  }

  // ----------------------------------------------------
  // SOUND EFFECTS PROCEDURAL GENERATION
  // ----------------------------------------------------

  public playCollect(isExploit: boolean = false) {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      
      if (isExploit) {
        // High ascending secure breach noise
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.35);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Light short blip
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      //
    }
  }

  public playExploitActive() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      // Epic digital shift jingle
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(110, now);
      osc2.frequency.exponentialRampToValueAtTime(440, now + 0.4);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(now);
      osc1.stop(now + 0.5);
      osc2.start(now);
      osc2.stop(now + 0.5);
    } catch (e) {
      //
    }
  }

  public playDamage() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      // Harsh downward sweep noise
      const osc = this.ctx.createOscillator();
      const noise = this.ctx.createOscillator(); // Or low noise synth representation
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.5);

      noise.type = 'triangle';
      noise.frequency.setValueAtTime(120, now);
      noise.frequency.setValueAtTime(50, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      noise.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.6);
      noise.start(now);
      noise.stop(now + 0.6);
    } catch (e) {
      //
    }
  }

  public playGlitch() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      // Instant crackly digital burst
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(Math.random() * 800 + 100, now);
      osc.frequency.setValueAtTime(Math.random() * 1500 + 50, now + 0.05);
      osc.frequency.setValueAtTime(Math.random() * 50 + 20, now + 0.1);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      //
    }
  }

  public playNearCollision() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      // Quick high pitch ping alarm
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.linearRampToValueAtTime(1800, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      //
    }
  }

  public playStartJingle() {
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    try {
      // Cyberpunk boot up chords synthesized in 8-bit
      const frequencies = [220, 277.18, 329.63, 440]; // A major 7th feel
      
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.5 + idx * 0.1);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now + idx * 0.1);
        osc.stop(now + 0.9);
      });
    } catch (e) {
      //
    }
  }

  public cleanup() {
    if (this.seqInterval) {
      clearInterval(this.seqInterval);
      this.seqInterval = null;
    }
    
    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
      } catch (e) {}
      this.droneOsc = null;
    }

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// Export singleton instance
export const audio = new AudioEngine();

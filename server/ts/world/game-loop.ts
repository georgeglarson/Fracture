/**
 * Game Loop - Handles main game tick, regeneration, and thought bubble timers
 * Single Responsibility: Coordinate periodic game updates
 */

export interface SpatialContext {
  processGroups(): void;
}

export interface BroadcasterTickContext {
  processQueues(): void;
}

export type TickCallback = () => void;

export class GameLoop {
  // Tick rate configuration
  private ups = 50;  // Updates per second

  // Timer handles
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // Counter state
  private regenCount = 0;
  private thoughtCount = 0;
  private aggroCount = 0;
  private updateCount = 0;
  private thoughtUpdateCount = 0;
  private aggroUpdateCount = 0;

  // Dependencies
  private spatialContext: SpatialContext | null = null;
  private broadcasterContext: BroadcasterTickContext | null = null;

  // Callbacks
  private regenCallback: TickCallback | null = null;
  private thoughtCallback: TickCallback | null = null;
  private aggroCallback: TickCallback | null = null;

  constructor(ups: number = 50) {
    this.ups = ups;
    this.regenCount = this.ups * 2;      // Regen every 2 seconds
    this.thoughtCount = this.ups * 15;   // Thoughts every 15 seconds
    this.aggroCount = Math.floor(this.ups / 2);  // Aggro check every 0.5 seconds
  }

  /**
   * Set updates per second
   */
  setUpdatesPerSecond(ups: number): void {
    this.ups = ups;
    this.regenCount = this.ups * 2;
    this.thoughtCount = this.ups * 15;
    this.aggroCount = Math.floor(this.ups / 2);
  }

  /**
   * Set spatial context for group processing
   */
  setSpatialContext(context: SpatialContext): void {
    this.spatialContext = context;
  }

  /**
   * Set broadcaster context for queue processing
   */
  setBroadcasterContext(context: BroadcasterTickContext): void {
    this.broadcasterContext = context;
  }

  /**
   * Set regeneration callback (called every 2 seconds)
   */
  onRegen(callback: TickCallback): void {
    this.regenCallback = callback;
  }

  /**
   * Set thought bubble callback (called every 15 seconds)
   */
  onThought(callback: TickCallback): void {
    this.thoughtCallback = callback;
  }

  /**
   * Set aggro check callback (called every 0.5 seconds)
   */
  onAggro(callback: TickCallback): void {
    this.aggroCallback = callback;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.tickInterval) {
      console.warn('GameLoop already running');
      return;
    }

    const self = this;

    this.tickInterval = setInterval(function() {
      self.tick();
    }, 1000 / this.ups);

    console.debug('GameLoop started at ' + this.ups + ' UPS');
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.debug('GameLoop stopped');
    }
  }

  /**
   * Main tick function - called every frame
   */
  private tick(): void {
    try {
      // Process spatial groups (spawns, despawns)
      this.spatialContext?.processGroups();
    } catch (e) {
      console.error('[GameLoop] Error in spatial processing:', e);
    }

    try {
      // Process message queues
      this.broadcasterContext?.processQueues();
    } catch (e) {
      console.error('[GameLoop] Error in broadcaster processing:', e);
    }

    // Regeneration timer
    if (this.updateCount < this.regenCount) {
      this.updateCount += 1;
    } else {
      try { this.regenCallback?.(); } catch (e) { console.error('[GameLoop] Error in regen callback:', e); }
      this.updateCount = 0;
    }

    // Thought bubble timer
    if (this.thoughtUpdateCount < this.thoughtCount) {
      this.thoughtUpdateCount += 1;
    } else {
      try { this.thoughtCallback?.(); } catch (e) { console.error('[GameLoop] Error in thought callback:', e); }
      this.thoughtUpdateCount = 0;
    }

    // Aggro check timer
    if (this.aggroUpdateCount < this.aggroCount) {
      this.aggroUpdateCount += 1;
    } else {
      try { this.aggroCallback?.(); } catch (e) { console.error('[GameLoop] Error in aggro callback:', e); }
      this.aggroUpdateCount = 0;
    }
  }

  /**
   * Get current UPS setting
   */
  getUpdatesPerSecond(): number {
    return this.ups;
  }

  /**
   * Check if loop is running
   */
  isRunning(): boolean {
    return this.tickInterval !== null;
  }
}

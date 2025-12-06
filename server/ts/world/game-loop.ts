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
  private updateCount = 0;
  private thoughtUpdateCount = 0;

  // Dependencies
  private spatialContext: SpatialContext | null = null;
  private broadcasterContext: BroadcasterTickContext | null = null;

  // Callbacks
  private regenCallback: TickCallback | null = null;
  private thoughtCallback: TickCallback | null = null;

  constructor(ups: number = 50) {
    this.ups = ups;
    this.regenCount = this.ups * 2;      // Regen every 2 seconds
    this.thoughtCount = this.ups * 15;   // Thoughts every 15 seconds
  }

  /**
   * Set updates per second
   */
  setUpdatesPerSecond(ups: number): void {
    this.ups = ups;
    this.regenCount = this.ups * 2;
    this.thoughtCount = this.ups * 15;
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
    // Process spatial groups (spawns, despawns)
    this.spatialContext?.processGroups();

    // Process message queues
    this.broadcasterContext?.processQueues();

    // Regeneration timer
    if (this.updateCount < this.regenCount) {
      this.updateCount += 1;
    } else {
      this.regenCallback?.();
      this.updateCount = 0;
    }

    // Thought bubble timer
    if (this.thoughtUpdateCount < this.thoughtCount) {
      this.thoughtUpdateCount += 1;
    } else {
      this.thoughtCallback?.();
      this.thoughtUpdateCount = 0;
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

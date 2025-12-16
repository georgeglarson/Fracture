/**
 * Mock Venice AI API for testing
 */

import { vi } from 'vitest';

export interface MockVeniceResponse {
  dialogue?: string;
  quest?: {
    id: string;
    description: string;
    objective: string;
  };
  narration?: string;
  thought?: string;
  news?: string[];
}

/**
 * Mock Venice Client for testing AI integrations
 */
export class MockVeniceClient {
  // Track all calls for assertions
  calls: Array<{ method: string; args: any[] }> = [];

  // Configurable responses
  private responses: MockVeniceResponse = {
    dialogue: 'Hello, traveler! How may I help you?',
    quest: {
      id: 'quest_1',
      description: 'Defeat 5 rats in the village',
      objective: 'Kill rats',
    },
    narration: 'The hero ventured forth into the unknown.',
    thought: 'I wonder what adventures await...',
    news: [
      'A great battle was fought in the desert!',
      'New treasures discovered in the caves.',
      'The skeleton king grows restless.',
    ],
  };

  // Error simulation
  private shouldFail: boolean = false;
  private failureError: Error = new Error('Venice API error');

  /**
   * Configure mock responses
   */
  setResponses(responses: Partial<MockVeniceResponse>): void {
    this.responses = { ...this.responses, ...responses };
  }

  /**
   * Configure mock to throw errors
   */
  setFailure(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    if (error) {
      this.failureError = error;
    }
  }

  /**
   * Clear recorded calls
   */
  clearCalls(): void {
    this.calls = [];
  }

  /**
   * Mock NPC dialogue generation
   */
  async generateNpcDialogue(
    npcType: string,
    playerContext: any
  ): Promise<string> {
    this.calls.push({ method: 'generateNpcDialogue', args: [npcType, playerContext] });

    if (this.shouldFail) {
      throw this.failureError;
    }

    return this.responses.dialogue!;
  }

  /**
   * Mock quest generation
   */
  async generateQuest(playerContext: any): Promise<MockVeniceResponse['quest']> {
    this.calls.push({ method: 'generateQuest', args: [playerContext] });

    if (this.shouldFail) {
      throw this.failureError;
    }

    return this.responses.quest!;
  }

  /**
   * Mock narration generation
   */
  async generateNarration(
    event: string,
    context: any
  ): Promise<string> {
    this.calls.push({ method: 'generateNarration', args: [event, context] });

    if (this.shouldFail) {
      throw this.failureError;
    }

    return this.responses.narration!;
  }

  /**
   * Mock entity thought generation
   */
  async generateThought(
    entityType: string,
    context: any
  ): Promise<string> {
    this.calls.push({ method: 'generateThought', args: [entityType, context] });

    if (this.shouldFail) {
      throw this.failureError;
    }

    return this.responses.thought!;
  }

  /**
   * Mock news generation
   */
  async generateNews(): Promise<string[]> {
    this.calls.push({ method: 'generateNews', args: [] });

    if (this.shouldFail) {
      throw this.failureError;
    }

    return this.responses.news!;
  }

  /**
   * Get calls to a specific method
   */
  getCallsTo(method: string): any[][] {
    return this.calls
      .filter(c => c.method === method)
      .map(c => c.args);
  }

  /**
   * Check if a method was called
   */
  wasMethodCalled(method: string): boolean {
    return this.calls.some(c => c.method === method);
  }
}

/**
 * Create a mock Venice client for testing
 */
export function createMockVeniceClient(): MockVeniceClient {
  return new MockVeniceClient();
}

/**
 * Create a Venice service mock that can be injected
 */
export function createVeniceServiceMock() {
  const client = new MockVeniceClient();

  return {
    client,
    generateNpcDialogue: vi.fn(client.generateNpcDialogue.bind(client)),
    generateQuest: vi.fn(client.generateQuest.bind(client)),
    generateNarration: vi.fn(client.generateNarration.bind(client)),
    generateThought: vi.fn(client.generateThought.bind(client)),
    generateNews: vi.fn(client.generateNews.bind(client)),
  };
}

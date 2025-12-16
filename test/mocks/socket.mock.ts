/**
 * Mock Socket.IO for testing
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

export class MockSocket extends EventEmitter {
  id: string;
  handshake: {
    address: string;
    headers: Record<string, string>;
  };
  connected: boolean = true;
  disconnected: boolean = false;

  // Track emitted messages for assertions
  emittedMessages: Array<{ event: string; args: any[] }> = [];

  constructor(id: string = 'mock-socket-1') {
    super();
    this.id = id;
    this.handshake = {
      address: '127.0.0.1',
      headers: {},
    };
  }

  emit(event: string, ...args: any[]): boolean {
    this.emittedMessages.push({ event, args });
    return true;
  }

  disconnect(close?: boolean): this {
    this.connected = false;
    this.disconnected = true;
    super.emit('disconnect', close ? 'server namespace disconnect' : 'client namespace disconnect');
    return this;
  }

  join(room: string): Promise<void> {
    return Promise.resolve();
  }

  leave(room: string): Promise<void> {
    return Promise.resolve();
  }

  // Helper to simulate receiving a message
  receiveMessage(type: number, ...args: any[]): void {
    super.emit('message', [type, ...args]);
  }

  // Helper to get last emitted message
  getLastEmitted(): { event: string; args: any[] } | undefined {
    return this.emittedMessages[this.emittedMessages.length - 1];
  }

  // Helper to find emitted messages by event type
  getEmittedByEvent(event: string): Array<{ event: string; args: any[] }> {
    return this.emittedMessages.filter(m => m.event === event);
  }

  // Helper to clear recorded messages
  clearEmitted(): void {
    this.emittedMessages = [];
  }
}

export class MockServer {
  sockets: Map<string, MockSocket> = new Map();
  private _onConnection: ((socket: MockSocket) => void) | null = null;

  on(event: string, callback: (socket: MockSocket) => void): this {
    if (event === 'connection') {
      this._onConnection = callback;
    }
    return this;
  }

  // Helper to simulate a new connection
  simulateConnection(socketId: string = `socket-${Date.now()}`): MockSocket {
    const socket = new MockSocket(socketId);
    this.sockets.set(socketId, socket);
    if (this._onConnection) {
      this._onConnection(socket);
    }
    return socket;
  }

  // Helper to get a connected socket
  getSocket(socketId: string): MockSocket | undefined {
    return this.sockets.get(socketId);
  }

  // Helper to disconnect all sockets
  disconnectAll(): void {
    this.sockets.forEach(socket => socket.disconnect());
    this.sockets.clear();
  }
}

/**
 * Create a mock socket for testing
 */
export function createMockSocket(id?: string): MockSocket {
  return new MockSocket(id);
}

/**
 * Create a mock server for testing
 */
export function createMockServer(): MockServer {
  return new MockServer();
}

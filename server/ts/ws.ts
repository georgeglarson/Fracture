import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as http from 'http';
import * as path from 'path';
import {Utils} from './utils';
import { getIntroService } from './ai/intro.service';

// Message type - can be a serializable object or raw array
type MessagePayload = { serialize(): unknown[] } | unknown[];

/**
 * Get CORS origins from environment or use defaults
 * Set CORS_ORIGINS env var as comma-separated list: "http://localhost:8008,https://game.example.com"
 */
function getCorsOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  // Default origins for development and production
  return [
    'http://localhost:8008',
    'http://45.77.216.118:8008',
    'https://fracture.venice.guru',
    'https://fracture.georgelarson.me'
  ];
}

export class Server {
  port: number;
  host: string;
  _connections: { [id: string]: Connection } = {};
  _counter = 0;
  io: SocketIOServer;
  connection_callback: ((connection: Connection) => void) | null = null;
  error_callback: (() => void) | null = null;
  status_callback: (() => string) | null = null;

  constructor(port: number, host: string = 'localhost') {
    this.port = port;
    this.host = host;
    var self = this;

    const app = express();

    // Parse JSON bodies for API endpoints
    app.use(express.json());

    // Serve static client files from dist/client
    const clientPath = path.join(__dirname, '../../client');
    app.use(express.static(clientPath));

    // Serve TTS cache files
    const ttsPath = path.join(__dirname, '../../data/tts-cache');
    app.use('/tts', express.static(ttsPath));

    // API: Generate intro story with TTS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express handler types
    app.post('/api/intro', async (req, res) => {
      const { playerName } = req.body;
      if (!playerName || typeof playerName !== 'string') {
        return res.status(400).json({ error: 'playerName is required' });
      }

      const introService = getIntroService();
      if (!introService) {
        // Service not initialized, return static intro
        return res.json({
          story: 'Reality shattered, and the world we knew ceased to exist. Welcome to the Fracture.',
          lines: ['Reality shattered, and the world we knew ceased to exist.', 'Welcome to the Fracture.'],
          voiceName: 'The Narrator',
          cached: false
        });
      }

      try {
        const result = await introService.generateIntro(playerName);
        if (result) {
          res.json(result);
        } else {
          // AI failed, return static fallback
          res.json(introService.getStaticIntro(playerName));
        }
      } catch (error) {
        console.error('[API] Intro generation error:', error);
        res.json(introService.getStaticIntro(playerName));
      }
    });

    const server = http.createServer(app);

    // Socket.IO configuration optimized for real-time games
    this.io = new SocketIOServer(server, {
      cors: {
        origin: getCorsOrigins(),
        methods: ['GET', 'POST'],
        credentials: true
      },
      // Connection state recovery for brief disconnections
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      },
      // Game-optimized ping settings
      pingTimeout: 30000,      // 30s before considering connection dead
      pingInterval: 10000,     // Ping every 10s to detect disconnects
      // Performance settings
      perMessageDeflate: false, // Disable compression for lower latency
      httpCompression: false
    });

    this.io.on('connection', function (connection) {
      console.info('a user connected');

      // connection.ip = connection.handshake.address.address;
      const c = new Connection(self._createId(), connection, self);

      if (self.connection_callback) {
        self.connection_callback(c);
      }
      self.addConnection(c);
    });

    this.io.on('error', function (err) {
        console.error('io error');
      console.error(err.stack);
      if (self.error_callback) {
        self.error_callback();
      }
    });

    server.listen(port, function () {
      console.info('listening on *:' + port);
    });
  }

  _createId() {
    return '5' + Utils.random(99) + '' + (this._counter++);
  }

  broadcast(message: MessagePayload): void {
    this.forEachConnection(function (connection: Connection) {
      try {
        connection.send(message);
      } catch (error) {
        console.error(`[WS] Failed to broadcast to connection ${connection.id}:`, error);
      }
    });
  }

  /**
   * Broadcast to all connections in a specific zone
   */
  broadcastToZone(zoneId: string, message: MessagePayload): void {
    try {
      this.io.to(`zone:${zoneId}`).emit('message', message);
    } catch (error) {
      console.error(`[WS] Failed to broadcast to zone ${zoneId}:`, error);
    }
  }

  /**
   * Broadcast to all connections in a specific party
   */
  broadcastToParty(partyId: string, message: MessagePayload): void {
    try {
      this.io.to(`party:${partyId}`).emit('message', message);
    } catch (error) {
      console.error(`[WS] Failed to broadcast to party ${partyId}:`, error);
    }
  }

  /**
   * Get count of connections in a zone
   */
  async getZonePlayerCount(zoneId: string): Promise<number> {
    try {
      const sockets = await this.io.in(`zone:${zoneId}`).fetchSockets();
      return sockets.length;
    } catch (error) {
      console.error(`[WS] Failed to get zone player count for ${zoneId}:`, error);
      return 0;
    }
  }

  onRequestStatus(status_callback: () => string): void {
    this.status_callback = status_callback;
  }

  onConnect(callback: (connection: Connection) => void): void {
    this.connection_callback = callback;
  }

  onError(callback: () => void): void {
    this.error_callback = callback;
  }

  forEachConnection(callback: (connection: Connection) => void): void {
    Object.values(this._connections).forEach(callback);
  }

  addConnection(connection: Connection): void {
    this._connections[connection.id] = connection;
  }

  removeConnection(id: string): void {
    delete this._connections[id];
  }

  getConnection(id: string): Connection {
    return this._connections[id];
  }
}

export class Connection {
  _connection: Socket;
  _server: Server;
  id: string;
  clientIp: string;
  listen_callback: ((message: unknown[]) => void) | null = null;
  close_callback: (() => void) | null = null;
  private _currentZone: string | null = null;

  constructor(id: string, connection: Socket, server: Server) {
    this._connection = connection;
    this._server = server;
    this.id = id;
    // Extract client IP from socket handshake
    this.clientIp = connection.handshake.address || '127.0.0.1';
    const self = this;

    // HANDLE DISPATCHER IN HERE
    connection.on('dispatch', function (message) {
      console.info('Received dispatch request');
      self._connection.emit('dispatched', {'status': 'OK', host: server.host, port: server.port});
    });

    connection.on('message', function (message) {
      if (self.listen_callback) {
        self.listen_callback(message);
      }
    });

    connection.on('disconnect', function () {
      if (self.close_callback) {
        self.close_callback();
      }
      self._server.removeConnection(self.id);
    });
  }

  onClose(callback: () => void): void {
    this.close_callback = callback;
  }

  listen(callback: (message: unknown[]) => void): void {
    this.listen_callback = callback;
  }

  broadcast(message: MessagePayload): void {
    throw new Error('Not implemented');
  }

  send(message: MessagePayload): void {
    try {
      this._connection.emit('message', message);
    } catch (error) {
      console.error(`[WS] Failed to send to connection ${this.id}:`, error);
    }
  }

  sendUTF8(data: string): void {
    try {
      this._connection.emit('message', data);
    } catch (error) {
      console.error(`[WS] Failed to sendUTF8 to connection ${this.id}:`, error);
    }
  }

  /**
   * Join a zone room for spatial broadcasting
   * Automatically leaves previous zone room
   */
  joinZone(zoneId: string): void {
    if (this._currentZone === zoneId) return;

    try {
      if (this._currentZone) {
        this._connection.leave(`zone:${this._currentZone}`);
      }
      this._connection.join(`zone:${zoneId}`);
      this._currentZone = zoneId;
    } catch (error) {
      console.error(`[WS] Failed to join zone ${zoneId} for connection ${this.id}:`, error);
    }
  }

  /**
   * Leave current zone room
   */
  leaveZone(): void {
    if (this._currentZone) {
      try {
        this._connection.leave(`zone:${this._currentZone}`);
        this._currentZone = null;
      } catch (error) {
        console.error(`[WS] Failed to leave zone for connection ${this.id}:`, error);
        this._currentZone = null; // Reset state even on error
      }
    }
  }

  /**
   * Get current zone ID
   */
  getZone(): string | null {
    return this._currentZone;
  }

  /**
   * Broadcast message to all players in the same zone (excluding self)
   */
  broadcastToZone(message: MessagePayload): void {
    if (this._currentZone) {
      try {
        this._connection.to(`zone:${this._currentZone}`).emit('message', message);
      } catch (error) {
        console.error(`[WS] Failed to broadcast to zone for connection ${this.id}:`, error);
      }
    }
  }

  /**
   * Join a party room for party chat
   */
  joinParty(partyId: string): void {
    try {
      this._connection.join(`party:${partyId}`);
    } catch (error) {
      console.error(`[WS] Failed to join party ${partyId} for connection ${this.id}:`, error);
    }
  }

  /**
   * Leave a party room
   */
  leaveParty(partyId: string): void {
    try {
      this._connection.leave(`party:${partyId}`);
    } catch (error) {
      console.error(`[WS] Failed to leave party ${partyId} for connection ${this.id}:`, error);
    }
  }

  /**
   * Broadcast to party members
   */
  broadcastToParty(partyId: string, message: MessagePayload): void {
    try {
      this._connection.to(`party:${partyId}`).emit('message', message);
    } catch (error) {
      console.error(`[WS] Failed to broadcast to party ${partyId} for connection ${this.id}:`, error);
    }
  }

  close(logError?: string): void {
    console.info(`[WS] Closing connection ${this.id}${logError ? ': ' + logError : ''}`);
    try {
      this._connection.disconnect();
    } catch (error) {
      console.error(`[WS] Failed to disconnect connection ${this.id}:`, error);
    }
  }
}

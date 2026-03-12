import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as http from 'http';
import * as path from 'path';
import {Utils} from './utils';
import { getIntroService } from './ai/intro.service';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('WebSocket');

// Message type - can be a serializable object or raw array
type MessagePayload = { serialize(): unknown[] } | unknown[];

/**
 * Get CORS origin handler from environment or use permissive same-origin policy.
 * Since the client is served by this same Express server, the WebSocket
 * connection always comes from the same origin. We validate dynamically
 * rather than maintaining a hardcoded list of domains.
 * Override with CORS_ORIGINS env var as comma-separated list if needed.
 */
function getCorsOrigins(): string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  // Dynamic: allow same-origin and common dev/prod patterns
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (same-origin, server-to-server, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Allow georgelarson.me and venice.guru subdomains
    if (origin.includes('georgelarson.me') || origin.includes('venice.guru')) {
      return callback(null, true);
    }
    // Reject unknown origins
    callback(new Error('CORS not allowed for origin: ' + origin));
  };
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
        log.error({ err: error }, 'Intro generation error');
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
      log.info('A user connected');

      // connection.ip = connection.handshake.address.address;
      const c = new Connection(self._createId(), connection, self);

      if (self.connection_callback) {
        self.connection_callback(c);
      }
      self.addConnection(c);
    });

    this.io.on('error', function (err) {
        log.error({ err }, 'Socket.IO error');
      if (self.error_callback) {
        self.error_callback();
      }
    });

    server.listen(port, function () {
      log.info({ port }, 'Listening');
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
        log.error({ err: error, connectionId: connection.id }, 'Failed to broadcast to connection');
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
      log.error({ err: error, zoneId }, 'Failed to broadcast to zone');
    }
  }

  /**
   * Broadcast to all connections in a specific party
   */
  broadcastToParty(partyId: string, message: MessagePayload): void {
    try {
      this.io.to(`party:${partyId}`).emit('message', message);
    } catch (error) {
      log.error({ err: error, partyId }, 'Failed to broadcast to party');
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
      log.error({ err: error, zoneId }, 'Failed to get zone player count');
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
      log.info('Received dispatch request');
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
      log.error({ err: error, connectionId: this.id }, 'Failed to send to connection');
    }
  }

  sendUTF8(data: string): void {
    try {
      this._connection.emit('message', data);
    } catch (error) {
      log.error({ err: error, connectionId: this.id }, 'Failed to sendUTF8 to connection');
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
      log.error({ err: error, zoneId, connectionId: this.id }, 'Failed to join zone');
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
        log.error({ err: error, connectionId: this.id }, 'Failed to leave zone');
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
        log.error({ err: error, connectionId: this.id }, 'Failed to broadcast to zone');
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
      log.error({ err: error, partyId, connectionId: this.id }, 'Failed to join party');
    }
  }

  /**
   * Leave a party room
   */
  leaveParty(partyId: string): void {
    try {
      this._connection.leave(`party:${partyId}`);
    } catch (error) {
      log.error({ err: error, partyId, connectionId: this.id }, 'Failed to leave party');
    }
  }

  /**
   * Broadcast to party members
   */
  broadcastToParty(partyId: string, message: MessagePayload): void {
    try {
      this._connection.to(`party:${partyId}`).emit('message', message);
    } catch (error) {
      log.error({ err: error, partyId, connectionId: this.id }, 'Failed to broadcast to party');
    }
  }

  close(logError?: string): void {
    log.info({ connectionId: this.id, reason: logError }, 'Closing connection');
    try {
      this._connection.disconnect();
    } catch (error) {
      log.error({ err: error, connectionId: this.id }, 'Failed to disconnect connection');
    }
  }
}

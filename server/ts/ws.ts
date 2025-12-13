import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as http from 'http';
import * as _ from 'lodash';
import {Utils} from './utils';

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
    'https://bq.venice.guru',
    'https://pq.venice.guru',
    'https://pixelquest.venice.guru',
    'https://pq.georgelarson.me',
    'https://pixelquest.georgelarson.me'
  ];
}

export class Server {
  port: number;
  host: string;
  _connections: { [id: string]: Connection } = {};
  _counter = 0;
  io: SocketIOServer;
  connection_callback;
  error_callback;
  status_callback;

  constructor(port: number, host: string = 'localhost') {
    this.port = port;
    this.host = host;
    var self = this;

    const app = express();
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

  broadcast(message) {
    this.forEachConnection(function (connection) {
      connection.send(message);
    });
  }

  /**
   * Broadcast to all connections in a specific zone
   */
  broadcastToZone(zoneId: string, message: any): void {
    this.io.to(`zone:${zoneId}`).emit('message', message);
  }

  /**
   * Broadcast to all connections in a specific party
   */
  broadcastToParty(partyId: string, message: any): void {
    this.io.to(`party:${partyId}`).emit('message', message);
  }

  /**
   * Get count of connections in a zone
   */
  async getZonePlayerCount(zoneId: string): Promise<number> {
    const sockets = await this.io.in(`zone:${zoneId}`).fetchSockets();
    return sockets.length;
  }

  onRequestStatus(status_callback) {
    this.status_callback = status_callback;
  }

  onConnect(callback) {
    this.connection_callback = callback;
  }

  onError(callback) {
    this.error_callback = callback;
  }

  forEachConnection(callback) {
    _.each(this._connections, callback);
  }

  addConnection(connection) {
    this._connections[connection.id] = connection;
  }

  removeConnection(id) {
    delete this._connections[id];
  }

  getConnection(id) {
    return this._connections[id];
  }
}

export class Connection {
  _connection: Socket;
  _server: Server;
  id: string;
  listen_callback;
  close_callback;
  private _currentZone: string | null = null;

  constructor(id: string, connection: Socket, server: Server) {
    this._connection = connection;
    this._server = server;
    this.id = id;
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

  onClose(callback) {
    this.close_callback = callback;
  }

  listen(callback) {
    this.listen_callback = callback;
  }

  broadcast(message) {
    throw new Error('Not implemented');
  }

  send(message) {
    this._connection.emit('message', message);
  }

  sendUTF8(data) {
    this._connection.emit('message', data);
  }

  /**
   * Join a zone room for spatial broadcasting
   * Automatically leaves previous zone room
   */
  joinZone(zoneId: string): void {
    if (this._currentZone === zoneId) return;

    if (this._currentZone) {
      this._connection.leave(`zone:${this._currentZone}`);
    }
    this._connection.join(`zone:${zoneId}`);
    this._currentZone = zoneId;
  }

  /**
   * Leave current zone room
   */
  leaveZone(): void {
    if (this._currentZone) {
      this._connection.leave(`zone:${this._currentZone}`);
      this._currentZone = null;
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
  broadcastToZone(message: any): void {
    if (this._currentZone) {
      this._connection.to(`zone:${this._currentZone}`).emit('message', message);
    }
  }

  /**
   * Join a party room for party chat
   */
  joinParty(partyId: string): void {
    this._connection.join(`party:${partyId}`);
  }

  /**
   * Leave a party room
   */
  leaveParty(partyId: string): void {
    this._connection.leave(`party:${partyId}`);
  }

  /**
   * Broadcast to party members
   */
  broadcastToParty(partyId: string, message: any): void {
    this._connection.to(`party:${partyId}`).emit('message', message);
  }

  close(logError?) {
    console.info('Closing connection to player ' + this.id + '. Error: ' + logError);
    this._connection.disconnect();
  }
}

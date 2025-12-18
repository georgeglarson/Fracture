import * as _ from 'lodash';
import {World} from './world';

// Config interface for metrics
interface MetricsConfig {
  memcached_port: number;
  memcached_host: string;
  server_name: string;
  game_servers: { name: string }[];
}

// Memcache client interface (minimal)
interface MemcacheClient {
  connect(): void;
  on(event: string, callback: () => void): void;
  get(key: string, callback: (error: Error | null, result: string | null) => void): void;
  set(key: string, value: unknown, callback?: () => void): void;
}

export class Metrics {
  config: MetricsConfig;
  client: MemcacheClient;
  isReady = false;
  ready_callback: (() => void) | null = null;


  constructor(config: MetricsConfig) {
    var self = this;

    this.config = config;
    this.client = new (require('memcache')).Client(config.memcached_port, config.memcached_host);
    this.client.connect();


    this.client.on('connect', function () {
      console.info('Metrics enabled: memcached client connected to ' + config.memcached_host + ':' + config.memcached_port);
      self.isReady = true;
      if (self.ready_callback) {
        self.ready_callback();
      }
    });
  }

  ready(callback: () => void): void {
    this.ready_callback = callback;
  }

  updatePlayerCounters(worlds: World[], updatedCallback?: (total: number) => void): void {
    var self = this,
      config = this.config,
      numServers = _.size(config.game_servers),
      playerCount = _.reduce(worlds, function (sum, world: World) {
        return sum + world.playerCount;
      }, 0);

    if (this.isReady) {
      // Set the number of players on this server
      this.client.set('player_count_' + config.server_name, playerCount, function () {
        var total_players = 0;

        // Recalculate the total number of players and set it
        _.each(config.game_servers, function (server) {
          self.client.get('player_count_' + server.name, function (error, result) {
            var count = result ? parseInt(result) : 0;

            total_players += count;
            numServers -= 1;
            if (numServers === 0) {
              self.client.set('total_players', total_players, function () {
                if (updatedCallback) {
                  updatedCallback(total_players);
                }
              });
            }
          });
        });
      });
    } else {
      console.error('Memcached client not connected');
    }
  }

  updateWorldDistribution(worlds: number[]): void {
    this.client.set('world_distribution_' + this.config.server_name, worlds);
  }

  getOpenWorldCount(callback: (result: number) => void): void {
    this.client.get('world_count_' + this.config.server_name, function (error, result) {
      callback(result ? parseInt(result) : 0);
    });
  }

  getTotalPlayers(callback: (result: number) => void): void {
    this.client.get('total_players', function (error, result) {
      callback(result ? parseInt(result) : 0);
    });
  }
}

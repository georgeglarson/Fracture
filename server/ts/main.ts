// OpenTelemetry must be initialized before all other imports
import './tracing';

// Load environment variables from .env file (with explicit path)
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from project root (handles running from dist/ directory)
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  // Logger not yet available at module top-level, use console for env bootstrap
  console.warn(`[ENV] Could not load .env from ${envPath}:`, result.error.message);
} else {
  console.info(`[ENV] Loaded environment from ${envPath}`);
}
// Catch unhandled promise rejections to prevent silent server crashes
process.on('unhandledRejection', (reason, promise) => {
  log.fatal({ err: reason }, 'Unhandled promise rejection');
});

import {World} from './world';
import {Server, Connection} from './ws';
import {Metrics} from './metrics';
import {Player} from './player';
import {initVeniceService, initFishAudioService, getVeniceClient} from './ai';
import {initIntroService} from './ai/intro.service';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Server');

// Server configuration interface
interface ServerConfig {
  port: number;
  metrics_enabled: boolean;
  // Metrics config (required when metrics_enabled is true)
  memcached_port: number;
  memcached_host: string;
  server_name: string;
  game_servers: { name: string }[];
  // World config
  nb_worlds: number;
  nb_players_per_world: number;
  map_filepath: string;
  // AI config
  venice_api_key?: string;
  venice_model?: string;
  venice_timeout?: number;
  fish_audio_api_key?: string;
}

// Server singleton - PID file to prevent multiple instances
const PID_FILE = path.join(__dirname, '../../.server.pid');

function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        return true;
    } catch (e) {
        return false;
    }
}

function acquireServerLock(): boolean {
    // Check if PID file exists
    if (fs.existsSync(PID_FILE)) {
        try {
            const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
            if (existingPid && isProcessRunning(existingPid)) {
                log.error({ existingPid, pidFile: PID_FILE }, 'Another instance is already running');
                return false;
            }
            // Stale PID file - process no longer running
            log.info({ existingPid }, 'Removing stale PID file');
        } catch (e) {
            log.warn('Could not read PID file, removing it');
        }
    }

    // Write our PID
    fs.writeFileSync(PID_FILE, process.pid.toString());
    log.info({ pid: process.pid }, 'Acquired server lock');
    return true;
}

function releaseServerLock(): void {
    try {
        if (fs.existsSync(PID_FILE)) {
            const storedPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
            if (storedPid === process.pid) {
                fs.unlinkSync(PID_FILE);
                log.info('Released server lock');
            }
        }
    } catch (e) {
        // Ignore errors during cleanup
    }
}

// Clean up on exit
process.on('exit', releaseServerLock);
process.on('SIGINT', () => { releaseServerLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseServerLock(); process.exit(0); });

function main(config: ServerConfig): void {
    var WorldServer = World,
        server = new Server(config.port),
        metrics = config.metrics_enabled ? new Metrics(config) : null,
        worlds: World[] = [],
        lastTotalPlayers = 0,
        checkPopulationInterval = setInterval(function() {
            if(metrics && metrics.isReady) {
                metrics.getTotalPlayers(function(totalPlayers: number) {
                    if(totalPlayers !== lastTotalPlayers) {
                        lastTotalPlayers = totalPlayers;
                        worlds.forEach(function(world: World) {
                            world.updatePopulation(totalPlayers);
                        });
                    }
                });
            }
        }, 1000);

    log.info('Starting Fracture game server');

    // Initialize Venice AI service if API key is configured
    // Priority: environment variable > config file
    const veniceApiKey = process.env.VENICE_API_KEY || config.venice_api_key;
    if (veniceApiKey) {
        // Log key status (masked for security)
        const maskedKey = veniceApiKey.substring(0, 4) + '...' + veniceApiKey.substring(veniceApiKey.length - 4);
        log.info({ maskedKey, keyLength: veniceApiKey.length }, 'Venice API key found');

        initVeniceService(veniceApiKey, {
            model: process.env.VENICE_MODEL || config.venice_model || 'llama-3.3-70b',
            timeout: parseInt(process.env.VENICE_TIMEOUT || '') || config.venice_timeout || 5000
        });
        log.info('Venice AI service initialized');

        // Initialize intro service (depends on Venice)
        const veniceClient = getVeniceClient();
        if (veniceClient) {
            initIntroService(veniceClient);
            log.info('IntroService initialized');
        }
    } else {
        log.warn({ envVarSet: !!process.env.VENICE_API_KEY }, 'Venice API key not found — set VENICE_API_KEY in .env');
    }

    // Initialize Fish Audio TTS service if API key is configured
    const fishAudioApiKey = process.env.FISH_AUDIO_API_KEY || config.fish_audio_api_key;
    if (fishAudioApiKey) {
        const maskedKey = fishAudioApiKey.substring(0, 4) + '...' + fishAudioApiKey.substring(fishAudioApiKey.length - 4);
        log.info({ maskedKey }, 'FishAudio API key found');
        initFishAudioService({ apiKey: fishAudioApiKey });
        log.info('FishAudio TTS service initialized');
    } else {
        log.warn('FishAudio API key not found — NPC voice acting disabled');
    }

    server.onConnect(function(connection: Connection) {
        var world: World | undefined, // the one in which the player will be spawned
            connect = function() {
                if(world && world.connect_callback) {
                    world.connect_callback(new Player(connection, world));
                }
            };

        if(metrics) {
            metrics.getOpenWorldCount(function(open_world_count: number) {
                log.debug({ openWorldCount: open_world_count }, 'Open world count');
                // choose the least populated world among open worlds
                world = worlds.find((w: World) => w.playerCount < config.nb_players_per_world && w.playerCount < open_world_count);
                connect();
            });
        }
        else {
            // simply fill each world sequentially until they are full
            world = worlds.find((w: World) => w.playerCount < config.nb_players_per_world);
            if (world) world.updatePopulation();
            connect();
        }
    });

    server.onError(function() {
        log.error({ details: Array.prototype.join.call(arguments, ", ") }, 'Server error');
    });

    var onPopulationChange = function() {
        metrics!.updatePlayerCounters(worlds, function(totalPlayers: number) {
            worlds.forEach(function(world: World) {
                world.updatePopulation(totalPlayers);
            });
        });
        metrics!.updateWorldDistribution(getWorldDistribution(worlds));
    };

    Array.from({length: config.nb_worlds}, (_, i) => {
        var world = new WorldServer('world'+ (i+1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
        if(metrics) {
            world.onPlayerAdded(onPopulationChange);
            world.onPlayerRemoved(onPopulationChange);
        }
    });

    server.onRequestStatus(function() {
        return JSON.stringify(getWorldDistribution(worlds));
    });

    // Start debug TUI server unless disabled
    if (!process.env.NO_DEBUG) {
        const { startDebugServer } = require('./debug/debug-server');
        const debugPort = parseInt(process.env.DEBUG_PORT || '8001', 10);
        startDebugServer(worlds[0], debugPort);
    }

    if(config.metrics_enabled) {
        metrics!.ready(function() {
            onPopulationChange(); // initialize all counters to 0 when the server starts
        });
    }

    // process.on('uncaughtException', function (e) {
    //     console.error('uncaughtException: ' + e);
    // });
}

function getWorldDistribution(worlds: World[]): number[] {
    var distribution: number[] = [];

    worlds.forEach(function(world: World) {
        distribution.push(world.playerCount);
    });
    return distribution;
}

function getConfigFile(path: string, callback: (config: ServerConfig | null) => void): void {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            log.error({ path: err.path }, 'Could not open config file');
            callback(null);
        } else {
            callback(JSON.parse(json_string) as ServerConfig);
        }
    });
}

var configPath = './server/config.json';

process.argv.forEach(function (val, index, array) {
    if(index === 2) {
        configPath = val;
    }
});

getConfigFile(configPath, function(config: ServerConfig | null) {
    // Acquire singleton lock before starting
    if (!acquireServerLock()) {
        process.exit(1);
    }
    if (!config) {
        log.fatal('Failed to load config file');
        process.exit(1);
    }
    main(config);
});
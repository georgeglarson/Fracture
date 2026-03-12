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
import {Player} from './player';
import {initVeniceService, initFishAudioService, getVeniceClient} from './ai';
import {initIntroService} from './ai/intro.service';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Server');

// Server configuration interface
interface ServerConfig {
  port: number;
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
        log.debug({ err: e }, 'PID file cleanup error');
    }
}

// Clean up on exit
process.on('exit', releaseServerLock);
process.on('SIGINT', () => { releaseServerLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseServerLock(); process.exit(0); });

function main(config: ServerConfig): void {
    const WorldServer = World;
    const server = new Server(config.port);
    const worlds: World[] = [];

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

    server.onConnect((connection: Connection) => {
        // Fill each world sequentially until full
        const world: World | undefined = worlds.find((w: World) => w.playerCount < config.nb_players_per_world);
        const connect = () => {
                if(world && world.connectCallback) {
                    world.connectCallback(new Player(connection, world));
                }
            };

        if (world) world.updatePopulation();
        connect();
    });

    server.onError((...args: any[]) => {
        log.error({ details: args.join(", ") }, 'Server error');
    });

    Array.from({length: config.nb_worlds}, (_, i) => {
        const world = new WorldServer('world'+ (i+1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
    });

    server.onRequestStatus(() => {
        return JSON.stringify(getWorldDistribution(worlds));
    });

    // Start debug TUI server unless disabled
    if (!process.env.NO_DEBUG) {
        const { startDebugServer } = require('./debug/debug-server');
        const debugPort = parseInt(process.env.DEBUG_PORT || '8001', 10);
        startDebugServer(worlds[0], debugPort);
    }

}

function getWorldDistribution(worlds: World[]): number[] {
    const distribution: number[] = [];

    worlds.forEach((world: World) => {
        distribution.push(world.playerCount);
    });
    return distribution;
}

async function getConfigFile(filePath: string): Promise<ServerConfig | null> {
    try {
        const json_string = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(json_string) as ServerConfig;
    } catch (err: any) {
        log.error({ path: err.path }, 'Could not open config file');
        return null;
    }
}

let configPath = './server/config.json';

process.argv.forEach((val, index) => {
    if(index === 2) {
        configPath = val;
    }
});

(async () => {
    const config = await getConfigFile(configPath);
    // Acquire singleton lock before starting
    if (!acquireServerLock()) {
        process.exit(1);
    }
    if (!config) {
        log.fatal('Failed to load config file');
        process.exit(1);
    }
    main(config);
})();
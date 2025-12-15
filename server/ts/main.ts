// Load environment variables from .env file (with explicit path)
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from project root (handles running from dist/ directory)
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn(`[ENV] Could not load .env from ${envPath}:`, result.error.message);
} else {
  console.info(`[ENV] Loaded environment from ${envPath}`);
}
import {World} from './world';
import {Server} from './ws';
import {Metrics} from './metrics';
import {Player} from './player';
import {initVeniceService, initFishAudioService} from './ai';

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
                console.error(`[Server] Another instance is already running (PID: ${existingPid})`);
                console.error(`[Server] Kill it first with: kill ${existingPid}`);
                console.error(`[Server] Or remove stale PID file: rm ${PID_FILE}`);
                return false;
            }
            // Stale PID file - process no longer running
            console.info(`[Server] Removing stale PID file (old PID: ${existingPid})`);
        } catch (e) {
            console.warn(`[Server] Could not read PID file, removing it`);
        }
    }

    // Write our PID
    fs.writeFileSync(PID_FILE, process.pid.toString());
    console.info(`[Server] Acquired lock (PID: ${process.pid})`);
    return true;
}

function releaseServerLock(): void {
    try {
        if (fs.existsSync(PID_FILE)) {
            const storedPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
            if (storedPid === process.pid) {
                fs.unlinkSync(PID_FILE);
                console.info(`[Server] Released lock`);
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

function main(config) {
    var WorldServer = World,
        server = new Server(config.port),
        metrics = config.metrics_enabled ? new Metrics(config) : null,
        worlds = [],
        lastTotalPlayers = 0,
        checkPopulationInterval = setInterval(function() {
            if(metrics && metrics.isReady) {
                metrics.getTotalPlayers(function(totalPlayers) {
                    if(totalPlayers !== lastTotalPlayers) {
                        lastTotalPlayers = totalPlayers;
                        worlds.forEach(function(world) {
                            world.updatePopulation(totalPlayers);
                        });
                    }
                });
            }
        }, 1000);

    console.info("Starting PixelQuest game server...");

    // Initialize Venice AI service if API key is configured
    // Priority: environment variable > config file
    const veniceApiKey = process.env.VENICE_API_KEY || config.venice_api_key;
    if (veniceApiKey) {
        // Log key status (masked for security)
        const maskedKey = veniceApiKey.substring(0, 4) + '...' + veniceApiKey.substring(veniceApiKey.length - 4);
        console.info(`[Venice] API key found: ${maskedKey} (length: ${veniceApiKey.length})`);

        initVeniceService(veniceApiKey, {
            model: process.env.VENICE_MODEL || config.venice_model || 'llama-3.3-70b',
            timeout: parseInt(process.env.VENICE_TIMEOUT || '') || config.venice_timeout || 5000
        });
        console.info("[Venice] AI service initialized");
    } else {
        console.warn("[Venice] NO API KEY FOUND! Set VENICE_API_KEY in .env file");
        console.warn("[Venice] Checked: process.env.VENICE_API_KEY =", process.env.VENICE_API_KEY ? 'set' : 'undefined');
    }

    // Initialize Fish Audio TTS service if API key is configured
    const fishAudioApiKey = process.env.FISH_AUDIO_API_KEY || config.fish_audio_api_key;
    if (fishAudioApiKey) {
        const maskedKey = fishAudioApiKey.substring(0, 4) + '...' + fishAudioApiKey.substring(fishAudioApiKey.length - 4);
        console.info(`[FishAudio] API key found: ${maskedKey}`);
        initFishAudioService({ apiKey: fishAudioApiKey });
        console.info("[FishAudio] TTS service initialized");
    } else {
        console.warn("[FishAudio] NO API KEY FOUND! Set FISH_AUDIO_API_KEY in .env file");
        console.warn("[FishAudio] NPC voice acting will be disabled");
    }

    server.onConnect(function(connection) {
        var world, // the one in which the player will be spawned
            connect = function() {
                if(world) {
                    world.connect_callback(new Player(connection, world));
                }
            };

        if(metrics) {
            metrics.getOpenWorldCount(function(open_world_count) {
                console.log('open world count: ' + open_world_count);
                // choose the least populated world among open worlds
                world = worlds.find(world => world.playerCount < config.nb_players_per_world && world.playerCount < open_world_count);
                connect();
            });
        }
        else {
            // simply fill each world sequentially until they are full
            world = worlds.find(world => world.playerCount < config.nb_players_per_world);
            world.updatePopulation();
            connect();
        }
    });

    server.onError(function() {
        console.error(Array.prototype.join.call(arguments, ", "));
    });

    var onPopulationChange = function() {
        metrics.updatePlayerCounters(worlds, function(totalPlayers) {
            worlds.forEach(function(world) {
                world.updatePopulation(totalPlayers);
            });
        });
        metrics.updateWorldDistribution(getWorldDistribution(worlds));
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

    if(config.metrics_enabled) {
        metrics.ready(function() {
            onPopulationChange(); // initialize all counters to 0 when the server starts
        });
    }

    // process.on('uncaughtException', function (e) {
    //     console.error('uncaughtException: ' + e);
    // });
}

function getWorldDistribution(worlds) {
    var distribution = [];

    worlds.forEach(function(world) {
        distribution.push(world.playerCount);
    });
    return distribution;
}

function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            console.error("Could not open config file:", err.path);
            callback(null);
        } else {
            callback(JSON.parse(json_string));
        }
    });
}

var configPath = './server/config.json';

process.argv.forEach(function (val, index, array) {
    if(index === 2) {
        configPath = val;
    }
});

getConfigFile(configPath, function(config) {
    // Acquire singleton lock before starting
    if (!acquireServerLock()) {
        process.exit(1);
    }
    main(config);
});
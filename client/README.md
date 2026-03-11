# Fracture Client

HTML5 Canvas game client. Renders the game world, handles player input, and communicates with the server via Socket.IO.

## Tech Stack

- **TypeScript 5.8**
- **HTML5 Canvas** — Sprite-based rendering with camera, particles, and animation
- **Webpack 5** — Module bundling with production optimization
- **Socket.IO 4** — Real-time server communication

## Configuration

- `config/config.json` — Development (`localhost:8000`)
- `config/config.prod.json` — Production (`fracture.georgelarson.me:443`)

## Build

```bash
pnpm run build:client     # Webpack production build → dist/client/
pnpm run watch:client     # Dev server with hot reload
```

## Architecture

| Directory | Responsibility |
|-----------|---------------|
| `entity/` | Entity hierarchy — Character, Player, Mob, NPC with sprites and animation |
| `handlers/` | Server message handlers (combat, inventory, party, achievements, etc.) |
| `network/` | GameClient (Socket.IO adapter), message dispatch, event system |
| `renderer/` | Canvas rendering pipeline, camera, particle effects |
| `ui/` | HUD panels, inventory UI, shop, achievement display |
| `controllers/` | Input handling, movement, targeting |

## Browser Support

Firefox, Chrome, Safari, Edge. Mobile-responsive.

PixelQuest
==========

A modern HTML5/TypeScript multiplayer RPG with AI-powered NPCs.

Features
--------

- **AI-Powered NPCs**: Dynamic dialogue, quests, and companions powered by Venice AI
- **Real-time Multiplayer**: WebSocket-based gameplay with Socket.IO
- **Modern Architecture**: TypeScript with Single Responsibility Principle design
- **Progression System**: XP, levels, achievements, and daily rewards
- **Economy**: Gold, shops, and item trading

Tech Stack
----------

- **Client**: TypeScript, Webpack, HTML5 Canvas
- **Server**: Node.js, TypeScript, Socket.IO
- **AI**: Venice AI SDK for NPC intelligence

Getting Started
---------------

```bash
# Install dependencies
pnpm install

# Build client and server
pnpm run build:client
pnpm run build:server

# Start the server
pnpm start
```

Documentation
-------------

Documentation is located in client and server directories.

License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See the LICENSE file for details.

Credits
-------

Original game created by [Little Workshop](http://www.littleworkshop.fr):
* Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
* Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)

TypeScript port by [Matthew Javelet](https://github.com/0xMatt)

Modernized by [George Larson](https://georgelarson.me)

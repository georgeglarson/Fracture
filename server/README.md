Fracture server documentation
===============================

The game server requires nodejs 6.x or greater.

- lodash
- log
- express
- socket.io
- sanitizer
- memcache (only if you want metrics)

All of them can be installed via `npm install -d` (this will install a local copy of all the dependencies in the node_modules directory)


Configuration
-------------

The server settings (number of worlds, number of players per world, etc.) can be configured.
Modify `config.json` or create a new file and specify the path when running the server with the second argument, e.g: `yarn watch:server ./config-prod.json`

Development
-----------

To launch the application for development, simply run `yarn watch:servr`


Deployment
----------

In order to deploy the server, simply run `yarn build:server` and copy the `dist/server` and `dist/shared` directories to the staging/production server.

Then run `node server/ts/main.js` in order to start the server.


Note: the `shared` directory is the only one in the project which is a server dependency.


Monitoring
----------

The server has a status URL which can be used as a health check or simply as a way to monitor player population.

Send a GET request to: `http://[host]:[port]/status`

It will return a JSON array containing the number of players in all instanced worlds on this game server.

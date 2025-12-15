Fracture client documentation
===============================

The client side for Fracture has been converted to a modern development toolset.

Current technologies used are:

- Typescript 2.5
- Webpack 3.6
- jQuery 2.2.4(Will eventually get rid of this dependency)
- Lodash 3.10.1 (Will eventually get rid of this dependency)


### Configuration

Copy the current working environment from `client/config/config.{env}.json` to `client/config/config.json`.

### Development

Running the local development environment is easy. Just run `yarn watch:client` and a browser window will open. 

To configure the port your local dev server runs on, just change the environment variable `PORT` to your desired port.


### Serving for production

Just run `yarn build:client` and copy your `dist/client` directory to your webservers root.

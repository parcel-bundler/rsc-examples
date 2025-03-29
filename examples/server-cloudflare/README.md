# Parcel + Cloudflare Workers RSC Example

This example is a server driven app built with Parcel, Cloudflare Workers, and React Server Components. It follows similar patterns to the Node server example (in `../server/`). The main difference is using Cloudflare Workers instead of Node.js and Express.

Parcel does not yet have out of the box support for running Cloudflare Workers in development. Instead, the package.json includes two scripts: `watch`, and `start`. The `watch` script uses Parcel's watch mode to build the app, rather than using Parcel's dev server. The `start` script uses `wrangler` to start the built server in the `dist` directory.

So to start this app, run two terminals: `yarn watch` first, and then `yarn start`.

## Wrangler configuration

The `wrangler.jsonc` config file has some important settings that make this app work:

* `main: "dist/server.js"` – The main entry point that should run in a Cloudflare Worker.
* `no_bundle: true` – Don't use Wranglers built-in bundling, since we are using Parcel.
* `base_dir: "dist"` and `rules` – Configure Cloudflare to include all output JS modules in the worker, not just the entry "dist/server.js".
* `compatibility_flags` – Enable Node.js compatibility so that `AsyncLocalStorage` (used by React) works.
* `assets` – Serve the static client JS/CSS assets. This points at the entire "dist" directory rather than "dist/client" because there is no config option to mount the assets at a subpath (`"/client"`). Instead, there is a `dist/.assetsignore` file that ensures the server source code is not exposed.

# Parcel + Deno RSC Example

This example is a server driven app built with Parcel, Deno, and React Server Components. It follows similar patterns to the Node server example (in `../server/`). The main difference is using `Deno.serve` instead of Express.

Parcel does not yet have out of the box support for running Deno in development. Instead, the package.json includes two scripts: `watch`, and `start`. The `watch` script uses Parcel's watch mode to build the app, rather than using Parcel's dev server. The `start` script uses `deno` with the `--watch` flag to start the built server in the `dist` directory.

So to start this app, run two terminals: `yarn watch` first, and then `deno run start`.

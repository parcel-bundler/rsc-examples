# Parcel React Server Components Examples

🚧🚧🚧 **UNDER CONSTRUCTION** 🚧🚧🚧 

[React Server Components](https://react.dev/reference/rsc/server-components) are a new type of Component that renders ahead of time, before bundling, in an environment separate from your client app or SSR server. This repo is a set of examples of various ways to use RSC with Parcel.

There are currently three examples. See the linked READMEs for a full descriptions:

1. [Server Driven](examples/server) – A server driven todo list app where routing happens server side. Demonstrates composing server and client components, SSR and hydration, server actions with client JS and HTML forms, and a simple client side router.
2. [Static](examples/static) – A simple static site generator that runs server components at build time and outputs static HTML.
3. [Client Driven](examples/client) – Demonstrates how to integrate RSCs into an existing client-rendered app, without changing the entrypoint. 

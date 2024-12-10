# Parcel RSC Static Site Generator Example

This example is a simple static site generator built with Parcel and React Server Components.

Note: the plugins used in this example will move into Parcel eventually.

## Setup

### pages/*.tsx

These are the entry points of the build. They are React Server Components that render the root `<html>` element of the page, and any other client or server components. A Parcel packager plugin executes the server components during the build to render them to static HTML. A separate `.rsc` file for each page is also generated for use during client side navigations.

Server component entries must render the `<Resources>` component from `@parcel/runtime-rsc`. This is an automatically generated React component that renders the necessary `<script>` and `<link rel="stylesheet">` elements needed to render the page. This includes injecting the script containing the necessary client components for the page, as well as any CSS imported by both client and server components.

### components/client.tsx

This is the main client entrypoint, imported from each page. It uses the Parcel-specific `"use client-entry"` directive to mark that it should only run on the client, and not on the server (even during SSR). The client is responsible for hydrating the initial page, and intercepting link clicks and navigations to perform client side routing.

See the [client side routing](../server/README.md#client-side-routing) section of the server readme for a description of how this works. One difference is that we fetch statically pre-generated `.rsc` files instead of dynamically generated content from the server.

### components/Counter.tsx

This is a client component.
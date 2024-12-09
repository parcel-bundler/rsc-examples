# Parcel RSC Client Driven Example

This example is a client driven app with embedded React Server Components. This shows how you could integrate server components into an existing client rendered app.

## Setup

The example consists of the following main files:

### client/index.tsx

This is a typical index file for a client rendered React app. It calls `createRoot` and renders an `<App />` into it.

### client/App.tsx

This is the root component of the client app. It renders some client components as normal, and uses `<Suspense>` to load a React Server Component.

There is a small wrapper for the `RSC` component, which creates a `fetch` request to the server hosting the React Server Component. It uses `createFromFetch` from `react-server-dom-parcel/client` to create an RSC stream. Calling `use` on this promise causes React to suspend. Once the server component loads, it renders.

### server/server.tsx

This is the server entrypoint, built using Express. In its route handler, it creates an RSC stream using `renderToReadableStream` from `react-server-dom-parcel/server`. This renders to the RSC payload format, not to HTML, since the client app will be consuming it via `fetch` and not on initial page load.

### server/RSC.tsx

This is a server component. Since it is not rendering a full page, it does not render the `<html>` element, just the embedded content. It is marked with the Parcel-specific `"use server-entry"` directive, which creates a code splitting entrypoint. Common dependencies between entries are extracted into [shared bundles](https://parceljs.org/features/code-splitting/#shared-bundles).

Server component entries must render the `<Resources>` component from `@parcel/runtime-rsc`. This is an automatically generated React component that renders the necessary `<script>` and `<link rel="stylesheet">` elements needed to render the component. This includes injecting the script containing the necessary client components for the page, as well as any CSS imported by both client and server components. React will automatically hoist these resources into the `<head>` during rendering on the client.

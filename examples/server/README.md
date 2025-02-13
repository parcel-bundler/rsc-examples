# Parcel RSC Server Entrypoint Example

This example is a server driven app built with Parcel and React Server Components. In this setup, routing happens on the server, delivering HTML on initial page load, and client side rendering on subsequent navigations. It also demonstrates React Server Actions to perform mutations, both by calling as a function and as the target of an HTML form.

## Setup

The example consists of the following main files:

### src/server.tsx

This is the main server entrypoint, built using Express. It is the entry of the Parcel build. All other client and server dependencies are discovered from here.

### src/Todos.tsx

This is the entry React Server Component that renders the root `<html>` element, server content, and any client components. It is marked with the Parcel-specific `"use server-entry"` directive, which creates a code splitting entrypoint. Common dependencies between pages are extracted into [shared bundles](https://parceljs.org/features/code-splitting/#shared-bundles).

### src/client.tsx

This is the main client entrypoint, imported from each page. It uses the Parcel-specific `"use client-entry"` directive to mark that it should only run on the client, and not on the server (even during SSR). The client is responsible for hydrating the initial page, and intercepting link clicks and navigations to perform client side routing.

### src/actions.ts

This is a server actions file. Functions exported by this file can be imported from the client and called to send data to the server for processing. It is marked using the `"use server"` directive. When Parcel sees this directive, it places the actions into the server bundle, and creates a proxy module on the client that calls the server action via the handler in `client.tsx`.

Currently, server actions must be defined in a separate file. Inline server actions (e.g. `"use server"` inside a function) are not supported by Parcel.

### src/TodoItem.tsx and src/Dialog.tsx

These are client components. `<TodoItem>` renders a todo list item, and uses server actions and `useOptimistic` to implement the checkbox and remove buttons. `Dialog.tsx` renders a dialog component using client APIs, and accepts the create todo form (which is a server component) as children.

## Initial HTML rendering

The flow of initial rendering starts on the server.

### Server

The server handles routing using Express. When a route handler is called, it performs the following steps:

1. Render the relevant page component to an RSC payload using `renderToReadableStream` from `react-server-dom-parcel/server`.
2. If the `Accept` header includes `text/html`, create an RSC client using `createFromReadableStream` from `react-server-dom-parcel/client.edge`. This must be imported with the `{env: 'react-client'}` import attribute so that it runs in a client environment.
3. Use a client copy of React (imported with `{env: 'react-client'}`) to render the RSC payload to HTML. This involves creating a component that calls the client React's `use` hook to consume the RSC payload, and rendering it to HTML with the usual `renderToReadableStream` API from `react-dom/server.edge`.
    * NOTE: `renderToReadableStream` must be called during render for React to inject scripts during SSR properly.
    * Pass the `bootstrapScriptContent` option to inject a script that kicks off hydration on the client. This is generated by Parcel and attached to the component being rendered.
4. Embed the RSC payload into the HTML stream using `injectRSCPayload` from `rsc-html-stream/server`. This will be used by the client during hydration.

### Client

To hydrate the initial page, the client performs the following steps.

1. Read the embedded RSC payload from the initial HTML using `createFromReadableStream` from `react-server-dom-parcel/client`, and the RSC stream from `rsc-html-stream/client`.
2. Create a root `Content` component. This stores the current root element in React state. Initially this is set to `use(initialRSCPayload)`, but can be updated when client navigations occur.

## Client side routing

The client also includes a very simple router, allowing subsequent navigations after the initial page load to maintain client state without reloading the full HTML page.

### Client

The client listens for the `click` event for all link elements on the page using event delegation, as well as the `popstate` event to detect when the user navigates with the browser back button. To perform a navigation:

1. Create a fetch request for the route, with the `Accept` header set to `text/x-component` to request an RSC payload.
2. Call `createFromFetch` from `react-server-dom-parcel/client` to create an RSC stream.
3. In a React Transition (via `startTransition`), call the stored `updateRoot` function created during the initial render to update the root element in the `Content` component.
4. Once the new page is finished loading, push the new URL to the browser's history with `history.pushState`.

These steps can be customized as needed for your server setup, e.g. using a better client side router, or adding authentication headers.

### Server

The server handles fetch requests for RSC payloads using the same route handlers as for HTML. When a route handler is called, it performs the following steps:

1. Render the page component to an RSC payload using `renderToReadableStream` from `react-server-dom-parcel/server`.
2. Respond with the RSC payload directly if the `Accept` header does not include `text/html`.

## Server actions

Server actions allow the client to call the server to perform mutations and other actions. There are two ways server actions can be called: by calling an action function from the client, or by submitting an HTML form.

### Client

When a server action is called, the client is responsible for sending a request to the server. This is done by registering a handler with `setServerCallback` from `react-server-dom-parcel/client`. When a server action proxy function generated by Parcel is called on the client, this handler will be invoked with the id of the action, and the arguments to pass to it.

1. Create a `POST` request using `fetch`, and set the `rsc-action-id` header to the id of the action to call.
2. Use the `encodeReply` function from `react-server-dom-parcel/client` to set the body of the request. React will encode the arguments to the action using the RSC protocol.
3. Use `createFromFetch` from `react-server-dom-parcel/client` to create an RSC stream from the request. The server will return a new component to render, along with the return value of the server action.
4. In a React Transition (via `startTransition`), call `updateRoot` to update the root element in the `Content` component with the component returned by the server.
5. Return the result of the server action. This will be returned by the proxy function originally called in the client component.

These steps can be customized as needed for your server setup, e.g. adding authentication headers.

### Server

When the `POST` request handler is called, the server performs the following steps:

1. If the client sent a `rsc-action-id` header, the action was sent by the RSC client using `fetch`:
  1. Load the server action function using `loadServerAction` from `react-server-dom-parcel/server`. Each server action has a corresponding id, which is generated by Parcel during the build.
  2. Decode the arguments to call the action with using `decodeReply` from `react-server-dom-parcel/server`. This can accept either `FormData` (when sending things like files), or RSC's text-based encoding.
  3. Call the server action function with the loaded arguments, and await the result.
  4. Respond to the HTTP request by rendering the server component, following the steps above, and passing back the promise returned by the action as the result. This will be returned as the result of the action on the client.
2. Otherwise, the action may have been called directly by submitting an HTML `<form>` element via progressive enhancement.
  1. Call the `decodeAction` function to load the action function. This will automatically be bound with the `FormData` as an argument to the action.
  2. Call the server action function, and await the result.
  3. Respond to the HTTP request by rendering the server component, following the steps above.

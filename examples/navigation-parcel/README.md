# The Navigation router + Parcel RSC Example

This example shows [the Navigation router](https://github.com/grahammendick/navigation)'s RSC support using Parcel. It's a master/details example. The first scene is a list of 'People' and the second scene is the details of a selected 'Person'. 

The Navigation router uses Parcel's RSC support to SSR the first scene. Only the People bundle is downloaded when the example first loads.

On link clicks, the Navigation router uses Parcel's client RSC fetch to only update the content that's changed. When clicking 'Show Friends' on the Person Scene, for example, the Navigation router only fetches the Friends list and not the unchanged Person's details.

The React community has a skewed view of RSC's because they think it has to look like Next.js. But this example shows how simple RSC apps can be. There's no file-based routing, no layout files, no parallel routes. It looks just like a normal React SPA from the pre-RSC days.

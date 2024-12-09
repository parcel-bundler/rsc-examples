import {ReactElement, Suspense, use} from 'react';
import {createFromFetch} from 'react-server-dom-parcel/client';

export function App() {
  return (
    <>
      <h1>Client rendered</h1>
      <Suspense fallback={<>Loading RSC</>}>
        <RSC />
      </Suspense>
    </>
  );
}

let request: Promise<ReactElement> | null = null;

function RSC() {
  // Simple cache to make sure we only fetch once.
  if (!request) {
    let res = fetch('http://localhost:3001');
    request = createFromFetch(res);
  }

  return use(request);
}

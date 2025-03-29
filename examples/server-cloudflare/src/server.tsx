import {renderRequest, callAction} from '@parcel/rsc/server';
import {Page} from './Page';

export default {
  async fetch(req: Request) {
    const pathname = new URL(req.url).pathname;
    if (pathname === '/') {
      if (req.method === 'GET') {
        return renderRequest(req, <Page />, {component: Page});
      } else if (req.method === 'POST') {
        let id = req.headers.get('rsc-action-id');
        let result = await callAction(req, id);
        let root: any = <Page />;
        if (id) {
          root = {result, root};
        }
        return renderRequest(req, root, {component: Page});
      } else {
        return new Response('Unknown method', {status: 500});
      }
    } else {
      return new Response('Not found', {status: 404});
    }
  }
};

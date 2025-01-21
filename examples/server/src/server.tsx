import express from 'express';
import {renderRequest, callAction} from '@parcel/rsc/node';

// Page components. These must have "use server-entry" so they are treated as code splitting entry points.
import {Todos} from './Todos';

const app = express();

app.use(express.static('dist'));

app.get('/', async (req, res) => {
  await renderRequest(req, res, <Todos />, {component: Todos});
});

app.post('/', async (req, res) => {
  let id = req.get('rsc-action-id');
  let {result} = await callAction(req, id);
  let root: any = <Todos />;
  if (id) {
    root = {result, root};
  }
  await renderRequest(req, res, root, {component: Todos});
});

app.get('/todos/:id', async (req, res) => {
  await renderRequest(req, res, <Todos id={Number(req.params.id)} />, {component: Todos});
});

app.post('/todos/:id', async (req, res) => {
  let id = req.get('rsc-action-id');
  let {result} = await callAction(req, id);
  let root: any = <Todos id={Number(req.params.id)} />;
  if (id) {
    root = {result, root};
  }
  await renderRequest(req, res, root, {component: Todos});
});

app.listen(3001);
console.log('Server listening on port 3001');

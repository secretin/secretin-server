import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';

import config from './config.json';
import initializeDb from './db';
import Console from './console';

import ping from './routes/Ping';
import getUser from './routes/GetUser';
import getProtectKey from './routes/GetProtectKey';
import getDatabase from './routes/GetDatabase';
import getSecret from './routes/GetSecret';
import createUser from './routes/CreateUser';
import createSecret from './routes/CreateSecret';
import deleteSecret from './routes/DeleteSecret';
import activateTotp from './routes/ActivateTotp';
import deactivateTotp from './routes/DeactivateTotp';
import activateShortLogin from './routes/ActivateShortLogin';
import updateUser from './routes/UpdateUser';
import updateSecret from './routes/UpdateSecret';
import newKey from './routes/NewKey';
import unshare from './routes/Unshare';
import share from './routes/Share';
import testTotp from './routes/TestTotp';
import reset from './routes/Reset';

const app = express();
app.server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());

initializeDb(config, (couchdb, redis) => {
  if (process.env.TEST_SERVER) {
    app.use(Console.trace);
    Console.log('WARNING: You are in test mode, reset feature activated');
    app.use('/reset', reset({ couchdb, redis }));
  }

  app.use('/ping', ping());
  app.use('/database', getDatabase({ couchdb, redis }));
  app.use('/user', getUser({ couchdb, redis }));
  app.use('/user', createUser({ couchdb, redis }));
  app.use('/user', updateUser({ couchdb, redis }));
  app.use('/protectKey', getProtectKey({ couchdb, redis }));
  app.use('/activateTotp', activateTotp({ couchdb, redis }));
  app.use('/deactivateTotp', deactivateTotp({ couchdb, redis }));
  app.use('/activateShortLogin', activateShortLogin({ couchdb, redis }));
  app.use('/secret', getSecret({ couchdb, redis }));
  app.use('/secret', createSecret({ couchdb, redis }));
  app.use('/secret', updateSecret({ couchdb, redis }));
  app.use('/secret', deleteSecret({ couchdb, redis }));
  app.use('/share', share({ couchdb, redis }));
  app.use('/unshare', unshare({ couchdb, redis }));
  app.use('/newKey', newKey({ couchdb, redis }));
  app.use('/totp', testTotp({ couchdb, redis }));
});

app.server.listen(process.env.SECRETIN_SERVER_PORT || config.port, '0.0.0.0');

export default app;

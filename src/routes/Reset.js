import { Router } from 'express';
import bluebird from 'bluebird';

import { createViews } from '../db';
import Console from '../console';

export default ({ couchdb }) => {
  const route = Router();
  route.get('/', (req, res) => {
    bluebird.delay(500)
      .then(() => couchdb.dropDatabase(couchdb.databaseName))
      .then(() => bluebird.delay(500))
      .then(() => couchdb.createDatabase(couchdb.databaseName))
      .then(() => createViews(couchdb))
      .then(() => {
        res.json('ok');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

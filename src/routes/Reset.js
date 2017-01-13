import { Router } from 'express';

import { createViews } from '../db';
import Console from '../console';

export default ({ couchdb }) => {
  const route = Router();
  route.get('/', (req, res) => {
    couchdb.dropDatabase(couchdb.databaseName)
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

import { Router } from 'express';

import Console from '../console';
import Utils from '../utils';

function getDatabase(couchdb, name) {
  const view = '_design/secrets/_view/getDatabase';
  return couchdb
    .get(couchdb.databaseName, view, { key: name })
    .then(({ data }) =>
      data.rows.reduce(
        (secrets, { value }) => Object.assign(secrets, value),
        {}
      )
    );
}

export default ({ couchdb, redis }) => {
  const route = Router();

  route.post('/:name', (req, res) => {
    let rawUser;
    let jsonBody;
    const db = { users: {}, secrets: {} };
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.body.sig,
      data: `${req.body.json}|${req.body.sigTime}`,
    })
      .then(user => {
        rawUser = user;
        jsonBody = JSON.parse(req.body.json);
        db.users[req.params.name] = rawUser.data;
        return getDatabase(couchdb, req.params.name);
      })
      .then(secrets => {
        const updatedSecrets = {};
        Object.keys(secrets).forEach(key => {
          if (
            typeof jsonBody[key] === 'undefined' ||
            jsonBody[key] !== secrets[key].rev
          ) {
            updatedSecrets[key] = secrets[key];
          }
        });
        Object.keys(jsonBody).forEach(key => {
          if (typeof secrets[key] === 'undefined') {
            updatedSecrets[key] = false;
          }
        });
        db.secrets = updatedSecrets;
        res.json(db);
      })
      .catch(error => {
        Console.error(res, error);
      });
  });
  return route;
};

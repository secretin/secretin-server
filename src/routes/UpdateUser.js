import { Router } from 'express';
import forge from 'node-forge';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.put('/:name', (req, res) => {
    let jsonBody;
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.body.sig,
      data: `${req.body.json}|${req.body.sigTime}`,
    })
      .then(rawUser => {
        jsonBody = JSON.parse(req.body.json);
        const doc = {
          _id: rawUser.id,
          _rev: rawUser.rev,
          user: {
            [req.params.name]: rawUser.data,
          },
        };
        if (
          typeof jsonBody.pass === 'undefined' ||
          typeof jsonBody.privateKey === 'undefined'
        ) {
          if (typeof jsonBody.options === 'undefined') {
            doc.user[req.params.name].metadataCache = jsonBody;
          } else {
            doc.user[req.params.name].options = jsonBody;
          }
        } else {
          const md = forge.md.sha256.create();
          md.update(jsonBody.pass.hash);
          jsonBody.pass.hash = md.digest().toHex();

          doc.user[req.params.name].privateKey = jsonBody.privateKey;
          doc.user[req.params.name].pass = jsonBody.pass;
        }
        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        Utils.reason(res, 200, 'User updated');
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

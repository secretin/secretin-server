import { Router } from 'express';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.put('/:name', (req, res) => {
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then((rawUser) => {
        const jsonBody = JSON.parse(req.body.json);
        const doc = {
          _id: rawUser.id,
          _rev: rawUser.rev,
          user: {
            [req.params.name]: rawUser.data,
          },
        };
        doc.user[req.params.name].pass.totp = true;
        doc.user[req.params.name].seed = jsonBody.seed;
        doc.user[req.params.name].rescueCodes = Utils.generateRescueCodes();
        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        Utils.reason(res, 200, 'TOTP activated');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

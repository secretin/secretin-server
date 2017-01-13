import { Router } from 'express';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.put('/:name', (req, res) => {
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}`,
    })
      .then((rawUser) => {
        const doc = {
          _id: rawUser.id,
          _rev: rawUser.rev,
          user: {
            [req.params.name]: rawUser.data,
          },
        };
        doc.user[req.params.name].pass.totp = false;
        delete doc.user[req.params.name].seed;
        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        Utils.reason(res, 200, 'TOTP deactivated');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

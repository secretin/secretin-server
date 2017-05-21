import { Router } from 'express';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.get('/:name', (req, res) => {
    let rescueCodes;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}`,
    })
      .then((rawUser) => {
        const user = rawUser.data;

        if (user.pass.totp) {
          const doc = {
            _id: rawUser.id,
            _rev: rawUser.rev,
            user: {
              [req.params.name]: rawUser.data,
            },
          };
          rescueCodes = Utils.generateRescueCodes();
          doc.user[req.params.name].rescueCodes = rescueCodes;
          return couchdb.update(couchdb.databaseName, doc);
        }
        rescueCodes = [];
        return Promise.resolve();
      })
      .then(() => {
        res.json(rescueCodes);
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

import { Router } from 'express';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.get('/:name', (req, res) => {
    let rescueCodes;
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}|${req.query.sigTime}`,
    })
      .then(rawUser => {
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
      .catch(error => {
        Console.error(res, error);
      });
  });

  route.put('/:name', (req, res) => {
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.body.sig,
      data: `${req.body.json}|${req.body.sigTime}`,
    })
      .then(rawUser => {
        const jsonBody = JSON.parse(req.body.json);
        const user = rawUser.data;

        if (user.pass.totp) {
          const doc = {
            _id: rawUser.id,
            _rev: rawUser.rev,
            user: {
              [req.params.name]: rawUser.data,
            },
          };

          doc.user[req.params.name].rescueCodes = jsonBody.rescueCodes;
          return couchdb.update(couchdb.databaseName, doc);
        }
        return Promise.resolve();
      })
      .then(() => {
        Utils.reason(res, 200, 'RescueCodes saved');
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

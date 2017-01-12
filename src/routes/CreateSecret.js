import { Router } from 'express';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.post('/:name', (req, res) => {
    let rawUser;
    let jsonBody;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then((user) => {
        jsonBody = JSON.parse(req.body.json);
        rawUser = user;
        return Utils.secretExists({ couchdb, title: jsonBody.title });
      })
      .then(() => {
        Utils.reason(res, 403, 'Secret already exists');
      }, (error) => {
        if (error.text === 'Secret not found') {
          const doc = {
            secret: {
              [jsonBody.title]: {
                secret: jsonBody.secret,
                iv: jsonBody.iv,
                metadatas: jsonBody.metadatas,
                iv_meta: jsonBody.iv_meta,
                users: [req.params.name],
              },
            },
          };

          return couchdb.insert(couchdb.databaseName, doc);
        }
        throw error;
      })
      .then(() => {
        const doc = {
          _id: rawUser.id,
          _rev: rawUser.rev,
          user: {
            [req.params.name]: rawUser.data,
          },
        };

        doc.user[req.params.name].keys[jsonBody.title] = {
          key: jsonBody.key,
          rights: 2,
        };

        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        Utils.reason(res, 200, 'New secret saved');
      }, (error) => {
        Console.log(`SHOULD REMOVE SECRET ${jsonBody.title}!`);
        throw error;
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

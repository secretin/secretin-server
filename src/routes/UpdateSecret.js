import { Router } from 'express';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.put('/:name', (req, res) => {
    const jsonBody = JSON.parse(req.body.json);
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then((rawUser) => {
        if (typeof rawUser.data.keys[jsonBody.title].rights !== 'undefined'
            && rawUser.data.keys[jsonBody.title].rights > 0) {
          return Utils.secretExists({ couchdb, title: jsonBody.title });
        }
        throw {
          code: 403,
          text: 'You can\'t edit this secret',
        };
      })
      .then((rawSecret) => {
        const doc = {
          _id: rawSecret.id,
          _rev: rawSecret.rev,
          secret: {
            [jsonBody.title]: rawSecret.data,
          },
        };
        doc.secret[jsonBody.title].iv = jsonBody.iv;
        doc.secret[jsonBody.title].secret = jsonBody.secret;
        doc.secret[jsonBody.title].iv_meta = jsonBody.iv_meta;
        doc.secret[jsonBody.title].metadatas = jsonBody.metadatas;
        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        Utils.reason(res, 200, 'Secret updated');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

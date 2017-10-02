import { Router } from 'express';
import forge from 'node-forge';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.get('/:name/:title', (req, res) => {
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}|${req.query.sigTime}`,
    })
      .then(() => Utils.secretExists({ couchdb, title: req.params.title }))
      .then(rawSecret => {
        const secret = rawSecret.data;
        if (secret.users.indexOf(req.params.name) !== -1) {
          return secret;
        }
        throw {
          code: 404,
          text: 'Secret not found',
        };
      })
      .catch(error => {
        if (error.text === 'Secret not found') {
          return {
            secret: forge.util.bytesToHex(forge.random.getBytesSync(128)),
            iv: forge.util.bytesToHex(forge.random.getBytesSync(16)),
            users: [req.params.name],
          };
        }
        throw error;
      })
      .then(secret => {
        const newSecret = secret;
        delete newSecret.metadatas;
        delete newSecret.iv_meta;
        delete newSecret.history;
        delete newSecret.iv_history;
        res.json(newSecret);
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

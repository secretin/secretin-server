import { Router } from 'express';
import forge from 'node-forge';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.put('/:name', (req, res) => {
    let key;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then(() => {
        const jsonBody = JSON.parse(req.body.json);
        key = `protectKey_${req.params.name}_${jsonBody.shortpass.deviceId}`;
        const md = forge.md.sha256.create();
        md.update(jsonBody.shortpass.hash);

        return redis.hmsetAsync(key, [
          'salt', jsonBody.shortpass.salt,
          'iterations', jsonBody.shortpass.iterations,
          'hash', md.digest().toHex(),
          'protectKey', jsonBody.shortpass.protectKey,
        ]);
      })
      .then(() => redis.expireAsync(key, 60 * 60 * 24 * 7))
      .then(() => {
        Utils.reason(res, 200, 'Shortpass activated');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

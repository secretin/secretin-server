import { Router } from 'express';
import forge from 'node-forge';

import Console from '../console';
import Utils from '../utils';

export default ({ redis, couchdb }) => {
  const route = Router();
  let rawUser;
  let isBruteforce;
  route.get('/:name/:deviceId/:hash', (req, res) => {
    Utils.userExists({ couchdb, name: req.params.name })
      .then((user) => {
        rawUser = user;
        if (req.params.hash === 'undefined') {
          return Promise.resolve(false);
        }
        let ip;
        if (process.env.BEHIND_PROXY) {
          ip = req.headers['x-forwarded-for'] || req.ip;
        } else {
          ip = req.ip;
        }
        return Utils.checkBruteforce({ redis, ip });
      })
      .then((rIsBruteforce) => {
        isBruteforce = rIsBruteforce;
        const key = `protectKey_${req.params.name}_${req.params.deviceId}`;
        return redis.hgetallAsync(key);
      })
      .then((result) => {
        let content = result;
        const user = rawUser.data;

        const md = forge.md.sha256.create();
        md.update(req.params.hash);

        if (!content || isBruteforce || md.digest().toHex() !== content.hash) {
          if (!content) {
            content = {
              salt: forge.util.bytesToHex(forge.random.getBytesSync(32)),
              iterations: 10000,
            };
          }
          content.protectKey = forge.util.bytesToHex(forge.random.getBytesSync(128));
        }
        delete content.hash;
        content.publicKey = user.publicKey;
        content.totp = user.pass.totp;

        res.json(content);
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

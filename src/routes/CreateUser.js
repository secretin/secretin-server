import { Router } from 'express';
import forge from 'node-forge';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.post('/:name', (req, res) => {
    Utils.userExists({ couchdb, name: req.params.name })
      .then(
        () => {
          Utils.reason(res, 403, 'User already exists');
          throw 'User already exists';
        },
        error => {
          if (process.env.SECRETIN_SERVER_DISABLE_REGISTRATION) {
            Utils.reason(res, 403, 'Registration disabled');
            throw 'Registration disabled';
          } else if (error.text === 'User not found') {
            // Vulnerability reported by Lexfo
            // Malicious user, by knowing secret id could create user with permission on the secrets
            // It doesn't compromise the confidentiality but it allows the malicious user
            // to replace the secret with junk
            req.body.keys = {}
            const doc = {
              user: {
                [req.params.name]: req.body,
              },
            };
            const md = forge.md.sha256.create();
            md.update(req.body.pass.hash);
            doc.user[req.params.name].pass.hash = md.digest().toHex();
            return couchdb.insert(couchdb.databaseName, doc);
          }
          return Promise.reject(error);
        }
      )
      .then(() => {
        Utils.reason(res, 200, 'New user saved');
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

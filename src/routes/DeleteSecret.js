import { Router } from 'express';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.delete('/:name/:title', (req, res) => {
    let rawUser;
    let rawSecret;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: `DELETE ${req.baseUrl}${url.parse(req.url).pathname}`,
    })
      .then((user) => {
        rawUser = user;
        return Utils.secretExists({ couchdb, title: req.params.title });
      })
      .then((secret) => {
        rawSecret = secret;
        if (typeof rawUser.data.keys[req.params.title].rights !== 'undefined'
            && rawUser.data.keys[req.params.title].rights > 1) {
          const userPromises = [];
          rawSecret.data.users.forEach((username) => {
            userPromises.push(
              Utils.userExists({ couchdb, name: username })
                .then(user => ({
                  user,
                  name: username,
                })));
          });
          return Promise.all(userPromises);
        }
        throw {
          code: 403,
          text: 'You can\'t delete this secret',
        };
      })
      .then((users) => {
        const userPromises = [];
        users.forEach((user) => {
          const doc = {
            _id: user.user.id,
            _rev: user.user.rev,
            user: {
              [user.name]: user.user.data,
            },
          };
          delete doc.user[user.name].keys[req.params.title];
          userPromises.push(couchdb.update(couchdb.databaseName, doc));
        });
        return Promise.all(userPromises);
      })
      .then(() => couchdb.del(couchdb.databaseName, rawSecret.id, rawSecret.rev))
      .then(() => {
        Utils.reason(res, 200, 'Secret deleted');
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

import { Router } from 'express';
import url from 'url';
import _ from 'lodash';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.delete('/:name/:title', (req, res) => {
    let rawUser;
    let rawSecret;
    let usersNotFound;
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.body.sig,
      data: `DELETE ${req.baseUrl}${url.parse(req.url).pathname}|${req.body
        .sigTime}`,
    })
      .then(user => {
        rawUser = user;
        return Utils.secretExists({ couchdb, title: req.params.title });
      })
      .then(secret => {
        rawSecret = secret;
        if (
          typeof rawUser.data.keys[req.params.title].rights !== 'undefined' &&
          rawUser.data.keys[req.params.title].rights > 1
        ) {
          const userPromises = [];
          rawSecret.data.users.forEach(username => {
            userPromises.push(
              Utils.userExists(
                { couchdb, name: username },
                false
              ).then(user => ({
                user,
                name: username,
              }))
            );
          });
          return Promise.all(userPromises);
        }
        throw {
          code: 403,
          text: "You can't delete this secret",
        };
      })
      .then(users => {
        usersNotFound = _.remove(users, user => user.user.notFound);
        const userPromises = [];
        users.forEach(user => {
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
      .then(() =>
        couchdb.del(couchdb.databaseName, rawSecret.id, rawSecret.rev)
      )
      .then(() => {
        if (usersNotFound.length > 0) {
          Console.logDesync(usersNotFound);
          res.json(usersNotFound);
        } else {
          Utils.reason(res, 200, 'Secret deleted');
        }
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

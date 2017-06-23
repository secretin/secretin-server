import { Router } from 'express';
import _ from 'lodash';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.post('/:name', (req, res) => {
    let jsonBody;
    let usersNotFound;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then((user) => {
        jsonBody = JSON.parse(req.body.json);
        if (typeof user.data.keys[jsonBody.title].rights !== 'undefined'
            && user.data.keys[jsonBody.title].rights > 1) {
          return Utils.secretExists({ couchdb, title: jsonBody.title });
        }
        throw {
          code: 403,
          text: 'You can\'t generate new key for this secret',
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
        doc.secret[jsonBody.title].secret = jsonBody.secret.secret;
        doc.secret[jsonBody.title].iv = jsonBody.secret.iv;
        doc.secret[jsonBody.title].iv_meta = jsonBody.secret.iv_meta;
        doc.secret[jsonBody.title].metadatas = jsonBody.secret.metadatas;
        doc.secret[jsonBody.title].iv_history = jsonBody.secret.iv_history;
        doc.secret[jsonBody.title].history = jsonBody.secret.history;
        return couchdb.update(couchdb.databaseName, doc);
      })
      .then(() => {
        const userPromises = [];
        jsonBody.wrappedKeys.forEach((wrappedKey) => {
          userPromises.push(
            Utils.userExists({ couchdb, name: wrappedKey.user }, false)
              .then(user => ({
                user,
                name: wrappedKey.user,
                key: wrappedKey.key,
              })));
        });
        return Promise.all(userPromises);
      })
      .then((users) => {
        usersNotFound = _.remove(users, user => user.user.notFound);
        const userPromises = [];
        users.forEach((user) => {
          const doc = {
            _id: user.user.id,
            _rev: user.user.rev,
            user: {
              [user.name]: user.user.data,
            },
          };

          doc.user[user.name].keys[jsonBody.title].key = user.key;
          userPromises.push(couchdb.update(couchdb.databaseName, doc));
        });
        return Promise.all(userPromises);
      })
      .then(() => {
        if (usersNotFound.length > 0) {
          Console.logDesync(usersNotFound);
          res.json(usersNotFound);
        } else {
          Utils.reason(res, 200, 'New key reshared');
        }
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

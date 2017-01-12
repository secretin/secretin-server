import { Router } from 'express';
import _ from 'lodash';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb }) => {
  const route = Router();
  route.post('/:name', (req, res) => {
    let jsonBody;
    let buggySecretObjects;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.body.sig,
      data: req.body.json,
    })
      .then((rUser) => {
        jsonBody = JSON.parse(req.body.json);
        const secretPromises = [];
        let notYourself;
        jsonBody.secretObjects.forEach((secretObject) => {
          notYourself = (req.params.name !== secretObject.friendName);
          if (typeof rUser.data.keys[secretObject.hashedTitle].rights !== 'undefined'
              && rUser.data.keys[secretObject.hashedTitle].rights > 1
              && notYourself) {
            let secret;
            secretPromises.push(
              Utils.secretExists({ couchdb, title: secretObject.hashedTitle }, false)
                .then((rSecret) => {
                  secret = rSecret;
                  return Utils.userExists({ couchdb, name: secretObject.friendName }, false);
                }).then(user => ({
                  user,
                  secret,
                  secretObject,
                })));
          }
        });
        if (secretPromises.length === 0) {
          let text;
          let code = 403;
          if (!notYourself && jsonBody.secretObjects.length === 1) {
            text = 'You can\'t share with yourself';
          } else if (jsonBody.secretObjects.length === 0) {
            text = 'Nothing to do';
            code = 200;
          } else {
            text = 'You can\'t share this secret';
          }
          throw {
            code,
            text,
          };
        }
        return Promise.all(secretPromises);
      })
      .then((data) => {
        buggySecretObjects = _.remove(data, datum => datum.user.notFound || datum.secret.notFound);
        const docsSecret = {};
        const docsUser = {};
        data.forEach(({ user, secret, secretObject }) => {
          let docSecret;
          if (secret.id in docsSecret) {
            docSecret = docsSecret[secret.id];
          } else {
            docSecret = {
              _id: secret.id,
              _rev: secret.rev,
              secret: {
                [secretObject.hashedTitle]: secret.data,
              },
            };
            docsSecret[secret.id] = docSecret;
          }
          docSecret.secret[secretObject.hashedTitle].users.push(secretObject.friendName);
          const uniqUsers = _.uniq(docSecret.secret[secretObject.hashedTitle].users);
          docSecret.secret[secretObject.hashedTitle].users = uniqUsers;

          let docUser;
          if (user.id in docsUser) {
            docUser = docsUser[user.id];
          } else {
            docUser = {
              _id: user.id,
              _rev: user.rev,
              user: {
                [secretObject.friendName]: user.data,
              },
            };
            docsUser[user.id] = docUser;
          }

          docUser.user[secretObject.friendName].keys[secretObject.hashedTitle] = {
            key: secretObject.wrappedKey,
            rights: secretObject.rights,
          };
        });

        const promises = [];
        Object.keys(docsUser).forEach((id) => {
          promises.push(couchdb.update(couchdb.databaseName, docsUser[id]));
        });
        Object.keys(docsSecret).forEach((id) => {
          promises.push(couchdb.update(couchdb.databaseName, docsSecret[id]));
        });
        return Promise.all(promises);
      })
      .then(() => {
        if (buggySecretObjects.length > 0) {
          Console.logDesync(buggySecretObjects);
          res.json(buggySecretObjects);
        } else {
          Utils.reason(res, 200, 'Secret shared');
        }
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  return route;
};

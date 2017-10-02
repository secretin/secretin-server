import { Router } from 'express';
import _ from 'lodash';

import Console from '../console';
import Utils from '../utils';

export default ({ couchdb, redis }) => {
  const route = Router();
  route.post('/:name', (req, res) => {
    let jsonBody;
    let docSecret;
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.body.sig,
      data: `${req.body.json}|${req.body.sigTime}`,
    })
      .then(user => {
        jsonBody = JSON.parse(req.body.json);
        if (
          typeof user.data.keys[jsonBody.title].rights !== 'undefined' &&
          user.data.keys[jsonBody.title].rights > 1
        ) {
          return Utils.secretExists({ couchdb, title: jsonBody.title });
        }
        throw {
          code: 403,
          text: "You can't unshare this secret",
        };
      })
      .then(rawSecret => {
        docSecret = {
          _id: rawSecret.id,
          _rev: rawSecret.rev,
          secret: {
            [jsonBody.title]: rawSecret.data,
          },
        };
        const userPromises = [];
        let notYourself;
        _.uniq(jsonBody.friendNames).forEach(friendName => {
          notYourself = req.params.name !== friendName;
          if (notYourself && rawSecret.data.users.indexOf(friendName) !== -1) {
            userPromises.push(
              Utils.userExists(
                { couchdb, name: friendName },
                false
              ).then(user => ({
                user,
                name: friendName,
              }))
            );
          }
        });
        if (userPromises.length === 0) {
          if (!notYourself && jsonBody.friendNames.length === 1) {
            throw {
              code: 200,
              text: "You can't unshare with yourself",
            };
          } else {
            throw {
              code: 403,
              text: 'Secret not shared with this user',
            };
          }
        }
        return Promise.all(userPromises);
      })
      .then(rawUsers => {
        const usersNotFound = _.remove(rawUsers, user => user.user.notFound);
        const userPromises = [];
        rawUsers.forEach(rawUser => {
          if (typeof rawUser.user.data.keys[jsonBody.title] !== 'undefined') {
            const doc = {
              _id: rawUser.user.id,
              _rev: rawUser.user.rev,
              user: {
                [rawUser.name]: rawUser.user.data,
              },
            };
            delete doc.user[rawUser.name].keys[jsonBody.title];
            userPromises.push(
              couchdb.update(couchdb.databaseName, doc).then(() => {
                _.remove(
                  docSecret.secret[jsonBody.title].users,
                  username => username === rawUser.name
                );
              })
            );
          }
        });
        usersNotFound.forEach(userNotFound => {
          _.remove(
            docSecret.secret[jsonBody.title].users,
            username => username === userNotFound.name
          );
        });
        return Promise.all(userPromises);
      })
      .then(() => couchdb.update(couchdb.databaseName, docSecret))
      .then(() => {
        Utils.reason(res, 200, 'Secret unshared');
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  return route;
};

import { Router } from 'express';
import url from 'url';
import _ from 'lodash';

import Console from '../console';
import Utils from '../utils';


export default ({ couchdb }) => {
  const route = Router();
  route.get('/:name', (req, res) => {
    let rawUser;
    const db = { users: {}, secrets: {} };
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}`,
    })
      .then((user) => {
        rawUser = user;
        db.users[req.params.name] = rawUser.data;
        const hashedTitles = Object.keys(rawUser.data.keys);
        const secretPromises = [];
        if (hashedTitles.length !== 0) {
          hashedTitles.forEach((hashedTitle) => {
            secretPromises.push(
              Utils.secretExists({ couchdb, title: hashedTitle }, false)
                .then(secret => ({
                  secret,
                  title: hashedTitle,
                })));
          });
          return Promise.all(secretPromises);
        }
        return Promise.resolve([]);
      })
      .then((secrets) => {
        _.remove(secrets, secret => secret.secret.notFound);
        secrets.forEach((rawSecret) => {
          const secret = rawSecret.secret.data;
          db.secrets[rawSecret.title] = secret;
          db.secrets[rawSecret.title].users = [req.params.name];
        });

        res.json(db);
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });
  return route;
};

import { Router } from 'express';
import forge from 'node-forge';
import speakeasy from 'speakeasy';
import url from 'url';
import compare from 'secure-compare';

import Console from '../console';
import Utils from '../utils';

function getAllMetadatas(couchdb, name) {
  const view = '_design/secrets/_view/getMetadatas';
  return couchdb
    .get(couchdb.databaseName, view, { key: name })
    .then(({ data }) =>
      data.rows.reduce(
        (allMetadatas, { value }) => Object.assign(allMetadatas, value),
        {}
      )
    );
}

export default ({ redis, couchdb }) => {
  const route = Router();
  route.get('/:name/:hash', (req, res) => {
    let rawUser;
    let submitUser;
    let totpValid;
    let isBruteforce;
    Utils.userExists({ couchdb, name: req.params.name })
      .then(user => {
        rawUser = user;
        if (req.params.hash === 'undefined') {
          return Promise.resolve(false);
        }
        let ip;
        if (
          process.env.BEHIND_REVERSE_PROXY &&
          process.env.BEHIND_REVERSE_PROXY === '1'
        ) {
          ip = req.headers['x-forwarded-for'] || req.ip;
        } else {
          ip = req.ip;
        }
        return Utils.checkBruteforce({ redis, ip });
      })
      .then(rIsBruteforce => {
        submitUser = rawUser.data;
        isBruteforce = rIsBruteforce;
        if (isBruteforce) {
          return Promise.resolve();
        }

        totpValid = true;
        if (submitUser.pass.totp && req.params.hash !== 'undefined') {
          totpValid = false;
          const protectedSeed = Utils.hexStringToUint8Array(submitUser.seed);
          const hash = Utils.hexStringToUint8Array(req.params.hash);
          const seed = Utils.bytesToHexString(
            Utils.xorSeed(hash, protectedSeed)
          );
          totpValid = speakeasy.totp.verify({
            secret: seed,
            encoding: 'hex',
            token: req.query.otp,
          });
          if (
            !totpValid &&
            typeof submitUser.rescueCodes !== 'undefined' &&
            submitUser.rescueCodes.shift() === parseInt(req.query.otp, 10)
          ) {
            totpValid = true;
            const doc = {
              _id: rawUser.id,
              _rev: rawUser.rev,
              user: {
                [req.params.name]: rawUser.data,
              },
            };

            doc.user[req.params.name].rescueCodes = submitUser.rescueCodes;

            if (submitUser.rescueCodes.length === 0) {
              submitUser.pass.totp = false;
              doc.user[req.params.name].pass.totp = false;
              delete doc.user[req.params.name].seed;
              delete doc.user[req.params.name].rescueCodes;
            }
            return couchdb.update(couchdb.databaseName, doc);
          }
        }
        return Promise.resolve();
      })
      .then(() => {
        const md = forge.md.sha256.create();
        md.update(req.params.hash);

        const validHash = compare(md.digest().toHex(), submitUser.pass.hash);
        if (!totpValid || isBruteforce || !validHash) {
          submitUser.privateKey = {
            privateKey: forge.util.bytesToHex(forge.random.getBytesSync(3232)),
            iv: forge.util.bytesToHex(forge.random.getBytesSync(16)),
          };
        }

        delete submitUser.options;
        delete submitUser.keys;
        delete submitUser.seed;
        delete submitUser.rescueCodes;
        delete submitUser.pass.hash;
        res.json(submitUser);
      })
      .catch(error => {
        Console.error(res, error);
      });
  });

  route.get('/:name', (req, res) => {
    let rawUser;
    Utils.checkSignature({
      couchdb,
      redis,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}|${req.query.sigTime}`,
    })
      .then(user => {
        rawUser = user;
        return getAllMetadatas(couchdb, req.params.name);
      })
      .then(allMetadatas => {
        const user = rawUser.data;
        user.metadatas = allMetadatas;
        delete user.seed;
        delete user.rescueCodes;
        delete user.pass.hash;
        res.json(user);
      })
      .catch(error => {
        Console.error(res, error);
      });
  });
  return route;
};

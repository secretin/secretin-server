import { Router } from 'express';
import forge from 'node-forge';
import speakeasy from 'speakeasy';
import url from 'url';

import Console from '../console';
import Utils from '../utils';

function getAllMetadatas(couchdb, name) {
  const view = '_design/secrets/_view/getMetadatas';
  return couchdb.get(couchdb.databaseName, view, { key: name })
    .then(({ data }) => {
      const allMetadatas = {};
      data.rows.forEach((row) => {
        allMetadatas[row.value.res.title] = {
          iv: row.value.res.iv_meta,
          secret: row.value.res.metadatas,
        };
      });
      return allMetadatas;
    });
}

export default ({ redis, couchdb }) => {
  const route = Router();
  route.get('/:name/:hash', (req, res) => {
    let rawUser;
    let submitUser;
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
      .then((isBruteforce) => {
        submitUser = rawUser.data;

        let totpValid = true;
        if (submitUser.pass.totp && req.params.hash !== 'undefined') {
          totpValid = false;
          const protectedSeed = Utils.hexStringToUint8Array(submitUser.seed);
          const hash = Utils.hexStringToUint8Array(req.params.hash);
          const seed = Utils.bytesToHexString(Utils.xorSeed(hash, protectedSeed));
          totpValid = speakeasy.totp.verify({
            secret: seed,
            encoding: 'hex',
            token: req.query.otp,
          });
        }

        const md = forge.md.sha256.create();
        md.update(req.params.hash);

        // if something goes wrong, send fake private key
        if (!totpValid || isBruteforce || md.digest().toHex() !== submitUser.pass.hash) {
          submitUser.privateKey = {
            privateKey: forge.util.bytesToHex(forge.random.getBytesSync(3232)),
            iv: forge.util.bytesToHex(forge.random.getBytesSync(16)),
          };
          submitUser.keys = {};
          submitUser.options = { options: '', signature: '' };
          return Promise.resolve({});
        }

        return getAllMetadatas(couchdb, req.params.name);
      })
      .then((allMetadatas) => {
        submitUser.metadatas = allMetadatas;
        delete submitUser.seed;
        delete submitUser.pass.hash;
        res.json(submitUser);
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });

  route.get('/:name', (req, res) => {
    let rawUser;
    Utils.checkSignature({
      couchdb,
      name: req.params.name,
      sig: req.query.sig,
      data: `${req.baseUrl}${url.parse(req.url).pathname}`,
    })
      .then((user) => {
        rawUser = user;
        return getAllMetadatas(couchdb, req.params.name);
      })
      .then((allMetadatas) => {
        const user = rawUser.data;
        user.metadatas = allMetadatas;
        delete user.seed;
        delete user.pass.hash;
        res.json(user);
      })
      .catch((error) => {
        Console.error(res, error);
      });
  });
  return route;
};

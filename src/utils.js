/* eslint no-bitwise: ["error", { "allow": ["^"] }] */
import forge from 'node-forge';
import Console from './console';

const rsa = forge.pki.rsa;
const BigInteger = forge.jsbn.BigInteger;

function reason(res, code, text) {
  res.writeHead(code, text, {});
  res.end(JSON.stringify({ reason: text }));
}

function dataExists(couchdb, view, key) {
  return couchdb.get(couchdb.databaseName, view, { key })
    .then(({ data }) => {
      if (data.rows.length === 1) {
        return {
          id: data.rows[0].id,
          rev: data.rows[0].value.rev,
          data: data.rows[0].value.res,
        };
      }
      throw 'Not found';
    })
    .catch((error) => {
      if (error.code === 'EDOCMISSING') {
        throw 'Not found';
      }
      throw error;
    });
}

function secretExists({ couchdb, title }, throwNotFound = true) {
  const view = '_design/secrets/_view/getSecret';
  return dataExists(couchdb, view, title)
    .catch((error) => {
      if (error === 'Not found') {
        if (throwNotFound) {
          throw {
            code: 404,
            text: 'Secret not found',
          };
        } else {
          return { title, notFound: true };
        }
      } else {
        throw error;
      }
    });
}

function userExists({ couchdb, name }, throwNotFound = true) {
  const view = '_design/users/_view/getUser';
  return dataExists(couchdb, view, name)
    .catch((error) => {
      if (error === 'Not found') {
        if (throwNotFound) {
          throw {
            code: 404,
            text: 'User not found',
          };
        } else {
          return { name, notFound: true };
        }
      } else {
        throw error;
      }
    });
}

function checkBruteforce({ redis, ip }) {
  let tries;
  return redis.getAsync(`bf_${ip}`)
    .then((result) => {
      tries = result ? parseInt(result, 10) + 1 : 1;
      return redis.setexAsync(`bf_${ip}`, tries * 60, tries);
    })
    .then(() => {
      if (tries > 5) {
        if (process.env.TEST_SERVER) {
          return false;
        }
        return true;
      }
      return false;
    });
}

function hexStringToUint8Array(hexString) {
  if (hexString.length % 2 !== 0) {
    throw 'Invalid hexString';
  }
  const arrayBuffer = new Uint8Array(hexString.length / 2);

  for (let i = 0; i < hexString.length; i += 2) {
    const byteValue = parseInt(hexString.substr(i, 2), 16);
    if (isNaN(byteValue)) {
      throw 'Invalid hexString';
    }
    arrayBuffer[i / 2] = byteValue;
  }

  return arrayBuffer;
}


function bytesToHexString(givenBytes) {
  if (!givenBytes) {
    return null;
  }

  const bytes = new Uint8Array(givenBytes);
  const hexBytes = [];

  for (let i = 0; i < bytes.length; i += 1) {
    let byteString = bytes[i].toString(16);
    if (byteString.length < 2) {
      byteString = `0${byteString}`;
    }
    hexBytes.push(byteString);
  }
  return hexBytes.join('');
}

function xorSeed(byteArray1, byteArray2) {
  if (byteArray1.length === byteArray2.length && byteArray1.length === 32) {
    const buf = new Uint8Array(32);
    let i;
    for (i = 0; i < 32; i += 1) {
      buf[i] = byteArray1[i] ^ byteArray2[i];
    }
    return buf;
  }
  throw 'xorSeed wait for 32 bytes arrays';
}

function checkSignature({ couchdb, name, sig, data }) {
  return userExists({ couchdb, name })
    .then((rawUser) => {
      const user = rawUser.data;
      const n = new Buffer(user.publicKey.n, 'base64');
      const e = new Buffer(user.publicKey.e, 'base64');

      const publicKey = rsa.setPublicKey(new BigInteger(n.toString('hex'), 16), new BigInteger(e.toString('hex'), 16));
      const signature = new Buffer(sig, 'hex');

      const pss = forge.pss.create({
        md: forge.md.sha256.create(),
        mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
        saltLength: 32,
      });

      const md = forge.md.sha256.create();
      md.update(data, 'utf8');

      const valid = publicKey.verify(md.digest().getBytes(), signature, pss);
      if (valid) {
        return rawUser;
      }
      throw 'Invalid';
    }).catch((error) => {
      if (error !== 'Invalid') {
        Console.log(error);
      }
      throw {
        code: 403,
        text: 'Invalid signature',
      };
    });
}

const Utils = {
  userExists,
  reason,
  checkBruteforce,
  hexStringToUint8Array,
  bytesToHexString,
  xorSeed,
  checkSignature,
  secretExists,
};

export default Utils;

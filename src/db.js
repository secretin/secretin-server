import CouchDB from 'node-couchdb';
import Redis from 'redis';
import bluebird from 'bluebird';
import url from 'url';

bluebird.promisifyAll(Redis.RedisClient.prototype);
bluebird.promisifyAll(Redis.Multi.prototype);

export function createViews(couchdb) {
  return couchdb
    .insert(couchdb.databaseName, {
      _id: '_design/secrets',
      language: 'javascript',
      views: {
        getSecret: {
          // VIEW getSecret
          map: `
function (doc) {
  if(doc.secret){
    var key = Object.keys(doc.secret)[0];
    emit(key, {res: doc.secret[key], rev: doc._rev});
  }
}
            `,
          // END VIEW
        },
        getMetadatas: {
          // VIEW getMetadatas
          map: `
function (doc) {
  if(doc.secret){
    var key = Object.keys(doc.secret)[0];
    doc.secret[key].users.forEach(function(user){
      var res = {};
      res[key] = {
        iv: doc.secret[key].iv_meta,
        secret: doc.secret[key].metadatas,
      };
      emit(user, res);
    });
  }
}
            `,
          // END VIEW
        },
        getDatabase: {
          // VIEW getDatabase
          map: `
function (doc) {
  if(doc.secret){
    var key = Object.keys(doc.secret)[0];
    doc.secret[key].users.forEach(function(user){
      var res = {};
      res[key] = JSON.parse(JSON.stringify(doc.secret[key]));
      res[key].users = [user];
      res[key].rev = doc._rev;
      emit(user, res);
    });
  }
}
            `,
          // END VIEW
        },
      },
    })
    .then(() =>
      couchdb.insert(couchdb.databaseName, {
        _id: '_design/users',
        language: 'javascript',
        views: {
          getUser: {
            // VIEW getUser
            map: `
function (doc) {
  if(doc.user){
    var key = Object.keys(doc.user)[0];
    emit(key, {res: doc.user[key], rev: doc._rev});
  }
}
            `,
            // END VIEW
          },
        },
      })
    );
}

export default (config, callback) => {
  const redisClient = Redis.createClient(
    process.env.SECRETIN_SERVER_REDIS_URL || config.redisConnection || null
  );
  const couchdbUrl = url.parse(
    process.env.SECRETIN_SERVER_COUCHDB_URL || config.couchdbConnection
  );

  const couchDBConnection = {
    host: couchdbUrl.hostname,
    port: couchdbUrl.port,
    protocol: couchdbUrl.protocol.substring(0, couchdbUrl.protocol.length - 1),
  };

  if (couchdbUrl.auth) {
    const [user, pass] = couchdbUrl.auth.split(':');
    couchDBConnection.auth = {
      user,
      pass,
    };
  }

  const couchDBClient = new CouchDB(couchDBConnection);
  couchDBClient.databaseName = process.env.TEST_SERVER
    ? `${couchdbUrl.pathname.substr(1)}test`
    : couchdbUrl.pathname.substr(1);
  couchDBClient
    .createDatabase(couchDBClient.databaseName)
    .then(
      () => createViews(couchDBClient),
      error => {
        if (error.code !== 'EDBEXISTS') {
          throw error;
        }
      }
    )
    .then(() => callback(couchDBClient, redisClient))
    .catch(error => {
      throw error;
    });
};

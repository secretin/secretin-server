import CouchDB from 'node-couchdb';
import Redis from 'redis';
import bluebird from 'bluebird';

bluebird.promisifyAll(Redis.RedisClient.prototype);
bluebird.promisifyAll(Redis.Multi.prototype);

export function createViews(couchdb) {
  return couchdb.insert(couchdb.databaseName, {
    _id: '_design/secrets',
    language: 'javascript',
    views: {
      getSecret: {
        map: `function (doc) {
                if(doc.secret){
                  var key = Object.keys(doc.secret)[0];
                  emit(key, {res: doc.secret[key], rev: doc._rev});
                }
              }`,
      },
      getMetadatas: {
        map: `function (doc) {
                if(doc.secret){
                  var key = Object.keys(doc.secret)[0];
                  var res = doc.secret[key].users;
                  doc.secret[key].users.forEach(function(user){
                    emit(user, {res: {title: key, iv_meta: doc.secret[key].iv_meta, metadatas: doc.secret[key].metadatas}, rev: doc._rev});
                  });
                }
              }`,
      },
    },
  }).then(() => couchdb.insert(couchdb.databaseName, {
    _id: '_design/users',
    language: 'javascript',
    views: {
      getUser: {
        map: `function (doc) {
                if(doc.user){
                  var key = Object.keys(doc.user)[0];
                  emit(key, {res: doc.user[key], rev: doc._rev});
                }
              }`,
      },
    },
  }));
}

export default (config, callback) => {
  const redisClient = Redis.createClient(
    process.env.SECRETIN_SERVER_REDIS_URL || config.redisConnection || null);
  const couchDBConnection = {
    host: process.env.SECRETIN_SERVER_COUCHDB_HOST || config.couchDBConnection.host,
    port: process.env.SECRETIN_SERVER_COUCHDB_PORT || config.couchDBConnection.port,
    protocol: process.env.SECRETIN_SERVER_COUCHDB_PROTOCOL || config.couchDBConnection.protocol,
    auth: {
      user: process.env.SECRETIN_SERVER_COUCHDB_USER || config.couchDBConnection.auth.user,
      pass: process.env.SECRETIN_SERVER_COUCHDB_PASS || config.couchDBConnection.auth.pass,
    },
  };

  if ((process.env.SECRETIN_SERVER_COUCHDB_AUTH && process.env.SECRETIN_SERVER_COUCHDB_AUTH !== '1')
      || !config.couchDBAuth) {
    delete couchDBConnection.auth;
  }

  const couchDBClient = new CouchDB(couchDBConnection);
  couchDBClient.databaseName = process.env.SECRETIN_SERVER_COUCHDB_DBNAME || process.env.TEST_SERVER ? `${config.couchDBName}test` : config.couchDBName;

  couchDBClient.createDatabase(couchDBClient.databaseName)
    .then(() => createViews(couchDBClient)
    , (error) => {
      if (error.code !== 'EDBEXISTS') {
        throw error;
      }
    })
    .then(() => callback(couchDBClient, redisClient))
    .catch((error) => {
      throw error;
    });
};

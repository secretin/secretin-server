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
  const redisClient = Redis.createClient(config.redisConnection || null);
  const couchDBClient = new CouchDB(config.couchDBConnection || null);
  couchDBClient.databaseName = config.couchDBName;

  couchDBClient.createDatabase(config.couchDBName)
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

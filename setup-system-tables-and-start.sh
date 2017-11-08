#!/bin/bash

until curl http://couchdb:5984
do
  sleep 1
done

curl -X PUT http://couchdb:5984/_global_changes
curl -X PUT http://couchdb:5984/_metadata
curl -X PUT http://couchdb:5984/_replicator
curl -X PUT http://couchdb:5984/_users

if [ $OLD_SECRETIN_SERVER_COUCHDB_URL ];
  then
    curl -X PUT $SECRETIN_SERVER_COUCHDB_URL
    until curl http://couchdb_old:5984
    do
      sleep 1
    done
    curl http://couchdb:5984/_replicate \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "{\"source\": \"$OLD_SECRETIN_SERVER_COUCHDB_URL\", \"target\": \"$SECRETIN_SERVER_COUCHDB_URL\"}"
fi

yarn start
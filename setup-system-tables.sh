#!/bin/bash

secretin_server_couchdb_url=`echo $SECRETIN_SERVER_COUCHDB_URL | cut -d'/' -f1-3`

until curl $secretin_server_couchdb_url
do
  sleep 1
done

curl -X PUT $secretin_server_couchdb_url/_global_changes
curl -X PUT $secretin_server_couchdb_url/_metadata
curl -X PUT $secretin_server_couchdb_url/_replicator
curl -X PUT $secretin_server_couchdb_url/_users

yarn start
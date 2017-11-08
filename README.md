# secretin-server
💾 Server side of Secretin. Keep your data safe.

Use `docker-compose up` to run couchdb, redis and secretin-server api ready to use.

To use test in server mode from secretin-lib, you have to run :

`docker-compose -f docker-compose.yml -f docker-compose.test.yml up`

It will add `/reset` route to wipe the database during tests.

The server will listen on port 3000.

## Migrate from couchdb 1.6.1 to couchdb 2.1.1

To migrate with docker-compose
```
git pull origin master
docker-compose build
docker-compose -f docker-compose.yml -f docker-compose.migrate.1_6_1__2_1_1.yml up
```

then you can run `docker-compose up` as usual

## Setup in production

You'll need a redis server and a couchdb server as databases.

Install nodejs -> https://nodejs.org/

On your server, create a service user : `adduser --system --shell /bin/bash --disabled-password --home /home/secretin secretin`

Download the last release https://github.com/secretin/secretin-server/releases and extract the tar.gz

`cd dist && npm install --production`

Install forever globally : `npm install -g forever`

Add this script in `/etc/init.d/secretin`

```
#! /bin/sh -e

DAEMON_DIR="/home/secretin/dist/"
DAEMON_LOGDIR="/home/secretin/"
DAEMON_UID="secretin"
DAEMON_NAME="secretin"
PORT=3000
REDIS_URL="redis://anonymous@your-redis-server:6379"
COUCHDB_URL="http://admin:pass@your-couchdb-server:5984/databasename"
BEHIND_REVERSE_PROXY=0

case "$1" in
  start)
  echo "Starting $DAEMON_NAME..."
  sudo -H -u secretin BEHIND_REVERSE_PROXY=$BEHIND_REVERSE_PROXY SECRETIN_SERVER_PORT=$PORT SECRETIN_SERVER_COUCHDB_URL=$COUCHDB_URL SECRETIN_SERVER_REDIS_URL=$REDIS_URL \
      forever start --sourceDir=$DAEMON_DIR --workingDir=$DAEMON_DIR -a -o $DAEMON_LOGDIR"access.log" -e $DAEMON_LOGDIR"error.log" --uid $DAEMON_UID index.js
  ;;

  stop)
  echo "Stoping $DAEMON_NAME..."
  sudo -H -u secretin forever stop $DAEMON_UID
  ;;

  *)
  echo "Usage: /etc/init.d/$DAEMON_NAME {start|stop}"
  exit 1
  ;;
esac

exit 0
```

Then make it executable and add the service at start.

`chmod 755 /etc/init.d/secretin && update-rc.d secretin defaults`

Start it : `/etc/init.d/secretin start`

Try to access the ping interface : `curl http://your-secretin-ip:3000/ping`

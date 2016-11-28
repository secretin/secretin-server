# secretin-server
💾 Server side of Secretin. Keep your data safe.

Use `docker-compose up` to run couchdb, redis and secretin-server api ready to use.

To use test in server mode from secretin-lib, you have to run :

`docker-compose -f docker-compose.yml -f docker-compose.test.yml up`

It will add `/reset` route to wipe the database during tests.

#!/bin/sh

# Copyright 2020 OCAD University
#
# Licensed under the New BSD license. You may not use this file except in
# compliance with this License.

# Shuts down the docker container running the database and removes the
# containers.

# Default values
POSTGRES_MAIN_CONTAINER=${POSTGRES_MAIN_CONTAINER:-"PersonalDataPostgres"}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-"admin"}
PGDATABASE=${PGDATABASE:-"personalData"}

log() {
  echo "$(date +'%Y-%m-%d %H:%M:%S') - $1"
}

log "POSTGRES_MAIN_CONTAINER: $POSTGRES_MAIN_CONTAINER"
log "PGPORT: $PGPORT"
log "PGUSER: $PGUSER"
log "PGDATABASE: $PGDATABASE"

log "Removing the database from the Postgres docker container..."
docker exec $POSTGRES_MAIN_CONTAINER \
    dropdb -p $PGPORT -U $PGUSER -f --echo $PGDATABASE

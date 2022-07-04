#!/bin/bash

# This script is used to work around github.com/appleboy/ssh-action/issues/166
# If this bug is ever fixed, all the commands can be moved inside the GHA workflow in a single step
# and this script can be removed

set -e -o pipefail

export PDS_SERVERPORT=38095
export PDS_DOMAIN=https://pds.fluidproject.org

cd /srv/fluid-pds-main
/usr/local/bin/docker-compose up -d --force-recreate

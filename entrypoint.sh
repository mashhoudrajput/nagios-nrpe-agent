#!/bin/sh
set -e

# Set allowed hosts, fallback to default if not provided
ALLOWED_HOSTS="${ALLOWED_HOSTS:-52.208.159.63}"

# Replace placeholder in the config
sed -i "s/__ALLOWED_HOSTS__/${ALLOWED_HOSTS}/g" /etc/nagios/nrpe.cfg

echo "Starting NRPE agent for Nagios server: ${ALLOWED_HOSTS}"

# Start NRPE
exec /usr/bin/nrpe -f -c /etc/nagios/nrpe.cfg


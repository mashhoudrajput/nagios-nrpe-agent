#!/bin/sh
set -e

# Replace placeholders in config with environment variables
sed -i "s/__ALLOWED_HOSTS__/${ALLOWED_HOSTS:-52.208.159.63}/g" /etc/nagios/nrpe.cfg
mv /etc/nagios/nrpe.cfg /etc/nagios/nrpe.cfg

echo "Starting NRPE agent for Nagios server: ${ALLOWED_HOSTS}"
exec /usr/bin/nrpe -f -c /etc/nagios/nrpe.cfg
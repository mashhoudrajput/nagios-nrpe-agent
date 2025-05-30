#!/bin/sh
set -e

# Required env vars
if [ -z "$NAGIOS_SERVER_IP" ]; then
  echo >&2 "ERROR: NAGIOS_SERVER_IP env var is required"
  exit 1
fi

# Get HOST_IP dynamically if not set
HOST_IP=${HOST_IP:-$(curl -s ifconfig.io)}

# Compose allowed hosts list
ALLOWED_HOSTS="127.0.0.1,::1,$NAGIOS_SERVER_IP"

# Replace allowed_hosts placeholder
sed -i "s/^allowed_hosts=.*/allowed_hosts=$ALLOWED_HOSTS/" /etc/nagios/nrpe.cfg

# Replace all {HOST_IP} and {NAGIOS_SERVER_IP} placeholders in config file
sed -i "s/{HOST_IP}/$HOST_IP/g" /etc/nagios/nrpe.cfg
sed -i "s/{NAGIOS_SERVER_IP}/$NAGIOS_SERVER_IP/g" /etc/nagios/nrpe.cfg

echo "Allowed hosts set to: $ALLOWED_HOSTS"
echo "HOST_IP set to: $HOST_IP"

# Start NRPE in foreground
exec /usr/bin/nrpe -f -c /etc/nagios/nrpe.cfg

#!/bin/sh
set -e

# Fail if curl is missing
command -v curl >/dev/null 2>&1 || { echo >&2 "curl is required but not installed. Aborting."; exit 1; }

# Required env var
if [ -z "$NAGIOS_SERVER_IP" ]; then
  echo >&2 "ERROR: NAGIOS_SERVER_IP env var is required"
  exit 1
fi

# Get HOST_IP dynamically if not set
HOST_IP=${HOST_IP:-$(curl -s ifconfig.io)}

# Compose allowed hosts list for NRPE config
ALLOWED_HOSTS="127.0.0.1,::1,$NAGIOS_SERVER_IP"

# Copy the template to active config before replacing placeholders
cp /etc/nagios/nrpe.cfg.template /etc/nagios/nrpe.cfg

# Replace placeholders in config file
sed -i "s/^allowed_hosts=.*/allowed_hosts=$ALLOWED_HOSTS/" /etc/nagios/nrpe.cfg
sed -i "s/{HOST_IP}/$HOST_IP/g" /etc/nagios/nrpe.cfg
sed -i "s/{NAGIOS_SERVER_IP}/$NAGIOS_SERVER_IP/g" /etc/nagios/nrpe.cfg

echo "Allowed hosts set to: $ALLOWED_HOSTS"
echo "HOST_IP set to: $HOST_IP"

# Run NRPE as nagios user in foreground
exec su-exec nagios /usr/sbin/nrpe -f -c /etc/nagios/nrpe.cfg

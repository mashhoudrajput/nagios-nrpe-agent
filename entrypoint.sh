#!/bin/bash

set -e
set -x

# Replace hostname and password in template
if [ -z "$NRPE_PASSWORD" ]; then
    echo "NRPE_PASSWORD must be set"
    exit 1
fi

sed \
  -e "s|%%HOSTNAME%%|$HOSTNAME|" \
  -e "s|%%NRPE_PASSWORD%%|$NRPE_PASSWORD|" \
  /etc/nagios/nrpe.cfg.template > /etc/nagios/nrpe.cfg

# Generate TLS certificates if they don't exist
if [ ! -f /etc/nagios/nrpe.key ]; then
    echo "Generating new TLS certificates..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nagios/nrpe.key \
        -out /etc/nagios/nrpe.crt \
        -subj "/CN=${HOSTNAME}"
    chmod 600 /etc/nagios/nrpe.key
    chmod 644 /etc/nagios/nrpe.crt
fi

# Fix permissions
chown -R nagios:nagios /etc/nagios /var/run/nrpe /usr/lib/nagios/plugins

# Test configuration
echo "Testing NRPE configuration..."
/usr/bin/nrpe -c /etc/nagios/nrpe.cfg -d
if [ $? -ne 0 ]; then
    echo "ERROR: NRPE configuration test failed"
    exit 1
fi

# Start NRPE in foreground
echo "Starting NRPE agent..."
exec /usr/bin/nrpe -c /etc/nagios/nrpe.cfg -f
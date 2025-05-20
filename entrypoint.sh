#!/bin/bash

set -e  # Exit immediately if any command fails
set -x  # Show what's happening (debug mode)

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

# Verify SSL files
echo "SSL Files:"
ls -la /etc/nagios/nrpe.*

# Test configuration
echo "Testing NRPE configuration..."
/usr/bin/nrpe -c /etc/nagios/nrpe.cfg -d
if [ $? -ne 0 ]; then
    echo "ERROR: NRPE configuration test failed"
    exit 1
fi

# Start NRPE in foreground (without disabling SSL)
echo "Starting NRPE agent..."
exec /usr/bin/nrpe -c /etc/nagios/nrpe.cfg -f
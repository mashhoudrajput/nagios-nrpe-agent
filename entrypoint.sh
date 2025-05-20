#!/bin/sh

set -e

echo "Starting NRPE agent..."
exec /usr/bin/nrpe -f -c /etc/nagios/nrpe.cfg
#!/bin/bash
# Production Run Command for Nagios Client
# Usage: ./RUN_CLIENT.sh <NAGIOS_SERVER_IP> [HOSTNAME]

set -e

if [ -z "$1" ]; then
    echo "Error: Nagios server IP is required"
    echo "Usage: $0 <NAGIOS_SERVER_IP> [HOSTNAME]"
    exit 1
fi

NAGIOS_SERVER_IP=$1
HOSTNAME=${2:-$(hostname)}

echo "========================================="
echo "Nagios Client - Production Run"
echo "========================================="
echo ""
echo "Configuration:"
echo "  Nagios Server: $NAGIOS_SERVER_IP"
echo "  Client Hostname: $HOSTNAME"
echo ""

# Build image
echo "Building Nagios client image..."
cd nagios-nrpe-agent
docker build -t nagios-nrpe-agent:latest .
cd ..

# Run container
echo "Starting Nagios client..."
docker run -d \
    --name nagios-client \
    --restart unless-stopped \
    --hostname "$HOSTNAME" \
    -p 5666:5666 \
    -v /proc:/host/proc:ro \
    -v /sys:/host/sys:ro \
    -v /:/host:ro \
    -e NAGIOS_SERVER_IP="$NAGIOS_SERVER_IP" \
    -e ALLOWED_HOSTS="$NAGIOS_SERVER_IP" \
    -e HOSTNAME="$HOSTNAME" \
    nagios-nrpe-agent:latest

echo ""
echo "✅ Nagios client is running!"
echo ""
echo "The client will auto-register with Nagios server."
echo ""
echo "View logs: docker logs -f nagios-client"
echo "Stop: docker stop nagios-client"
echo ""


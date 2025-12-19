#!/bin/bash
# Production Run Command for Nagios Server
# Usage: ./RUN_SERVER.sh [RDS_ENDPOINT] [DB_USER] [DB_PASS]

set -e

# RDS Configuration (or local MySQL)
DB_HOST=${1:-mysql}
DB_USER=${2:-nagios_user}
DB_PASS=${3:-nagios_pass}
DB_NAME=${4:-nagios_db}
DB_PORT=${5:-3306}

echo "========================================="
echo "Nagios Server - Production Run"
echo "========================================="
echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Build image
echo "Building Nagios server image..."
cd nagios-server
docker build -t nagios-server:latest .
cd ..

# Run container
echo "Starting Nagios server..."
docker run -d \
    --name nagios-server \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    -p 8080:8080 \
    -p 5666:5666 \
    -v nagios-config:/usr/local/nagios/etc \
    -v nagios-var:/usr/local/nagios/var \
    -v nagios-logs:/var/log/supervisor \
    -e NAGIOS_TIMEZONE=UTC \
    -e NAGIOSADMIN_USER=nagiosadmin \
    -e NAGIOSADMIN_PASS=nagiosadmin \
    -e DB_HOST=$DB_HOST \
    -e DB_PORT=$DB_PORT \
    -e DB_NAME=$DB_NAME \
    -e DB_USER=$DB_USER \
    -e DB_PASS=$DB_PASS \
    nagios-server:latest

echo ""
echo "✅ Nagios server is running!"
echo ""
echo "Access:"
echo "  Web GUI: http://localhost/"
echo "  API: http://localhost:8080/api/health"
echo ""
echo "View logs: docker logs -f nagios-server"
echo "Stop: docker stop nagios-server"
echo ""


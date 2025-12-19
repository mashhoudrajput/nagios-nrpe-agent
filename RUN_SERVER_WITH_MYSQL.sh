#!/bin/bash
# Run Nagios Server with MySQL on the same server
# Usage: ./RUN_SERVER_WITH_MYSQL.sh [DB_ROOT_PASS] [DB_USER] [DB_PASS] [DB_NAME]

set -e

# MySQL Configuration
DB_ROOT_PASS=${1:-nagios_root_pass}
DB_USER=${2:-nagios_user}
DB_PASS=${3:-nagios_pass}
DB_NAME=${4:-nagios_db}
DB_PORT=3306

echo "========================================="
echo "Nagios Server + MySQL - Same Server"
echo "========================================="
echo ""
echo "MySQL Configuration:"
echo "  Root Password: $DB_ROOT_PASS"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Port: $DB_PORT"
echo ""

# Create network if it doesn't exist
echo "Creating Docker network..."
docker network create nagios-network 2>/dev/null || echo "Network already exists"

# Build Nagios server image
echo "Building Nagios server image..."
cd nagios-server
docker build -t nagios-server:latest .
cd ..

# Start MySQL container
echo "Starting MySQL container..."
if docker ps -a | grep -q nagios-mysql; then
    if docker ps | grep -q nagios-mysql; then
        echo "MySQL container is already running."
    else
        echo "MySQL container exists but is stopped. Starting it..."
        docker start nagios-mysql
    fi
else
    echo "Creating new MySQL container..."
    docker run -d \
        --name nagios-mysql \
        --restart unless-stopped \
        -p 3306:3306 \
        -v nagios-mysql-data:/var/lib/mysql \
        -v $(pwd)/nagios-server/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
        -e MYSQL_ROOT_PASSWORD=$DB_ROOT_PASS \
        -e MYSQL_DATABASE=$DB_NAME \
        -e MYSQL_USER=$DB_USER \
        -e MYSQL_PASSWORD=$DB_PASS \
        --network nagios-network \
        mysql:8.0
    
    # Wait for MySQL to be ready
    echo "Waiting for MySQL to be ready..."
    for i in {1..30}; do
        if docker exec nagios-mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
            echo "MySQL is ready!"
            break
        fi
        echo "Waiting for MySQL... ($i/30)"
        sleep 2
    done
fi

# Start Nagios server container
echo "Starting Nagios server..."
if docker ps -a | grep -q nagios-server; then
    echo "Nagios server container already exists. Removing old container..."
    docker rm -f nagios-server
fi

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
    -e DB_HOST=nagios-mysql \
    -e DB_PORT=$DB_PORT \
    -e DB_NAME=$DB_NAME \
    -e DB_USER=$DB_USER \
    -e DB_PASS=$DB_PASS \
    --network nagios-network \
    nagios-server:latest

echo ""
echo "✅ Nagios server and MySQL are running on the same server!"
echo ""
echo "Access:"
echo "  Web GUI: http://localhost/"
echo "  API: http://localhost:8080/api/health"
echo "  MySQL: localhost:3306"
echo ""
echo "View logs:"
echo "  docker logs -f nagios-server"
echo "  docker logs -f nagios-mysql"
echo ""
echo "Stop services:"
echo "  docker stop nagios-server nagios-mysql"
echo ""


#!/bin/sh
set -e

echo "========================================="
echo "Nagios NRPE Agent Starting..."
echo "========================================="

# Set allowed hosts 
ALLOWED_HOSTS="${ALLOWED_HOSTS:-0.0.0.0/0}"
NAGIOS_SERVER_IP="${NAGIOS_SERVER_IP:-}"
HOSTNAME="${HOSTNAME:-$(hostname)}"

# Generate configuration from template
cp /etc/nagios/nrpe.cfg.template /etc/nagios/nrpe.cfg
sed -i "s/__ALLOWED_HOSTS__/${ALLOWED_HOSTS}/g" /etc/nagios/nrpe.cfg

echo "Configuration:"
echo "  - Hostname: ${HOSTNAME}"
echo "  - Allowed Hosts: ${ALLOWED_HOSTS}"
echo "  - Nagios Server: ${NAGIOS_SERVER_IP}"

# Auto-register with Nagios server if configured
if [ -n "${NAGIOS_SERVER_IP}" ]; then
    echo "Attempting to register with Nagios server at ${NAGIOS_SERVER_IP}..."
    
    # Get container IP (try multiple methods)
    CONTAINER_IP=$(hostname -i 2>/dev/null | awk '{print $1}' || \
                   ip route get 1 2>/dev/null | awk '{print $7; exit}' || \
                   hostname -I 2>/dev/null | awk '{print $1}' || \
                   echo "127.0.0.1")
    
    # Try to register via API (retry up to 5 times)
    for i in $(seq 1 5); do
        echo "Registration attempt $i/5..."
        
        if curl -X POST "http://${NAGIOS_SERVER_IP}:8080/api/hosts" \
            -H "Content-Type: application/json" \
            -d "{\"hostname\":\"${HOSTNAME}\",\"ip_address\":\"${CONTAINER_IP}\",\"alias\":\"Auto-registered host\"}" \
            --connect-timeout 5 \
            --max-time 10 \
            --silent \
            --show-error > /dev/null 2>&1; then
            echo "Successfully registered with Nagios server!"
            break
        else
            if [ $i -lt 5 ]; then
                echo "Registration failed, retrying in 5 seconds..."
                sleep 5
            else
                echo "Registration failed after 5 attempts. Continuing anyway..."
            fi
        fi
    done
else
    echo "No Nagios server IP specified. Skipping auto-registration."
fi

echo "========================================="
echo "Starting NRPE daemon..."
echo "========================================="

# Start NRPE in foreground
exec /usr/bin/nrpe -f -c /etc/nagios/nrpe.cfg

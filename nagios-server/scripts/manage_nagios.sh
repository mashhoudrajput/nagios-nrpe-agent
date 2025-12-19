#!/bin/bash

# Nagios Configuration Update Script
# This script updates Nagios configuration files

NAGIOS_HOME="/usr/local/nagios"
CONFIG_DIR="${NAGIOS_HOME}/etc"

# Function to reload Nagios configuration
reload_nagios() {
    echo "Verifying Nagios configuration..."
    ${NAGIOS_HOME}/bin/nagios -v ${CONFIG_DIR}/nagios.cfg
    if [ $? -eq 0 ]; then
        echo "Configuration OK. Reloading Nagios..."
        kill -HUP $(cat ${NAGIOS_HOME}/var/nagios.lock) 2>/dev/null || \
        supervisorctl restart nagios
        return 0
    else
        echo "Configuration error. Not reloading."
        return 1
    fi
}

# Function to add new host
add_host() {
    local hostname=$1
    local ip_address=$2
    local host_file="${CONFIG_DIR}/objects/hosts/${hostname}.cfg"
    
    cat > "${host_file}" <<EOF
define host {
    use                     linux-server
    host_name               ${hostname}
    alias                   ${hostname}
    address                 ${ip_address}
    max_check_attempts      5
    check_period            24x7
    notification_interval   30
    notification_period     24x7
}
EOF
    
    chown nagios:nagios "${host_file}"
    echo "Host ${hostname} added successfully."
}

# Function to remove host
remove_host() {
    local hostname=$1
    local host_file="${CONFIG_DIR}/objects/hosts/${hostname}.cfg"
    
    if [ -f "${host_file}" ]; then
        rm -f "${host_file}"
        echo "Host ${hostname} removed successfully."
    else
        echo "Host ${hostname} not found."
        return 1
    fi
}

# Function to add service to host
add_service() {
    local hostname=$1
    local service_name=$2
    local check_command=$3
    local service_file="${CONFIG_DIR}/objects/services/${hostname}_${service_name}.cfg"
    
    cat > "${service_file}" <<EOF
define service {
    use                     generic-service
    host_name               ${hostname}
    service_description     ${service_name}
    check_command           ${check_command}
    max_check_attempts      4
    check_interval          5
    retry_interval          1
    check_period            24x7
    notification_interval   30
    notification_period     24x7
}
EOF
    
    chown nagios:nagios "${service_file}"
    echo "Service ${service_name} added to ${hostname} successfully."
}

# Main script logic
case "$1" in
    add-host)
        add_host "$2" "$3"
        reload_nagios
        ;;
    remove-host)
        remove_host "$2"
        reload_nagios
        ;;
    add-service)
        add_service "$2" "$3" "$4"
        reload_nagios
        ;;
    reload)
        reload_nagios
        ;;
    *)
        echo "Usage: $0 {add-host|remove-host|add-service|reload} [parameters]"
        echo "  add-host <hostname> <ip_address>"
        echo "  remove-host <hostname>"
        echo "  add-service <hostname> <service_name> <check_command>"
        echo "  reload"
        exit 1
        ;;
esac

exit $?

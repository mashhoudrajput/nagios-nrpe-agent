FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    NAGIOS_HOME=/usr/local/nagios \
    NAGIOS_USER=nagios \
    NAGIOS_GROUP=nagios \
    NAGIOS_CMDUSER=nagios \
    NAGIOS_CMDGROUP=nagcmd \
    NAGIOS_TIMEZONE=UTC \
    NAGIOSADMIN_USER=nagiosadmin \
    NAGIOSADMIN_PASS=nagiosadmin \
    NODE_VERSION=18

# Install prerequisites including Node.js for API backend
RUN apt-get update && \
    apt-get install -y \
    wget curl gnupg2 \
    apache2 php libapache2-mod-php \
    php-gd php-cli php-curl php-mbstring php-xml php-json \
    build-essential autoconf gcc libc6 make unzip \
    apache2-utils libgd-dev libssl-dev \
    openssl perl libnet-snmp-perl gettext \
    supervisor nginx python3 python3-pip \
    net-tools dnsutils iputils-ping \
    vim nano && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js for API backend
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@10 pm2

# Create nagios user and group
RUN useradd -m -s /bin/bash ${NAGIOS_USER} && \
    groupadd ${NAGIOS_CMDGROUP} && \
    usermod -a -G ${NAGIOS_CMDGROUP} ${NAGIOS_USER} && \
    usermod -a -G ${NAGIOS_CMDGROUP} www-data

# Download and install Nagios Core
WORKDIR /tmp
RUN wget -O nagios-core.tar.gz https://github.com/NagiosEnterprises/nagioscore/releases/download/nagios-4.4.14/nagios-4.4.14.tar.gz && \
    tar xzf nagios-core.tar.gz && \
    cd nagios-4.4.14 && \
    ./configure \
    --prefix=${NAGIOS_HOME} \
    --with-httpd-conf=/etc/apache2/sites-enabled \
    --with-nagios-user=${NAGIOS_USER} \
    --with-nagios-group=${NAGIOS_GROUP} \
    --with-command-user=${NAGIOS_CMDUSER} \
    --with-command-group=${NAGIOS_CMDGROUP} && \
    make all && \
    make install && \
    make install-init && \
    make install-config && \
    make install-commandmode && \
    make install-webconf && \
    make install-exfoliation && \
    cp -R contrib/eventhandlers/ ${NAGIOS_HOME}/libexec/ && \
    chown -R ${NAGIOS_USER}:${NAGIOS_GROUP} ${NAGIOS_HOME}/libexec/eventhandlers && \
    cd /tmp && rm -rf nagios-4.4.14*

# Install Nagios Plugins
RUN wget -O nagios-plugins.tar.gz https://github.com/nagios-plugins/nagios-plugins/releases/download/release-2.4.6/nagios-plugins-2.4.6.tar.gz && \
    tar xzf nagios-plugins.tar.gz && \
    cd nagios-plugins-2.4.6 && \
    ./configure \
    --prefix=${NAGIOS_HOME} \
    --with-nagios-user=${NAGIOS_USER} \
    --with-nagios-group=${NAGIOS_GROUP} \
    --with-openssl \
    --enable-perl-modules && \
    make && \
    make install && \
    cd /tmp && rm -rf nagios-plugins*

# Install NRPE (to check remote hosts)
RUN wget -O nrpe.tar.gz https://github.com/NagiosEnterprises/nrpe/releases/download/nrpe-4.1.0/nrpe-4.1.0.tar.gz && \
    tar xzf nrpe.tar.gz && \
    cd nrpe-4.1.0 && \
    ./configure \
    --prefix=${NAGIOS_HOME} \
    --with-ssl=/usr/bin/openssl \
    --with-ssl-lib=/usr/lib/x86_64-linux-gnu && \
    make all && \
    make install-plugin && \
    make install-daemon && \
    make install-config && \
    cd /tmp && rm -rf nrpe*

# Create necessary directories
RUN mkdir -p ${NAGIOS_HOME}/etc/objects/hosts \
    ${NAGIOS_HOME}/etc/objects/services \
    ${NAGIOS_HOME}/var/rw \
    ${NAGIOS_HOME}/var/spool/checkresults \
    /var/log/supervisor \
    /opt/nagios-api

# Configure Apache
RUN a2enmod rewrite cgi ssl proxy proxy_http headers && \
    htpasswd -b -c ${NAGIOS_HOME}/etc/htpasswd.users ${NAGIOSADMIN_USER} ${NAGIOSADMIN_PASS}

# Set permissions
RUN chown -R ${NAGIOS_USER}:${NAGIOS_GROUP} ${NAGIOS_HOME} && \
    chmod -R 775 ${NAGIOS_HOME}/var && \
    chmod -R 755 ${NAGIOS_HOME}/etc

# Copy application files
COPY config/ ${NAGIOS_HOME}/etc/
COPY api/ /opt/nagios-api/
COPY webapp/ /var/www/nagios-gui/
COPY scripts/ /opt/scripts/
COPY db/ /opt/nagios-api/db/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install API dependencies
WORKDIR /opt/nagios-api
RUN npm install --production

# Set permissions for scripts
RUN chmod +x /opt/scripts/*.sh && \
    chown -R ${NAGIOS_USER}:${NAGIOS_GROUP} ${NAGIOS_HOME}/etc && \
    /opt/scripts/setup_apache.sh

# Expose ports
EXPOSE 80 443 8080 5666

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

WORKDIR ${NAGIOS_HOME}

# Set entrypoint
ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

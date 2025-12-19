# Use Alpine Linux for minimal footprint
FROM alpine:3.18

# Environment variables
ENV NAGIOS_SERVER_IP="" \
    ALLOWED_HOSTS="0.0.0.0/0" \
    HOSTNAME=""

# Install NRPE and required plugins
RUN apk add --no-cache \
    nrpe \
    nagios-plugins \
    nagios-plugins-disk \
    nagios-plugins-http \
    nagios-plugins-load \
    nagios-plugins-ping \
    nagios-plugins-procs \
    nagios-plugins-swap \
    nagios-plugins-users \
    bash \
    curl \
    tini && \
    mkdir -p /var/run/nrpe /etc/nagios && \
    chown -R nagios:nagios /var/run/nrpe /etc/nagios

# Copy configuration template
COPY nrpe.cfg /etc/nagios/nrpe.cfg.template
COPY entrypoint.sh /entrypoint.sh
COPY check_mem /usr/lib/nagios/plugins/check_mem

# Set permissions
RUN chmod +x /entrypoint.sh /usr/lib/nagios/plugins/check_mem && \
    chown nagios:nagios /etc/nagios/nrpe.cfg.template

EXPOSE 5666

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /usr/lib/nagios/plugins/check_nrpe -H 127.0.0.1 || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
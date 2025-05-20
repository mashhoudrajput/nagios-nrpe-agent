FROM alpine:3.15

# Install core packages and plugins
RUN apk add --no-cache \
    nrpe=4.0.3-r2 \
    nagios-plugins=2.3.3-r1 \
    nagios-plugins-disk \
    nagios-plugins-http \
    nagios-plugins-load \
    nagios-plugins-ping \
    nagios-plugins-procs \
    nagios-plugins-swap \
    nagios-plugins-users \
    openssl=1.1.1w-r1 \
    bash=5.1.16-r0 \
    tini=0.19.0-r0

# Create directories
RUN mkdir -p /etc/nagios /var/run/nrpe /usr/lib/nagios/plugins/custom && \
    chown -R nagios:nagios /etc/nagios /var/run/nrpe /usr/lib/nagios/plugins

# Copy files
COPY nrpe.cfg.template /etc/nagios/nrpe.cfg.template
COPY entrypoint.sh /entrypoint.sh
COPY healthcheck.sh /healthcheck.sh
COPY check_mem /usr/lib/nagios/plugins/check_mem

# Set permissions
RUN chmod +x /entrypoint.sh /healthcheck.sh /usr/lib/nagios/plugins/check_mem && \
    chmod 644 /etc/nagios/nrpe.cfg.template

EXPOSE 5666

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/healthcheck.sh"]

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
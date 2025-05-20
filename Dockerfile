FROM alpine:3.15

# Install NRPE + required Nagios plugins
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

# Create required directories
RUN mkdir -p \
    /usr/lib/nagios/plugins/custom \
    /var/run/nrpe \
    /etc/nagios && \
    chown -R nagios:nagios /usr/lib/nagios/plugins /var/run/nrpe /etc/nagios

# Copy config and scripts
COPY nrpe.cfg /etc/nagios/nrpe.cfg
COPY entrypoint.sh /entrypoint.sh
COPY healthcheck.sh /healthcheck.sh
COPY check_mem /usr/lib/nagios/plugins/check_mem

# Set permissions
RUN chmod +x /entrypoint.sh /healthcheck.sh /usr/lib/nagios/plugins/check_mem && \
    chmod 644 /etc/nagios/nrpe.cfg && \
    chown nagios:nagios /etc/nagios/nrpe.cfg

EXPOSE 5666

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/healthcheck.sh"]

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
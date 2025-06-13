# Use minimal Alpine Linux image
FROM alpine:3.15

# Install NRPE and required plugins
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
    bash=5.1.16-r0 \
    tini=0.19.0-r0

# Create required directories
RUN mkdir -p /var/run/nrpe /etc/nagios && \
    chown -R nagios:nagios /var/run/nrpe /etc/nagios

# Copy config and entrypoint script
COPY nrpe.cfg /etc/nagios/nrpe.cfg
COPY entrypoint.sh /entrypoint.sh

# Optional: Add check_mem if needed
COPY check_mem /usr/lib/nagios/plugins/check_mem

# Set permissions
RUN chmod +x /entrypoint.sh /usr/lib/nagios/plugins/check_mem && \
    chown nagios:nagios /etc/nagios/nrpe.cfg

EXPOSE 5666

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
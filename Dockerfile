FROM alpine:3.15

RUN apk add --no-cache \
    curl \
    nrpe=4.0.3-r2 \
    nagios-plugins=2.3.3-r1 \
    nagios-plugins-disk \
    nagios-plugins-http \
    nagios-plugins-load \
    nagios-plugins-ping \
    nagios-plugins-procs \
    nagios-plugins-swap \
    nagios-plugins-users \
    nagios-plugins \
    openssh \
    bash=5.1.16-r0 \
    tini=0.19.0-r0 \
    su-exec

# Create required directories and set ownership
RUN mkdir -p /var/run/nrpe /etc/nagios && \
    chown -R nagios:nagios /var/run/nrpe /etc/nagios

COPY nrpe.cfg.template /etc/nagios/nrpe.cfg.template
COPY check_mem /usr/lib/nagios/plugins/check_mem
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh /usr/lib/nagios/plugins/check_mem && \
    chown nagios:nagios /etc/nagios/nrpe.cfg.template

EXPOSE 5666

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]

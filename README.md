# nagios-nrpe-agent


docker build -t my-nrpe-agent .



docker run -d \
  --name nrpe-agent \
  --restart unless-stopped \
  -p 5666:5666 \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/host:ro \
  my-nrpe-agent
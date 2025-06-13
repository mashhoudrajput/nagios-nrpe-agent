Nagios NRPE Agent Docker Image
=============================

A lightweight Docker container running NRPE (Nagios Remote Plugin Executor) agent for monitoring hosts with Nagios.

Table of Contents
-----------------
1. Features
2. Quick Start
   - Build the Image
   - Run the Container
3. Configuration
   - Environment Variables
   - Ports
   - Volumes
   - Pre-configured Checks
4. Custom Checks
5. Security Notes
6. Troubleshooting
7. License

1. Features
-----------
- Based on Alpine Linux for minimal footprint
- Includes essential Nagios plugins
- Configurable allowed hosts via environment variable
- Pre-configured with common monitoring checks
- Includes custom memory check script

2. Quick Start
--------------

Build the Image:
docker build -t my-nrpe-agent .

Run the Container:
docker run -d \
  --name nrpe-agent \
  --restart unless-stopped \
  -p 5666:5666 \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/host:ro \
  -e ALLOWED_HOSTS=your.nagios.server.ip \
  my-nrpe-agent

3. Configuration
---------------

Environment Variables:
- ALLOWED_HOSTS: IP address of your Nagios server (default: 52.208.159.63)

Ports:
- 5666: NRPE communication port

Volumes:
The container mounts these host directories read-only:
- /proc: For process monitoring
- /sys: For system information
- /: For disk checks

Pre-configured Checks:
The container comes with these default checks:
- System load
- Memory usage
- Disk space
- Running processes
- User count
- Network services (HTTP, HTTPS, SSH)
- Ping response

4. Custom Checks
----------------
To add custom checks:
1. Create your check script in the nagios-plugins format
2. Add it to your Docker build directory
3. Update the Dockerfile to copy the script:
   COPY your_check_script /usr/lib/nagios/plugins/
   RUN chmod +x /usr/lib/nagios/plugins/your_check_script
4. Add the command definition to nrpe.cfg:
   command[check_your_thing]=/usr/lib/nagios/plugins/your_check_script -options

5. Security Notes
----------------
- SSL is disabled by default in the configuration
- The container runs as non-root (nagios user)
- Only specified hosts can communicate with the agent
- Host directories are mounted read-only

6. Troubleshooting
-----------------
To view logs:
docker logs nrpe-agent

To test NRPE connectivity from your Nagios server:
/usr/lib/nagios/plugins/check_nrpe -H <agent-ip> -c check_load

7. License
---------
This project is open-source. Feel free to use and modify as needed.

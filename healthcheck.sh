#!/bin/sh
# healthcheck.sh

# Check if NRPE process is running
if pgrep -x "nrpe" > /dev/null; then
    exit 0
else
    exit 1
fi
#!/bin/sh
if pgrep -x "nrpe" > /dev/null; then
    exit 0
else
    exit 1
fi
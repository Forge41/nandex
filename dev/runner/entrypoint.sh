#!/bin/sh
# Splits the two streams Docker carries, before the harness starts.
#
# fd 3 becomes a duplicate of the container's stdout, and stdout is then pointed at
# stderr. So everything the compiler and the tests print lands on stderr -- the terminal
# the candidate watches -- while the harness writes its JSON events to fd 3, which is
# still the container's stdout. Two channels, no interleaving, no sentinel parsing.
exec 3>&1 1>&2
exec python3 /opt/harness.py "$@" 3>&3

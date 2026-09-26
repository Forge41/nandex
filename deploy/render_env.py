"""Turns the Secrets Manager JSON blob into a .env file.

A separate file rather than a heredoc inside user_data.sh: quoting a Python program
inside a bash script inside a Terraform string is three levels of escaping, and it is
the level where a silent corruption of a secret would be hardest to see.
"""

import json
import sys

source, destination = sys.argv[1], sys.argv[2]

with open(source) as f:
    env = json.load(f)

with open(destination, "w") as f:
    for key, value in sorted(env.items()):
        # Values with newlines would break .env parsing entirely; none are expected,
        # and failing loudly beats writing a file that half-parses.
        if "\n" in str(value):
            raise SystemExit(f"{key} contains a newline and cannot go in a .env file")
        f.write(f"{key}={value}\n")

print(f"wrote {len(env)} keys to {destination}")

---
doc: summary.md
title: nantex (Forge41)
---

nantex is an open-source Python CLI by Forge41, published on PyPI, for LaTeX live preview in the browser with no local LaTeX install. Run `uvx nantex main.tex`: it watches the root .tex file and every \input / \include it discovers, runs a fast local lint (unclosed environments, missing files, stray braces), compiles remotely through a latex-on-http API (public by default, self-hostable with --api; pdflatex, xelatex or lualatex), writes the PDF atomically and serves it on localhost:7474, pushing a browser reload over Server-Sent Events when a build finishes. Other features: --snippet compiles a single label or line range, --share prints a LAN URL, and settings persist in .nantex.toml. `nantex --mcp` runs a Model Context Protocol server with compile_latex and get_compile_status tools, so agents such as Claude Code or Cursor can compile LaTeX and read structured errors. Every merge to main is auto-versioned and published to PyPI. Site: nantex.nandish.online.

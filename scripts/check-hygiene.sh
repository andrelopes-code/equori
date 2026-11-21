#!/bin/sh
# Rejects files that do not belong in the repository: editor and merge leftovers, logs, build
# output, design mocks under docs/specs and any file above 2 MB.
# Usage: scripts/check-hygiene.sh [path...]; without paths it checks every tracked file.
set -eu

max_bytes=2097152

if [ "$#" -eq 0 ]; then
	set -- $(git ls-files)
fi

status=0

for path in "$@"; do
	case "$path" in
	*.orig | *.rej | *.bak | *.swp | *.swo | *~ | *.log | *.tmp | *.prof | *.pprof | *.test | \
		*.tsbuildinfo | *.DS_Store | */Thumbs.db | Thumbs.db | coverage.out | */coverage.out | \
		web/coverage/*)
		echo "hygiene: $path: leftover file" >&2
		status=1
		;;
	docs/specs/*/*)
		echo "hygiene: $path: docs/specs holds Markdown specs only;" \
			"approved mocks live in docs/superpowers/mocks/ (local)" >&2
		status=1
		;;
	docs/specs/*.md) ;;
	docs/specs/*)
		echo "hygiene: $path: docs/specs holds Markdown specs only" >&2
		status=1
		;;
	esac

	if [ -f "$path" ] && [ "$(wc -c <"$path")" -gt "$max_bytes" ]; then
		echo "hygiene: $path: larger than 2 MB" >&2
		status=1
	fi
done

exit "$status"

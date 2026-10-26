#!/usr/bin/env bash
# Renders the Homebrew formula of a release from its SHA256SUMS (ADR 022, R5).
set -euo pipefail
if [[ $# -ne 2 ]]; then
	echo "usage: $0 VERSION SHA256SUMS" >&2
	exit 2
fi
version=$1 sums=$2
root=$(cd "$(dirname "$0")/.." && pwd)
args=(-e "s/@VERSION@/$version/g")
for target in darwin_arm64 darwin_amd64 linux_arm64 linux_amd64; do
	sum=$(awk -v f="equori_${version}_${target}.tar.gz" '$2 == f { print $1 }' "$sums")
	if [[ ! $sum =~ ^[0-9a-f]{64}$ ]]; then
		echo "$sums has no checksum for equori_${version}_${target}.tar.gz" >&2
		exit 1
	fi
	args+=(-e "s/@SHA_${target^^}@/$sum/")
done
sed "${args[@]}" "$root/packaging/homebrew/equori.rb.tmpl"

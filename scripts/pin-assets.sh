#!/usr/bin/env bash
# Writes the release assets pinned to VERSION into OUTDIR (ADR 022, V7; P14 A166.1).
set -euo pipefail
version=${1:?usage: $0 VERSION OUTDIR}
out=${2:?usage: $0 VERSION OUTDIR}
mkdir -p "$out"
sed -e "s/\${EQUORI_VERSION:-dev}/\${EQUORI_VERSION:-$version}/" -e '/^    build:$/,/^      target: standalone$/d' compose.yaml >"$out/compose.yaml"
grep -q "equori:\${EQUORI_VERSION:-$version}-standalone" "$out/compose.yaml"
sed "s/^version=dev\$/version=$version/" scripts/install.sh >"$out/install.sh"
grep -qx "version=$version" "$out/install.sh"
cp env.example "$out/env.example"

#!/usr/bin/env bash
set -e
echo "Copying artifacts to client/public/zk"
mkdir -p ../../client/public/zk
cp -r build/* ../../client/public/zk/
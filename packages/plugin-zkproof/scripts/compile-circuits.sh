#!/usr/bin/env bash
set -e


echo "Ensure nargo (noir) is installed"
nargo --version || curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
export PATH=$PATH:$HOME/.nargo/bin


mkdir -p build
for f in src/circuits/*.nr; do
echo "Compiling $f"
nargo compile --backend garaga --circuit "$f"
mv target/* build/
done


# compiled artifacts will be in target/ — copy manually or use publish script
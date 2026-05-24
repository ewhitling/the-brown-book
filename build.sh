#!/usr/bin/env bash
# CF Pages build script
# Ensures Python/uv are available, then runs make build
# See: https://developers.cloudflare.com/pages/configuration/build-configuration/

set -euo pipefail

echo "=== CF Pages Build ==="
echo "Node version: $(node --version)"
npm --version

# Install Python/uv if not already present
# CF Pages doesn't include Python by default
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v uv &> /dev/null; then
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
fi

echo "uv version: $(uv --version)"

# Run the full build (apply-corrections + web + size-budgets)
make build

echo "=== Build complete ==="
ls -lh web/dist/

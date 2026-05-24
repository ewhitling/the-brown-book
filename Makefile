.PHONY: help apply-corrections web build test

# Skeleton — filled out as tasks land. See tasks.yaml.

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

apply-corrections: ## Apply corrections/*.yaml to data/botns.db
	@which uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh
	PATH="$(HOME)/.local/bin:$(PATH)" uv run python -m core.apply_corrections

web: ## Build the SPA into web/dist/
	cp data/botns.db web/static/botns.db
	cd web && npm ci && npm run build

build: apply-corrections web ## Apply corrections + build the SPA (CI target)

test: ## Run Python tests
	uv run pytest tests/

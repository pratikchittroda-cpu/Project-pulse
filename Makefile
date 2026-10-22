.PHONY: test lint typecheck format-check build

test:
	corepack pnpm run test

lint:
	corepack pnpm run lint

typecheck:
	corepack pnpm run typecheck

format-check:
	corepack pnpm run format:check

build:
	corepack pnpm run build

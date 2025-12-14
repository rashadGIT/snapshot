# Snapspot Development Makefile
# Quick commands for common operations

.PHONY: help install setup dev build test clean

help: ## Show this help message
	@echo "Snapspot Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: install ## Complete initial setup (install + docker + db)
	@echo "🚀 Starting Docker services..."
	npm run docker:up
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "📊 Setting up database..."
	npm run db:generate
	npm run db:push
	npm run db:seed
	@echo "✅ Setup complete! Run 'make dev' to start the server."

dev: ## Start development server
	npm run dev

build: ## Build production bundle
	npm run build

start: ## Start production server
	npm run start

# Database commands
db-generate: ## Generate Prisma client
	npm run db:generate

db-push: ## Push schema to database
	npm run db:push

db-seed: ## Seed database with mock data
	npm run db:seed

db-reset: ## Reset and reseed database
	npm run db:reset

db-studio: ## Open Prisma Studio
	npx prisma studio

# Docker commands
docker-up: ## Start Docker services
	npm run docker:up

docker-down: ## Stop Docker services
	npm run docker:down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-restart: docker-down docker-up ## Restart Docker services

# Testing commands
test: ## Run unit and component tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-e2e: ## Run E2E tests
	npm run test:e2e

test-all: ## Run all tests
	npm run test:all

# Code quality commands
lint: ## Run ESLint
	npm run lint

format: ## Format code with Prettier
	npm run format

type-check: ## Run TypeScript type checking
	npm run type-check

quality: lint type-check test ## Run all quality checks

# Cleanup commands
clean: ## Clean build artifacts and dependencies
	rm -rf node_modules .next out dist
	rm -rf coverage playwright-report test-results

clean-all: clean docker-down ## Clean everything including Docker volumes
	docker-compose down -v

# Quick start command
start-fresh: clean setup dev ## Clean setup and start dev server

# Generate secret for QR tokens
generate-secret: ## Generate a random secret for QR_TOKEN_SECRET
	@openssl rand -base64 32

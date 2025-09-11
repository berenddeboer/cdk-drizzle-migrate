# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Projen managed AWS CDK construct library that enables
running Drizzle ORM migrations against RDS clusters at deploy time. It
supports PostgreSQL, MariaDB, and MySQL engines and is designed for
enterprise environments with isolated subnets.

## Development Commands

- **Build**: `npx projen build` - Compiles TypeScript and runs all build steps
- **Test**: `npx projen test` - Runs Jest tests and synthesizes integration stacks
- **Lint**: `npx projen eslint` - Runs ESLint on source files
- **Format**: `npx projen format` - Formats code with Prettier

### Lambda Handler Development

When modifying the Lambda handler code in `lambda/handler.ts`:

1. Transpile to JavaScript: `npx projen build:handler`
2. This generates `src/handler/handler.js` which is used by the CDK construct
3. The build automatically runs before compilation via pre-compile hook

### Unit testing

- Run unit tests: `npx jest test/drizzle-migration.test.ts`
- Run a single test: `npx jest test/drizzle-migrate.test.ts --no-coverage -t "creates resources"`

### Integration Testing

The project has three integration test stacks for different database engines:

- **PostgreSQL**: `npx projen integ:deploy:postgres`, `npx projen integ:destroy:postgres`
- **MariaDB**: `npx projen integ:deploy:mariadb`, `npx projen  integ:destroy:mariadb`
- **Aurora Serverless**: `npx projen integ:deploy:serverless`, `npx projen integ:destroy:serverless`

Generate migrations for integration tests:
- `npx projen  integ:generate-migrations:postgres`
- `npx projen integ:generate-migrations:mariadb`
- `npx projen integ:generate-migrations:serverless`

Synthesize all integration stacks: `npx projen integ:synth:all`

## Architecture

### Core Components

- **DrizzleMigrate** (`src/drizzle-migrate-provider.ts`): Main CDK construct that creates a Lambda function to run migrations
- **Lambda Handler** (`lambda/handler.ts`): Runtime code that connects to RDS and executes Drizzle migrations
- **Integration Tests** (`integ/`): Three separate CDK apps testing different database engines

### Key Design Patterns

1. **Handler Bundling**: The Lambda handler is transpiled from TypeScript to JavaScript using esbuild and bundled with the construct to avoid Node.js dependency issues

2. **Security Groups**: If a database cluster/instance is passed to the construct, it automatically configures security group rules to allow Lambda access

3. **Multi-Engine Support**: The handler detects database engine from the secret and uses appropriate Drizzle drivers (postgres-js, mysql2)

4. **Migration Path Bundling**: The specified migrations directory is bundled with the Lambda function and read at runtime

### Dependencies

- Uses Projen for project configuration and task management
- CDK v2
- Drizzle ORM and drizzle-kit for database operations
- esbuild for Lambda handler transpilation
- Jest for testing with integration stack synthesis

## File Structure

- `src/` - CDK construct source code
- `lambda/` - Lambda handler source (TypeScript)
- `src/handler/` - Generated JavaScript handler (do not edit directly)
- `integ/` - Integration test CDK applications
- `test/` - Unit tests

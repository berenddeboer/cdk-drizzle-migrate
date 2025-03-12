# Integration Test for DrizzleMigrate

This directory contains an integration test for the DrizzleMigrate construct.

## Setup

1. Generate migrations:
   ```
   npm run integ:generate-migrations
   ```

2. Deploy the integration test stack:
   ```
   npm run integ:deploy
   ```

3. When you're done testing, destroy the stack:
   ```
   npm run integ:destroy
   ```

## What this test does

1. Creates a VPC
2. Creates a PostgreSQL RDS instance
3. Creates a secret with the database credentials
4. Deploys the DrizzleMigrate construct with the generated migrations
5. Runs the migrations against the database

The stack outputs the database endpoint and secret ARN, which you can use to connect to the database and verify that the migrations were applied successfully.

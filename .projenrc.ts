import { awscdk, javascript } from "projen"
import { ArrowParens, TrailingComma } from "projen/lib/javascript"

const project = new awscdk.AwsCdkConstructLibrary({
  author: "Berend de Boer",
  authorAddress: "berend@pobox.com",
  keywords: ["aws", "aws-cdk", "rds", "aurora", "drizzle", "drizzle-orm", "drizzle-kit"],
  cdkVersion: "2.171.1",
  constructsVersion: "10.3.0",
  defaultReleaseBranch: "main",
  jsiiVersion: "~5.7.0",
  name: "cdk-drizzle-migrate",
  packageManager: javascript.NodePackageManager.NPM,
  gitignore: [
    ".envrc",
    "integ/*/cdk.out/",
    "src/handler/handler.js",
    "src/handler/handler.js.map",
  ],
  prettier: true,
  prettierOptions: {
    yaml: true,
    settings: {
      arrowParens: ArrowParens.ALWAYS,
      printWidth: 90,
      semi: false,
      singleQuote: false,
      trailingComma: TrailingComma.ES5,
      useTabs: false,
    },
  },
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    devdirs: ["test"],
    prettier: true,
  },
  tsconfigDev: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },
  projenrcTs: true,
  repositoryUrl: "https://github.com/berenddeboer/cdk-drizzle-migrate.git",
  description: "AWS CDK construct for running Drizzle ORM migrations",

  deps: ["@types/aws-lambda"],
  devDeps: [
    "aws-cdk",
    "esbuild@^0.25.1",
    "@aws-sdk/client-secrets-manager",
    "drizzle-kit",
    "drizzle-orm",
    "postgres",
    "mysql2",
  ],
  bundledDeps: ["@types/aws-lambda"],
  peerDeps: [],
})

// Needs to be here, else we get eslint 9
project.package.addDevDeps("eslint@^8")

project.addTask("format", {
  description: "Format code with prettier",
  exec: 'prettier --write "src/**/*.ts" "test/**/*.ts"',
})

// Add integration test tasks
project.addTask("integ:deploy:postgres", {
  description: "Deploy the PostgreSQL integration test stack",
  exec: "cd integ/postgres && npx cdk deploy DrizzleMigrateIntegStack --require-approval never",
})

project.addTask("integ:deploy:mariadb", {
  description: "Deploy the MariaDB integration test stack",
  exec: "cd integ/mariadb && npx cdk deploy DrizzleMigrateMariaDBIntegStack --require-approval never",
})

project.addTask("integ:deploy:aurora-serverless", {
  description: "Deploy the Aurora Serverless integration test stack",
  exec: "cd integ/serverless && npx cdk deploy DrizzleMigrateAuroraServerlessIntegStack --require-approval never",
})

project.addTask("integ:deploy:all", {
  description: "Deploy all integration test stacks",
  exec: "cd integ && npx cdk deploy --all --require-approval never",
})

project.addTask("integ:destroy:postgres", {
  description: "Destroy the PostgreSQL integration test stack",
  exec: "cd integ && npx cdk destroy DrizzleMigrateIntegStack",
})

project.addTask("integ:destroy:mariadb", {
  description: "Destroy the MariaDB integration test stack",
  exec: "cd integ && npx cdk destroy DrizzleMigrateMariaDBIntegStack",
})

project.addTask("integ:destroy:aurora-serverless", {
  description: "Destroy the Aurora Serverless integration test stack",
  exec: "cd integ && npx cdk destroy DrizzleMigrateAuroraServerlessIntegStack",
})

project.addTask("integ:destroy:all", {
  description: "Destroy all integration test stacks",
  exec: "cd integ && npx cdk destroy --all",
})

// Add task to generate migrations
project.addTask("integ:generate-migrations:postgres", {
  description: "Generate Drizzle migrations for the integration test",
  exec: "cd integ/postgres && npx drizzle-kit generate",
})

project.addTask("integ:generate-migrations:mariadb", {
  description: "Generate Drizzle migrations for the integration test",
  exec: "cd integ/mariadb && npx drizzle-kit generate",
})

project.addTask("build:handler", {
  description: "Transpile the Lambda handler to JavaScript",
  exec: "esbuild lambda/handler.ts --bundle --platform=node --target=node20 --external:aws-sdk --outfile=src/handler/handler.js --sourcemap",
})

project.tasks.tryFind("pre-compile")?.spawn(project.tasks.tryFind("build:handler")!)

project.addPackageIgnore(".envrc")
project.addPackageIgnore("*~")
project.addPackageIgnore("integ/")
project.addPackageIgnore(".aider.*")
project.addPackageIgnore("CONVENTIONS.md")
project.addPackageIgnore("lambda")
project.addPackageIgnore("!lib/handler/handler.js")
project.addPackageIgnore("!lib/handler/handler.js.map")

project.synth()

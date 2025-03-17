import { awscdk, javascript } from "projen"
import { ArrowParens, TrailingComma } from "projen/lib/javascript"

const project = new awscdk.AwsCdkConstructLibrary({
  author: "Berend de Boer",
  authorAddress: "berend@pobox.com",
  keywords: ["aws", "aws-cdk", "rds", "aurora", "drizzle"],
  cdkVersion: "2.171.1",
  constructsVersion: "10.3.0",
  defaultReleaseBranch: "main",
  jsiiVersion: "~5.7.0",
  name: "cdk-drizzle-migrate",
  packageManager: javascript.NodePackageManager.NPM,
  gitignore: [
    ".envrc",
    "integ/cdk.out/",
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

  deps: [],
  devDeps: [
    "aws-cdk",
    "@types/aws-lambda",
    "esbuild@^0.25.1",
    "@aws-sdk/client-secrets-manager",
    "drizzle-kit",
    "drizzle-orm",
    "postgres",
    "mysql2",
  ],
  bundledDeps: [],
  peerDeps: [],
})

// Needs to be here, else we get eslint 9
project.package.addDevDeps("eslint@^8")

project.addTask("format", {
  description: "Format code with prettier",
  exec: 'prettier --write "src/**/*.ts" "test/**/*.ts"',
})

// Add integration test tasks
project.addTask("integ:deploy", {
  description: "Deploy the integration test stack",
  exec: "cd integ && npx cdk deploy --require-approval never",
})

project.addTask("integ:destroy", {
  description: "Destroy the integration test stack",
  exec: "cd integ && npx cdk destroy",
})

// Add task to generate migrations
project.addTask("integ:generate-migrations", {
  description: "Generate Drizzle migrations for the integration test",
  exec: "cd integ && npx drizzle-kit generate",
})

project.addTask("build:handler", {
  description: "Transpile the Lambda handler to JavaScript",
  exec: "esbuild lambda/index.ts --bundle --platform=node --target=node20 --external:aws-sdk --outfile=src/handler/handler.js --sourcemap",
})

project.tasks.tryFind("pre-compile")?.spawn(project.tasks.tryFind("build:handler")!)

project.addPackageIgnore(".envrc")
project.addPackageIgnore("*~")
project.addPackageIgnore("integ/cdk.out")
project.addPackageIgnore(".aider.*")
project.addPackageIgnore("CONVENTIONS.md")
project.addPackageIgnore("lambda")

project.synth()

# Code generation
- Write typescript with double quotes for strings.
- Write typescript without semicolons at the end of the line.
- Use npm as package manager.
- Use projen to manage my project.
- Do not make changes to `package.json` directly, edit `.projenrc.ts` instead and regenerate the files projen manages using `npx projen`.
- After updating `.projenrc.ts` always run `npx projen`.
- After making all the required modifications run `npx projen eslint`

# The files
- src/drizzle-migrate-provider.ts: the custom resource provider.
- lambda/handler.ts: the actual code for the custom resource handler. This code is transpiled with esbuild, and the resulting handler.js file is used in the custom resource lambda.
- .projen/: directory with generated files. Do not change them. They are managed via `.projenrc.ts`.
- .github/: directory with generated files. Do not change them. They are managed via `.projenrc.ts`.
- .gitignore and .npmignore are generated files. Do not change them. They are managed vi `.projenrc.ts`.

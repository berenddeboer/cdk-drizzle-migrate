import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
// eslint-disable-next-line import/no-extraneous-dependencies
import { CloudFormationCustomResourceEvent } from "aws-lambda"

// Define the correct response type for the custom resource handler
interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}

/**
 * Helper function to clean control characters from output
 */
const cleanOutput = (s: string): string =>
  s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").slice(0, 512)

/**
 * Execute a command as a promise
 */
function executeCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const full_command = `${path.basename(command)} ${args.join(" ")}`
    console.log(`Executing command: ${full_command}`)

    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      const output = data.toString()
      console.log(output)
      stdout += output
    })

    proc.stderr.on("data", (data) => {
      const output = data.toString()
      console.error(output)
      stderr += output
    })

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(
          new Error(
            `"${full_command}" failed with exit code: ${code}\n${cleanOutput(stderr)}`
          )
        )
      }
    })

    proc.on("error", (err) => {
      reject(new Error(`Failed to execute ${command}: ${err.message}`))
    })
  })
}

interface DatabaseSecret {
  username: string
  password: string
  host: string
  port: number
  engine: string
  dbInstanceIdentifier?: string
  [key: string]: any
}

/**
 * Handler for the custom resource
 * @param event - The CloudFormation custom resource event
 * @returns A response object for the CloudFormation custom resource
 */
export async function onEvent(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse> {
  console.log("Event:", JSON.stringify(event, null, 2))

  const { RequestType, ResourceProperties } = event
  const { secretArn, migrationsPath } = ResourceProperties

  const physicalResourceId = `drizzle-migrate-${Date.now()}`

  if (RequestType === "Create" || RequestType === "Update") {
    // Retrieve the secret
    const secretsManager = new SecretsManagerClient({})
    const secretResponse = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: secretArn,
      })
    )

    if (!secretResponse.SecretString) {
      throw new Error("Secret value is empty")
    }

    const dbSecret: DatabaseSecret = JSON.parse(secretResponse.SecretString)

    // Construct connection string based on the engine type
    let connectionString: string

    switch (dbSecret.engine.toLowerCase()) {
      case "mysql":
      case "mariadb":
        connectionString = `mysql://${dbSecret.username}:${encodeURIComponent(dbSecret.password)}@${dbSecret.host}:${dbSecret.port}`
        break
      case "postgres":
      case "postgresql":
        connectionString = `postgres://${dbSecret.username}:${encodeURIComponent(dbSecret.password)}@${dbSecret.host}:${dbSecret.port}`
        break
      default:
        throw new Error(`Unsupported database engine: ${dbSecret.engine}`)
    }

    // Run the migration using the drizzle-kit CLI
    console.log("Running migrations from:", path.resolve(migrationsPath))

    // Create a drizzle config file with the proper settings
    const drizzleConfig = {
      out: path.resolve(migrationsPath),
      dialect:
        dbSecret.engine.toLowerCase() === "mysql" ||
        dbSecret.engine.toLowerCase() === "mariadb"
          ? "mysql"
          : "postgresql",
      dbCredentials: {
        url: `${connectionString}?sslmode=verify-full&sslrootcert=${process.env.LAMBDA_TASK_ROOT}/certs/global-bundle.pem`,
      },
    }

    // Write the config to a file in the /tmp directory (writable in Lambda)
    const configPath = path.resolve("/tmp/drizzle.config.json")
    fs.writeFileSync(configPath, JSON.stringify(drizzleConfig, null, 2))

    // Use the drizzle-kit from node_modules
    const drizzleKitPath = path.resolve("node_modules", ".bin", "drizzle-kit")

    await executeCommand(drizzleKitPath, ["migrate", "--config", configPath], {
      DATABASE_URL: connectionString,
      DRIZZLE_MIGRATIONS_FOLDER: path.resolve(migrationsPath),
    })
    console.log("Migration completed successfully")

    return {
      PhysicalResourceId: physicalResourceId,
    }
  }

  // For Delete events, we don't need to do anything
  return {
    PhysicalResourceId: event.PhysicalResourceId || physicalResourceId,
  }
}

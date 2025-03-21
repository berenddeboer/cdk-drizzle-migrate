import * as fs from "fs"
import * as path from "path"
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
// eslint-disable-next-line import/no-extraneous-dependencies
import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2"
import { drizzle } from "drizzle-orm/postgres-js"
import mysql from "mysql2/promise"
import postgres from "postgres"

// Define the correct response type for the custom resource handler
interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
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

    const physicalResourceId = `drizzle-migrate-${dbSecret.dbname}`

    // Connect to the database based on engine type
    const engine = dbSecret.engine.toLowerCase()
    const sslConfig = {
      ca: fs.readFileSync(`${process.env.LAMBDA_TASK_ROOT}/certs/global-bundle.pem`),
      rejectUnauthorized: true,
    }

    switch (engine) {
      case "mysql":
      case "mariadb": {
        console.log(`Migrating MySQL/MariaDB database ${dbSecret.dbname} using migrations from ${path.resolve(migrationsPath)}`)
        const connection = await mysql.createConnection({
          host: dbSecret.host,
          port: dbSecret.port,
          user: dbSecret.username,
          password: dbSecret.password,
          database: dbSecret.dbname,
          ssl: sslConfig,
        })
        const db = drizzleMysql(connection)
        await import("drizzle-orm/mysql2/migrator").then(({ migrate }) =>
          migrate(db, { migrationsFolder: path.resolve(migrationsPath) })
        )
        break
      }

      case "postgres":
      case "postgresql": {
        console.log(
          `Migrating PostgreSQL database ${dbSecret.dbname} using migrations from ${path.resolve(migrationsPath)}`
        )
        const sql = postgres({
          host: dbSecret.host,
          port: dbSecret.port,
          username: dbSecret.username,
          password: dbSecret.password,
          database: dbSecret.dbname,
          ssl: sslConfig,
        })
        const db = drizzle(sql)
        await import("drizzle-orm/postgres-js/migrator").then(({ migrate }) =>
          migrate(db, { migrationsFolder: path.resolve(migrationsPath) })
        )
        break
      }

      default: {
        throw new Error(`Unsupported database engine: ${engine}`)
      }
    }
    console.log("Migration completed successfully")

    return {
      PhysicalResourceId: physicalResourceId,
    }
  }

  // For Delete events, we don't need to do anything
  return {
    PhysicalResourceId: event.PhysicalResourceId
  }
}

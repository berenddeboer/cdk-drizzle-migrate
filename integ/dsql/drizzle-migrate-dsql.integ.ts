import { App, Stack, StackProps } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import { ApplicationLogLevel } from "aws-cdk-lib/aws-lambda"
import { DrizzleMigrate } from "../../src"

class DrizzleMigrateDsqlIntegStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create a DSQL cluster
    const dsqlCluster = new dsql.CfnCluster(this, "DsqlCluster", {
      // DSQL are managed service instances with built-in high availability.
      deletionProtectionEnabled: false,
    })

    // Create the DrizzleMigrate construct for DSQL
    new DrizzleMigrate(this, "DrizzleMigration", {
      migrationsPath: "migrations",
      cluster: dsqlCluster,
      handlerProps: {
        applicationLogLevelV2: ApplicationLogLevel.DEBUG,
      },
      // Note: No VPC or secrets required for DSQL
      // IAM authentication is handled automatically
    })
  }
}

const app = new App()
new DrizzleMigrateDsqlIntegStack(app, "DrizzleMigrateDsqlIntegStack")

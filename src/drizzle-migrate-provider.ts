import { strict as assert } from "assert"
import { existsSync } from "fs"
import * as path from "path"
import { CfnResource, CustomResource, Duration, Stack, RemovalPolicy } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

/**
 * Helper function to determine if a cluster is a DSQL cluster
 */
function isDsqlCluster(
  cluster: rds.IDatabaseCluster | rds.IDatabaseInstance | dsql.CfnCluster
): cluster is dsql.CfnCluster {
  return cluster instanceof dsql.CfnCluster
}

/**
 * Properties for DrizzleMigrate
 */
export interface DrizzleMigrateProps {
  /**
   * The database secret containing connection details
   * Must contain standard CDK database secret properties: username,
   * password, host, port, engine, etc.
   * Not required when relying on IAM authentication (such as DSQL).
   * @default - undefined for DSQL clusters using IAM authentication
   */
  readonly dbSecret?: secretsmanager.ISecret

  /**
   * The path to the migrations directory
   * This directory will be bundled with the Lambda function
   */
  readonly migrationsPath: string

  /**
   * Optional properties to customize the Lambda function
   * Excludes runtime, entry, and handler which are managed by the construct
   * @default - Default Lambda configuration is used
   */
  readonly handlerProps?: NodejsFunctionProps

  /**
   * The VPC where the Lambda function will be deployed
   * Required when your database is only accessible in a VPC.
   * Not required for DSQL as it uses public endpoints with IAM authentication
   * @default - use VPC of your RDS/Aurora cluster
   */
  readonly vpc?: ec2.IVpc

  /**
   * Optional subnet selection to deploy the Lambda function
   * Only used when vpc is specified
   * @default - PRIVATE_WITH_EGRESS subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection

  /**
   * Optional database cluster or instance
   * Supports both traditional RDS/Aurora clusters and DSQL clusters
   * - For RDS/Aurora: security groups will be configured to allow access
   * - For DSQL: IAM authentication will be used instead of secrets
   * @default - No database connection is configured
   */
  readonly cluster?: rds.IDatabaseCluster | rds.IDatabaseInstance | dsql.CfnCluster
}

/**
 * A custom resource that runs Drizzle migrations
 */
export class DrizzleMigrate extends Construct {
  /**
   * The custom resource that was created
   */
  public readonly resource: CustomResource

  /**
   * The Lambda function that executes the migrations
   */
  public readonly handler: NodejsFunction

  constructor(scope: Construct, id: string, props: DrizzleMigrateProps) {
    super(scope, id)

    // Validate configuration
    const isDsql = props.cluster && isDsqlCluster(props.cluster)
    if (!isDsql && !props.dbSecret) {
      throw new Error(
        "Either dbSecret (for traditional RDS) or cluster with DSQL must be provided"
      )
    }
    if (!isDsql && !props.vpc) {
      throw new Error("VPC is required for traditional RDS databases")
    }
    if (isDsql && props.dbSecret) {
      throw new Error(
        "dbSecret should not be provided when using DSQL cluster (uses IAM authentication)"
      )
    }

    const migrationsDir = path.join(process.cwd(), props.migrationsPath)
    assert(
      existsSync(migrationsDir),
      `Migrations directory ${migrationsDir} does not exist`
    )
    const handlerDir = path.join(__dirname, "handler")

    const ts_filename = path.join(handlerDir, "index.ts")
    const js_filename = path.join(handlerDir, "index.js")
    const entry = existsSync(ts_filename) ? ts_filename : js_filename

    const environment: Record<string, string> = {
      NO_COLOR: "1",
      ...(props.handlerProps?.environment || {}),
    }

    // Create explicit log group for the Lambda handler
    const logGroup = new logs.LogGroup(this, "MigrateHandlerLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      // Keep log group, it's annoying when it gets deleted for new
      // deploys, and something has gone wrong. You have no way to
      // look at the logs in that case.
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const onEventHandler = new NodejsFunction(this, "MigrateHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: entry,
      logGroup: logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      applicationLogLevelV2: lambda.ApplicationLogLevel.INFO,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      ...props.handlerProps,
      environment,
      bundling: {
        sourceMap: false,
        // Include the migrations directory in the bundle
        commandHooks: {
          beforeBundling(_: string, outputDir: string): string[] {
            const commands = [
              `cp ${handlerDir}/handler.js ${outputDir}`,
              `cp -r ${migrationsDir} ${path.join(outputDir, "migrations")}`,
              // Always download RDS certificate for SSL connections (both RDS and DSQL need it)
              `mkdir -p ${path.join(outputDir, "certs")}`,
              `curl --silent -fL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o ${path.join(outputDir, "certs", "global-bundle.pem")}`,
            ]

            return commands
          },
          afterBundling(): string[] {
            return []
          },
          beforeInstall(): string[] {
            return []
          },
        },
        ...props.handlerProps?.bundling,
      },
    })

    // Handle database connection setup
    if (isDsql) {
      // For DSQL, grant IAM permissions instead of VPC security groups
      const dsqlCluster = props.cluster as dsql.CfnCluster
      onEventHandler.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["dsql:DbConnectAdmin"],
          resources: [dsqlCluster.attrResourceArn],
        })
      )
    } else {
      // Traditional RDS setup with security groups
      if (
        props.cluster &&
        (!props.handlerProps ||
          typeof props.handlerProps.securityGroups === "undefined" ||
          props.handlerProps.securityGroups.length === 0)
      ) {
        const rdsCluster = props.cluster as rds.IDatabaseCluster | rds.IDatabaseInstance
        rdsCluster.connections.allowDefaultPortFrom(
          onEventHandler.connections,
          "Allow drizzle migrate lambda to connect to db"
        )
      }

      // Grant the Lambda function permission to read the secret
      props.dbSecret!.grantRead(onEventHandler)
    }

    this.handler = onEventHandler

    const provider = new cr.Provider(this, "Provider", {
      onEventHandler,
      logGroup,
    })

    // Build custom resource properties based on database type
    const customResourceProperties: Record<string, string> = {
      // We're now using a fixed path inside the Lambda bundle
      migrationsPath: "migrations",
      // Adding a timestamp ensures the resource is updated on each deployment
      timestamp: Date.now().toString(),
    }

    if (isDsql) {
      // For DSQL, construct the endpoint from cluster ID and region
      // DSQL endpoint format: ${clusterId}.dsql.${region}.on.aws
      const dsqlCluster = props.cluster as dsql.CfnCluster
      const clusterId = dsqlCluster.attrIdentifier
      const region = Stack.of(this).region
      customResourceProperties.endpoint = `${clusterId}.dsql.${region}.on.aws`
      customResourceProperties.port = "5432"
    } else {
      customResourceProperties.secretArn = props.dbSecret!.secretArn
    }

    this.resource = new CustomResource(this, "CustomResource", {
      serviceToken: provider.serviceToken,
      properties: customResourceProperties,
    })

    const resourceCfn = this.resource.node.defaultChild as CfnResource
    resourceCfn.addPropertyOverride("ServiceTimeout", 900)

    // Add dependency to ensure database is created before migrations run
    if (props.cluster) {
      this.resource.node.addDependency(props.cluster)
    }
  }
}

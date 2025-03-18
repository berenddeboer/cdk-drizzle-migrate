import * as path from "path"
import { existsSync } from "fs"
import { CfnResource, CustomResource, Duration } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

/**
 * Properties for DrizzleMigrate
 */
export interface DrizzleMigrateProps {
  /**
   * The database secret containing connection details
   * Must contain standard CDK database secret properties: username, password, host, port, engine, etc.
   */
  readonly dbSecret: secretsmanager.ISecret

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
   * Required to allow the Lambda function to connect to the database
   */
  readonly vpc: ec2.IVpc

  /**
   * Optional subnet selection to deploy the Lambda function
   * @default - PRIVATE_WITH_EGRESS subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection

  /**
   * Optional database cluster or instance
   * If provided and a new security group is created, the security group will be
   * configured to allow access to the database
   * @default - No database connection is configured
   */
  readonly cluster?: rds.IDatabaseCluster | rds.IDatabaseInstance
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

    const migrationsDir = path.join(process.cwd(), props.migrationsPath)
    const handlerDir = path.join(__dirname, "handler")

    const ts_filename = `${__dirname}/index.ts`
    const js_filename = `${__dirname}/index.js`
    const entry = existsSync(js_filename) ? js_filename : ts_filename

    const onEventHandler = new NodejsFunction(this, "MigrateHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: entry,
      logRetention: logs.RetentionDays.ONE_WEEK,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      ...props.handlerProps,
      environment: {
        NO_COLOR: "1",
        ...(props.handlerProps?.environment || {}),
      },
      bundling: {
        sourceMap: false,
        // Include the migrations directory in the bundle
        commandHooks: {
          beforeBundling(_: string, outputDir: string): string[] {
            return [
              `cp ${handlerDir}/handler.js ${outputDir}`,
              `cp -r ${migrationsDir} ${path.join(outputDir, "migrations")}`,
              `mkdir -p ${path.join(outputDir, "certs")}`,
              `curl -fL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o ${path.join(outputDir, "certs", "global-bundle.pem")}`,
            ]
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

    // If the user gave us a security group, assume it can connect to the database.
    // If not, make sure the CDK created security group allows access to the DB.
    if (
      props.cluster &&
      (!props.handlerProps ||
        typeof props.handlerProps.securityGroups === "undefined" ||
        props.handlerProps.securityGroups.length === 0)
    ) {
      props.cluster.connections.allowDefaultPortFrom(
        onEventHandler.connections,
        "Allow drizzle migrate lambda to connect to db"
      )
    }

    this.handler = onEventHandler

    // Grant the Lambda function permission to read the secret
    props.dbSecret.grantRead(onEventHandler)

    const provider = new cr.Provider(this, "Provider", {
      onEventHandler,
      logRetention: logs.RetentionDays.ONE_WEEK,
    })

    this.resource = new CustomResource(this, "CustomResource", {
      serviceToken: provider.serviceToken,
      properties: {
        secretArn: props.dbSecret.secretArn,
        // We're now using a fixed path inside the Lambda bundle
        migrationsPath: "migrations",
        // Adding a timestamp ensures the resource is updated on each deployment
        timestamp: Date.now().toString(),
      },
    })

    const resourceCfn = this.resource.node.defaultChild as CfnResource
    resourceCfn.addPropertyOverride("ServiceTimeout", 180)

    // Add dependency to ensure database is created before migrations run
    if (props.cluster) {
      this.resource.node.addDependency(props.cluster)
    }
  }
}

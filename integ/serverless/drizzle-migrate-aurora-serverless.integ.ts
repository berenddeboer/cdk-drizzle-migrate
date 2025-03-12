import { App, Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib"
import * as rds from "aws-cdk-lib/aws-rds"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { DrizzleMigrate } from "../src"

class DrizzleMigrateAuroraServerlessIntegStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create a VPC for the database
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // To save costs during testing
      createInternetGateway: false,
      subnetConfiguration: [
        {
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    })

    // Add VPC endpoint for Secrets Manager to allow Lambda to access secrets without internet access
    vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    })

    // Create a security group for the database
    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Security group for the Aurora Serverless v2 test database",
    })

    // Create an Aurora Serverless v2 PostgreSQL cluster
    const cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      writer: rds.ClusterInstance.serverlessV2("Writer", {
        autoMinorVersionUpgrade: true,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      defaultDatabaseName: "testdb",
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Create the DrizzleMigrate construct
    const migrator = new DrizzleMigrate(this, "DrizzleMigration", {
      dbSecret: cluster.secret!,
      migrationsPath: "migrations",
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      cluster: cluster, // Pass the cluster to allow automatic security group configuration
      handlerProps: {
        environment: {
          TEST_INTEGRATION: "true",
          TEST: "1",
        },
      },
    })

    // Add dependency to ensure database is created before migrations run
    migrator.resource.node.addDependency(cluster)

    // Output the database endpoint for reference
    new CfnOutput(this, "DatabaseEndpoint", {
      value: cluster.clusterEndpoint.hostname,
    })

    // Output the secret ARN for reference
    new CfnOutput(this, "DatabaseSecretArn", {
      value: cluster.secret!.secretArn,
    })
  }
}

const app = new App()
new DrizzleMigrateAuroraServerlessIntegStack(app, "DrizzleMigrateAuroraServerlessIntegStack")

import { App, Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib"
import * as rds from "aws-cdk-lib/aws-rds"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { DrizzleMigrate } from "../../src"

class DrizzleMigrateIntegStack extends Stack {
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
      description: "Security group for the test database",
    })

    // Create a PostgreSQL database
    const database = new rds.DatabaseInstance(this, "DatabaseInstance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      securityGroups: [dbSecurityGroup],
      databaseName: "testdb",
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Create the DrizzleMigrate construct
    new DrizzleMigrate(this, "DrizzleMigration", {
      dbSecret: database.secret!,
      migrationsPath: "migrations",
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      cluster: database, // Pass the database instance to allow automatic security group configuration
    })

    // Output the database endpoint for reference
    new CfnOutput(this, "DatabaseEndpoint", {
      value: database.dbInstanceEndpointAddress,
    })

    // Output the secret ARN for reference
    new CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret!.secretArn,
    })
  }
}

const app = new App()
new DrizzleMigrateIntegStack(app, "DrizzleMigrateIntegStack")

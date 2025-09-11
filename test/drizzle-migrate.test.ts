import { Stack } from "aws-cdk-lib"
import { Template, Match } from "aws-cdk-lib/assertions"
import * as dsql from "aws-cdk-lib/aws-dsql"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { DrizzleMigrate } from "../src"

describe("DrizzleMigrate", () => {
  test("creates resources with required properties", () => {
    const stack = new Stack()

    // Create a secret for testing
    const secret = new secretsmanager.Secret(stack, "TestSecret")

    // Create a VPC for testing
    const vpc = new ec2.Vpc(stack, "TestVpc", {
      maxAzs: 2,
      natGateways: 0,
    })

    new DrizzleMigrate(stack, "TestMigrate", {
      dbSecret: secret,
      migrationsPath: "test/fixtures/migrations",
      vpc: vpc,
    })

    const template = Template.fromStack(stack)

    // Verify main migration handler Lambda function is created
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs20.x",
      Timeout: 300,
    })

    // Verify provider framework Lambda function is created
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "framework.onEvent",
      Timeout: 900,
      LoggingConfig: {
        ApplicationLogLevel: "FATAL",
        LogFormat: "JSON",
        LogGroup: {
          Ref: Match.anyValue(),
        },
      },
    })

    // Verify LoggingConfig on migration handler specifically
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Timeout: 300,
      LoggingConfig: {
        ApplicationLogLevel: "INFO",
        LogFormat: "JSON",
        LogGroup: {
          Ref: Match.anyValue(),
        },
      },
    })

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
            Effect: "Allow",
            Resource: { Ref: "TestSecret16AF87B1" },
          },
        ],
      },
    })

    // Verify our service timeout matches lambda timeout
    template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
      ServiceTimeout: 900,
    })
  })

  test("respects custom handler properties", () => {
    const stack = new Stack()

    // Create a secret for testing
    const secret = new secretsmanager.Secret(stack, "TestSecret")

    // Create a VPC for testing
    const vpc = new ec2.Vpc(stack, "TestVpc", {
      maxAzs: 2,
      natGateways: 0,
    })

    new DrizzleMigrate(stack, "TestMigrate", {
      dbSecret: secret,
      migrationsPath: "test/fixtures/migrations",
      vpc: vpc,
      handlerProps: {
        securityGroups: [new ec2.SecurityGroup(stack, "TestSecurityGroup", { vpc })],
        environment: {
          TEST_VAR: "test-value",
        },
        memorySize: 512,
      },
    })

    const template = Template.fromStack(stack)

    // Verify Lambda function has custom environment variables
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          TEST_VAR: "test-value",
        },
      },
      MemorySize: 512,
    })
  })

  test("configures security group when cluster is provided", () => {
    const stack = new Stack()

    // Create a secret for testing
    const secret = new secretsmanager.Secret(stack, "TestSecret")

    // Create a VPC for testing
    const vpc = new ec2.Vpc(stack, "TestVpc", {
      maxAzs: 2,
      natGateways: 0,
    })

    // Create a database instance for testing
    const database = new rds.DatabaseInstance(stack, "TestDatabase", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
    })

    new DrizzleMigrate(stack, "TestMigrate", {
      dbSecret: secret,
      migrationsPath: "test/fixtures/migrations",
      vpc: vpc,
      cluster: database,
    })

    const template = Template.fromStack(stack)

    // Verify that the default lambda security group is created
    template.resourceCountIs("AWS::EC2::SecurityGroup", 2)
    template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
      Description: "Allow drizzle migrate lambda to connect to db",
      ToPort: {
        "Fn::GetAtt": ["TestDatabase7A4A91C2", "Endpoint.Port"],
      },
    })
  })

  test("supports DSQL cluster with IAM authentication", () => {
    const stack = new Stack()

    // Create a DSQL cluster for testing
    const dsqlCluster = new dsql.CfnCluster(stack, "TestDsqlCluster", {})

    new DrizzleMigrate(stack, "TestMigrate", {
      migrationsPath: "test/fixtures/migrations",
      cluster: dsqlCluster,
    })

    const template = Template.fromStack(stack)

    // Verify Lambda function is created
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs20.x",
      Timeout: 300,
    })

    // Verify IAM policy for DSQL access is created
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: "dsql:DbConnectAdmin",
            Effect: "Allow",
            Resource: { "Fn::GetAtt": ["TestDsqlCluster", "ResourceArn"] },
          },
        ],
      },
    })

    // Verify Custom Resource has correct properties for DSQL
    template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
      ServiceTimeout: 900,
    })

    // Verify no VPC or security group resources are created for DSQL
    template.resourceCountIs("AWS::EC2::VPC", 0)
    template.resourceCountIs("AWS::EC2::SecurityGroup", 0)
  })

  test("validates mutually exclusive configuration", () => {
    const stack = new Stack()

    const secret = new secretsmanager.Secret(stack, "TestSecret")
    const dsqlCluster = new dsql.CfnCluster(stack, "TestDsqlCluster", {})

    // Should throw when both dbSecret and DSQL cluster are provided
    expect(() => {
      new DrizzleMigrate(stack, "TestMigrate", {
        dbSecret: secret,
        migrationsPath: "test/fixtures/migrations",
        cluster: dsqlCluster,
      })
    }).toThrow("dbSecret should not be provided when using DSQL cluster")
  })

  test("validates required configuration for traditional RDS", () => {
    const stack = new Stack()

    // Should throw when neither dbSecret nor cluster is provided
    expect(() => {
      new DrizzleMigrate(stack, "TestMigrate", {
        migrationsPath: "test/fixtures/migrations",
      })
    }).toThrow(
      "Either dbSecret (for traditional RDS) or cluster with DSQL must be provided"
    )

    // Should throw when dbSecret is provided but vpc is missing
    const secret = new secretsmanager.Secret(stack, "TestSecret")
    expect(() => {
      new DrizzleMigrate(stack, "TestMigrate2", {
        dbSecret: secret,
        migrationsPath: "test/fixtures/migrations",
      })
    }).toThrow("VPC is required for traditional RDS databases")
  })
})

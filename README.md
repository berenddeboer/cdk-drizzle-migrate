# About

This CDK construct library makes it possible to run the drizzle
migrate at deploy of your stack time against the RDS cluster of your choice.

This construct library is intended to be used in enterprise
environments, and works in isolated subnets.

<p align="left">
  <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release" alt=semantic-release: angular"></a>
  <a href="https://github.com/berenddeboer/cdk-rds-sql/actions/workflows/release.yml"><img src="https://github.com/berenddeboer/cdk-rds-sql/actions/workflows/release.yml/badge.svg" alt="Release badge"></a>
</p>

# Requirements

This package assumes you deploy from a unix shell with access to `cp`,
`mkdir`, and `curl`.

# Installation

     npm i cdk-drizzle-migrate

# Usage

Have an RDS database and a secret that stores your db credentials.

```ts
import { DrizzleMigrate } from "@berenddeboer/cdk-drizzle-migrate"

// Create the DrizzleMigrate construct
const migrator = new DrizzleMigrate(this, "DrizzleMigration", {
  dbSecret: secret,
  migrationsPath: "migrations",
  vpc: vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
  cluster: database, // Pass the database instance to allow automatic security group configuration
})
```

Specify the path where the migrations are stored, `migrations` in this case.

Passing your database cluster is optional. If supplied, the lambda's
security group will be added as allowed source to the database security group.

If you do not pass one, make sure to pass in a security group in
`handlerProps.securityGroups` which can connect to your database.

Your secret should look like the standard one created by CDK:

```json
{
  "password": "some-password",
  "dbname": "testdb",
  "engine": "postgres",
  "port": 5432,
  "dbInstanceIdentifier": "some-name",
  "host": "some-name.cvabql2flhit.us-east-1.rds.amazonaws.com",
  "username": "postgres"
}
```

When this resource is deployed, it will run `drizzle-kit migrate` for
you in the lambda.

The default timeout is 5 minutes, you need to increase this if your
migration takes more time.

## Development Notes

When making changes to the Lambda handler code in `lambda/index.ts`, you need to transpile it to JavaScript:

```bash
npx projen build:handler
```

This will generate `src/handler/handler.js` which is used by the CDK
construct.

This technique is used to avoid having to bundle nodejs dependencies
as that doesn't work well in this case.


# Potential pitfalls

1. The lambda can only run for 15 minutes. If your migrations take
   longer, this solution will not work.

# Working on this code

1. Install packages: `npm i`

2. Bootstrap CDK if not done: `npx cdk bootstrap
   aws://123456/us-east-1`. Replace 123456 with your AWS account.

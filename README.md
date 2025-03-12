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

- CDK v2.

# Installation

     npm i cdk-drizzle-migrate

# Working on this code

1. Install packages: `npm i`

2. Bootstrap CDK if not done: `npx cdk bootstrap
   aws://123456/us-east-1`. Replace 123456 with your AWS account.

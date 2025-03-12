# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### DrizzleMigrate <a name="DrizzleMigrate" id="cdk-drizzle-migrate.DrizzleMigrate"></a>

A custom resource that runs Drizzle migrations.

#### Initializers <a name="Initializers" id="cdk-drizzle-migrate.DrizzleMigrate.Initializer"></a>

```typescript
import { DrizzleMigrate } from 'cdk-drizzle-migrate'

new DrizzleMigrate(scope: Construct, id: string, props: DrizzleMigrateProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps">DrizzleMigrateProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-drizzle-migrate.DrizzleMigrate.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-drizzle-migrate.DrizzleMigrateProps">DrizzleMigrateProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="cdk-drizzle-migrate.DrizzleMigrate.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-drizzle-migrate.DrizzleMigrate.isConstruct"></a>

```typescript
import { DrizzleMigrate } from 'cdk-drizzle-migrate'

DrizzleMigrate.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-drizzle-migrate.DrizzleMigrate.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.property.handler">handler</a></code> | <code>aws-cdk-lib.aws_lambda_nodejs.NodejsFunction</code> | The Lambda function that executes the migrations. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrate.property.resource">resource</a></code> | <code>aws-cdk-lib.CustomResource</code> | The custom resource that was created. |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-drizzle-migrate.DrizzleMigrate.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `handler`<sup>Required</sup> <a name="handler" id="cdk-drizzle-migrate.DrizzleMigrate.property.handler"></a>

```typescript
public readonly handler: NodejsFunction;
```

- *Type:* aws-cdk-lib.aws_lambda_nodejs.NodejsFunction

The Lambda function that executes the migrations.

---

##### `resource`<sup>Required</sup> <a name="resource" id="cdk-drizzle-migrate.DrizzleMigrate.property.resource"></a>

```typescript
public readonly resource: CustomResource;
```

- *Type:* aws-cdk-lib.CustomResource

The custom resource that was created.

---


## Structs <a name="Structs" id="Structs"></a>

### DrizzleMigrateProps <a name="DrizzleMigrateProps" id="cdk-drizzle-migrate.DrizzleMigrateProps"></a>

Properties for DrizzleMigrate.

#### Initializer <a name="Initializer" id="cdk-drizzle-migrate.DrizzleMigrateProps.Initializer"></a>

```typescript
import { DrizzleMigrateProps } from 'cdk-drizzle-migrate'

const drizzleMigrateProps: DrizzleMigrateProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.dbSecret">dbSecret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | The database secret containing connection details Must contain standard CDK database secret properties: username, password, host, port, engine, etc. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.migrationsPath">migrationsPath</a></code> | <code>string</code> | The path to the migrations directory This directory will be bundled with the Lambda function. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC where the Lambda function will be deployed Required to allow the Lambda function to connect to the database. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IDatabaseCluster \| aws-cdk-lib.aws_rds.IDatabaseInstance</code> | Optional database cluster or instance If provided and a new security group is created, the security group will be configured to allow access to the database. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.handlerProps">handlerProps</a></code> | <code>aws-cdk-lib.aws_lambda_nodejs.NodejsFunctionProps</code> | Optional properties to customize the Lambda function Excludes runtime, entry, and handler which are managed by the construct. |
| <code><a href="#cdk-drizzle-migrate.DrizzleMigrateProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Optional subnet selection to deploy the Lambda function. |

---

##### `dbSecret`<sup>Required</sup> <a name="dbSecret" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.dbSecret"></a>

```typescript
public readonly dbSecret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

The database secret containing connection details Must contain standard CDK database secret properties: username, password, host, port, engine, etc.

---

##### `migrationsPath`<sup>Required</sup> <a name="migrationsPath" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.migrationsPath"></a>

```typescript
public readonly migrationsPath: string;
```

- *Type:* string

The path to the migrations directory This directory will be bundled with the Lambda function.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC where the Lambda function will be deployed Required to allow the Lambda function to connect to the database.

---

##### `cluster`<sup>Optional</sup> <a name="cluster" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.cluster"></a>

```typescript
public readonly cluster: IDatabaseCluster | IDatabaseInstance;
```

- *Type:* aws-cdk-lib.aws_rds.IDatabaseCluster | aws-cdk-lib.aws_rds.IDatabaseInstance
- *Default:* No database connection is configured

Optional database cluster or instance If provided and a new security group is created, the security group will be configured to allow access to the database.

---

##### `handlerProps`<sup>Optional</sup> <a name="handlerProps" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.handlerProps"></a>

```typescript
public readonly handlerProps: NodejsFunctionProps;
```

- *Type:* aws-cdk-lib.aws_lambda_nodejs.NodejsFunctionProps
- *Default:* Default Lambda configuration is used

Optional properties to customize the Lambda function Excludes runtime, entry, and handler which are managed by the construct.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="cdk-drizzle-migrate.DrizzleMigrateProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* PRIVATE_WITH_EGRESS subnets

Optional subnet selection to deploy the Lambda function.

---




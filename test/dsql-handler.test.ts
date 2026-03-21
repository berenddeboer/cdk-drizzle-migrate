import * as path from "path"

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  readFileSync: jest.fn(() => Buffer.from("certificate")),
}))

jest.mock("postgres", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@aws-sdk/dsql-signer", () => ({
  DsqlSigner: jest.fn(),
}))

jest.mock("../lambda/dsql-migrator", () => ({
  migrateDSQL: jest.fn(),
}))

import postgres from "postgres"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { migrateDSQL } from "../lambda/dsql-migrator"
import { onEvent } from "../lambda/handler"

describe("DSQL handler", () => {
  const originalAwsRegion = process.env.AWS_REGION
  const originalLambdaTaskRoot = process.env.LAMBDA_TASK_ROOT

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AWS_REGION = "us-west-2"
    process.env.LAMBDA_TASK_ROOT = "/tmp"
  })

  afterAll(() => {
    process.env.AWS_REGION = originalAwsRegion
    process.env.LAMBDA_TASK_ROOT = originalLambdaTaskRoot
  })

  test("uses a single reserved connection with prepared statements disabled", async () => {
    const postgresMock = postgres as unknown as jest.Mock
    const dsqlSignerMock = DsqlSigner as unknown as jest.Mock
    const migrateDSQLMock = migrateDSQL as unknown as jest.Mock
    const reservedSql = {
      release: jest.fn(),
    }
    const sql = {
      reserve: jest.fn().mockResolvedValue(reservedSql),
      end: jest.fn().mockResolvedValue(undefined),
    }

    postgresMock.mockReturnValue(sql)
    dsqlSignerMock.mockImplementation(() => ({
      getDbConnectAdminAuthToken: jest.fn().mockResolvedValue("auth-token"),
    }))
    migrateDSQLMock.mockResolvedValue(undefined)

    await onEvent({
      RequestType: "Create",
      ResourceProperties: {
        endpoint: "cluster-id.dsql.us-west-2.on.aws",
        port: "5432",
        migrationsPath: "migrations",
      },
    } as any)

    expect(postgres).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "cluster-id.dsql.us-west-2.on.aws",
        port: 5432,
        username: "admin",
        password: "auth-token",
        database: "postgres",
        ssl: true,
        max: 1,
        prepare: false,
      })
    )
    expect(sql.reserve).toHaveBeenCalledTimes(1)
    expect(migrateDSQL).toHaveBeenCalledWith(reservedSql, {
      migrationsFolder: path.resolve("migrations"),
    })
    expect(reservedSql.release).toHaveBeenCalledTimes(1)
    expect(sql.end).toHaveBeenCalledWith({ timeout: 5 })
  })
})

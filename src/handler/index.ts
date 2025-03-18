import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { onEvent } from "./handler.js"

interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}

export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse> {
  return onEvent(event)
}

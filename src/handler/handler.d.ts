import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { CustomResourceResponse } from "aws-lambda"

export declare function onEvent(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse>

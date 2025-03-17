import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { CustomResourceResponse } from "../lambda/index"

export declare function onEvent(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse>

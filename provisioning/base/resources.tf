provider "aws" {
  region     = "us-east-1"
}

locals {
  tags = {
    Project = "Research Catalog"
    BusinessUnit = "LSP"
  }

  log_error_metric = "ResearchCatalogIndexerLogError-${var.environment}"
}

variable "environment" {
  type = string
  default = "qa"
  description = "The name of the environment (qa, production). This controls the name of lambda and the env vars loaded."

  validation {
    condition     = contains(["qa", "production"], var.environment)
    error_message = "The environment must be 'qa' or 'production'."
  }
}

variable "vpc_config" {
  type = map
  description = "VPC config params"
}

# Package the app as a zip:
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/dist.zip"
  source_dir  = "../../"
  excludes    = [".git", ".terraform", "provisioning", "test", "scripts","config"]
}

# Upload the zipped app to S3:
resource "aws_s3_object" "uploaded_zip" {
  bucket = "nypl-github-actions-builds-${var.environment}"
  key    = "research-catalog-indexer-${var.environment}-dist.zip"
  acl    = "private"
  source = data.archive_file.lambda_zip.output_path
  etag   = filemd5(data.archive_file.lambda_zip.output_path)
  tags = local.tags
}

# Create the lambda:
resource "aws_lambda_function" "lambda_instance" {
  description   = "Indexes bib data for the DiscoveryAPI, which powers the Research Catalog"
  function_name = "ResearchCatalogIndexer-${var.environment}"
  handler       = "index.handler"
  memory_size   = 512
  role          = "arn:aws:iam::946183545209:role/lambda-full-access"
  runtime       = "nodejs20.x"
  timeout       = 300

  # Location of the zipped code in S3:
  s3_bucket     = aws_s3_object.uploaded_zip.bucket
  s3_key        = aws_s3_object.uploaded_zip.key

    # Trigger pulling code from S3 when the zip has changed:
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256


  # Load ENV vars from ./config/{environment}.env
  environment {
    variables = { for tuple in regexall("(.*?)=(.*)", file("../../config/${var.environment}.env")) : tuple[0] => tuple[1] }
  }
  
  vpc_config {
    subnet_ids         = var.vpc_config.subnet_ids
    security_group_ids = var.vpc_config.security_group_ids
  }
  
  tags = local.tags
}

data "aws_sns_topic" "rc_alarms" {
  name = "research-catalog-team-alarms-${var.environment}"

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "ResearchCatalogIndexerLambdaErrorAlarm-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Lambda function ${aws_lambda_function.lambda_instance.function_name} has invocation errors"
  alarm_actions       = [data.aws_sns_topic.rc_alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.lambda_instance.function_name
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "kinesis_iterator_age" {
  alarm_name          = "ResearchCatalogIndexerKinesisIteratorAgeAlarm-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "IteratorAge"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = 3600000 # 1 hour
  alarm_description   = "Triggered when Kinesis iterator age of lambda function ${aws_lambda_function.lambda_instance.function_name} exceeds 1 hour"
  alarm_actions       = [data.aws_sns_topic.rc_alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.lambda_instance.function_name
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_metric_filter" "log_error_metric_filter" {
  name           = local.log_error_metric
  pattern        = "{ $.level = \"error\" }"
  log_group_name = "/aws/lambda/${aws_lambda_function.lambda_instance.function_name}"

  metric_transformation {
    name      = local.log_error_metric
    namespace = "LogMetrics"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "log_errors" {
  alarm_name          = "ResearchCatalogIndexerLogErrorAlarm-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = local.log_error_metric
  namespace           = "LogMetrics"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Lambda function ${aws_lambda_function.lambda_instance.function_name} has error logs"
  alarm_actions       = [data.aws_sns_topic.rc_alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.lambda_instance.function_name
  }

  tags = local.tags
}

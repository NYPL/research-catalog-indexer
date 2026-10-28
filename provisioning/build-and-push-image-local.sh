# This script can be run locally to manually push the app to ECR for use in AWS Batch
#
# Usage:
#   ENV_TAG=qa ./provisioning/build-and-push-image-local.sh

AWS_PROFILE=nypl-digital-dev
ECR_REGISTRY=946183545209.dkr.ecr.us-east-1.amazonaws.com

aws ecr get-login-password --region us-east-1 --profile $AWS_PROFILE | docker login --username AWS --password-stdin $ECR_REGISTRY

. ./provisioning/build-and-push-image.sh

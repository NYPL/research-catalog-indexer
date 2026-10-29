# This script builds the app as a Docker image and pushes it to ECR
# for use in AWS Batch.
#
# Usage:
#   ENV_TAG=qa ./provisioning/build-and-push-image.sh

ECR_REGISTRY=946183545209.dkr.ecr.us-east-1.amazonaws.com
ECR_REPOSITORY=research-catalog-indexer
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG=$GIT_SHA
DOCKER_DEFAULT_PLATFORM=linux/amd64

if [[ -z "$ENV_TAG" ]]; then
  echo ENV_TAG must be set to qa / production
  exit
fi

# If running locally, log in.
# Absense of CI env var indicates running outside GHA:
if [[ -z "$CI" ]]; then
  echo Logging you in
  AWS_PROFILE=nypl-digital-dev
  aws ecr get-login-password --region us-east-1 --profile $AWS_PROFILE | docker login --username AWS --password-stdin $ECR_REGISTRY
fi

echo Building $ENV_TAG image

docker build --platform=linux/amd64 -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:${ENV_TAG}-latest
docker push $ECR_REGISTRY/$ECR_REPOSITORY:${ENV_TAG}-latest

echo Done updating $ENV_TAG image

AWS_PROFILE=nypl-digital-dev
ECR_REGISTRY=946183545209.dkr.ecr.us-east-1.amazonaws.com
ENV_TAG=qa

aws ecr get-login-password --region us-east-1 --profile $AWS_PROFILE | docker login --username AWS --password-stdin $ECR_REGISTRY

. ./provisioning/build-and-push-image.sh

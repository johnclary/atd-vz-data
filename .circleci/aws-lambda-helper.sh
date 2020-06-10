#!/usr/bin/env bash

case "${CIRCLE_BRANCH}" in
  "production")
    export WORKING_STAGE="production";
    ;;

  *)
    export WORKING_STAGE="staging";
    ;;
esac

#
# First, we need to create the python package by installing requirements
#
function install_requirements {
  echo "Installing AWS's CLI";
  pip install awscli;
  echo "Installing requirements...";
  pip install -r ./requirements.txt --target ./package;
}

#
# Secondly, we must bundle the package and python script into a single zip file bundle
#
function bundle_function {
  echo "Bundling function...";
  cd package;
  zip -r9 ../function.zip .;
  cd ${OLDPWD};
  zip -g function.zip app.py;
}

#
# Generates environment variables for deployment
#
function generate_env_vars {
      echo $ZAPPA_SETTINGS > zappa_settings.json;
      STAGE_ENV_VARS=$(cat zappa_settings.json | jq -r ".${WORKING_STAGE}.aws_environment_variables");
      echo -e "{\"Description\": \"ATD VisionZero Events Handler\", \"Environment\": { \"Variables\": ${STAGE_ENV_VARS}}}" | jq -rc > handler_config.json;
}

#
# Deploys a single function
#
function deploy_event_function {
  FUNCTION_NAME=$1
  echo "Deploying function: ${FUNCTION_NAME}";
  # Create or update function
  { # try
    echo "Creating lambda function ${FUNCTION_NAME}";
    aws lambda create-function \
        --role $ATD_VZ_DATA_EVENTS_ROLE \
        --handler "app.handler" \
        --tags "project=atd-vz-data,environment=${WORKING_STAGE}" \
        --runtime python3.7 \
        --function-name "${FUNCTION_NAME}" \
        --zip-file fileb://function.zip > /dev/null;
  } || { # catch: update
    echo -e "\n\nUpdating lambda function ${FUNCTION_NAME}";
    aws lambda update-function-code \
        --function-name "${FUNCTION_NAME}" \
        --zip-file fileb://function.zip > /dev/null;
  }

  # Set concurrency to maximum allowed: 5
  echo "Setting concurrency...";
  aws lambda put-function-concurrency \
        --function-name "${FUNCTION_NAME}" \
        --reserved-concurrent-executions 5;
  # Set environment variables for the function
  echo "Resetting environment variables"
  aws lambda update-function-configuration \
        --function-name "${FUNCTION_NAME}" \
        --cli-input-json file://handler_config.json > /dev/null;
}

#
# Deploys an SQS Queue
#
function deploy_sqs {
    QUEUE_NAME=$1
    QUEUE_URL=$(aws sqs get-queue-url --queue-name "${QUEUE_NAME}" 2>/dev/null | jq -r ".QueueUrl")
    echo "Deploying queue ${QUEUE_NAME}";
    # If the queue url is empty, it means it does not exist. We must create it.
    if [[ "${QUEUE_URL}" = "" ]]; then
        # Create with default values, no re-drive policy.
        echo "Creating Queue";
        CREATE_SQS=$(aws sqs create-queue --queue-name "${QUEUE_NAME}" --attributes "DelaySeconds=0,MaximumMessageSize=262144,MessageRetentionPeriod=345600,VisibilityTimeout=30" 2> /dev/null);
        QUEUE_URL=$(aws sqs get-queue-url --queue-name "${QUEUE_NAME}" 2>/dev/null | jq -r ".QueueUrl");
    else
        echo "Skipping SQS creation, the queue already exists: ${QUEUE_NAME}";
    fi;

    # Gather SQS attributes from URL, extract amazon resource name
    QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "${QUEUE_URL}" --attribute-names "QueueArn" 2>/dev/null | jq -r ".Attributes.QueueArn");
    echo "QUEUE_URL: ${QUEUE_URL}";
    echo "QUEUE_ARN: ${QUEUE_ARN}";
}

#
# Deploys all functions in the events directory
#
function deploy_event_functions {
  MAIN_DIR=$PWD
  for FUNCTION in $(find atd-events -type d -mindepth 1 -maxdepth 1);
  do
      FUNCTION_DIR=$(echo "${FUNCTION}" | cut -d "/" -f 2);
      FUNCTION_NAME="atd-vz-data-events-${FUNCTION_DIR}_${WORKING_STAGE}";
      echo "Current directory: ${PWD}";
      echo "Building function '${FUNCTION_NAME}' @ path: '${FUNCTION}'";
      cd $FUNCTION;
      echo "Entered directory: ${PWD}";
      install_requirements;
      bundle_function;
      generate_env_vars;
      deploy_event_function $FUNCTION_NAME;
      deploy_sqs $FUNCTION_NAME;
      cd $MAIN_DIR;
      echo "Exit, current path: ${PWD}";
  done;
}

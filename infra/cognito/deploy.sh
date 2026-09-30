#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-pet2text-cognito-mfa}"
REGION="${AWS_REGION:-us-east-1}"
TEMPLATE="$(cd "$(dirname "$0")" && pwd)/cloudformation.yaml"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "missing $TEMPLATE" >&2
  exit 1
fi

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName="${ENVIRONMENT_NAME:-pet2text}" \
    CallbackURL="${CALLBACK_URL:-http://localhost:3000}" \
    LogoutURL="${LOGOUT_URL:-http://localhost:3000/login}" \
    SmsExternalId="${SMS_EXTERNAL_ID:-pet2text-cognito-sms}" \
    MfaConfiguration="${MFA_CONFIGURATION:-OPTIONAL}" \
    EnableSmsMfa="${ENABLE_SMS_MFA:-true}"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output table

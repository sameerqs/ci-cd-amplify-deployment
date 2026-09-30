# Cognito User Pool (TOTP + production SMS)

CloudFormation for a cloneable User Pool. No account secrets belong in git.

```bash
cd infra/cognito
chmod +x deploy.sh
# optional: copy parameters.example.json and pass --parameter-overrides
AWS_REGION=us-east-1 ENVIRONMENT_NAME=pet2text ./deploy.sh
```

The script prints `UserPoolId`, `PublicClientId`, `BackendClientId`, `Issuer`,
and `JwksUrl`. Copy those into each stack’s own `.env` (never commit them).

Retrieve the confidential client secret from the console or:

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --client-id "$COGNITO_CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' \
  --output text
```

## Production SMS checklist

SMS MFA is **not** “type a phone number and it works.” Complete these before
`MfaConfiguration=ON` in production.

1. **SNS / End User Messaging**
   - Prefer AWS End User Messaging SMS (Pinpoint SMS) for 10DLC in the US.
   - Set an SNS SMS spend limit and CloudWatch alarms on `SMSMonthToDateSpentUSD`.
2. **Leave the SMS sandbox**
   - Sandbox can only text verified numbers. Request production access in SNS.
3. **US origination identity**
   - Register a 10DLC brand + campaign, or a toll-free number, in the same
     region as the User Pool. Unregistered shared routes are blocked or filtered.
4. **IAM role**
   - This stack creates `*-cognito-sms` with `sts:ExternalId` and `sns:Publish`
     limited to `sns:Protocol=sms`. Attach a tighter resource ARN once you have
     a dedicated origination identity.
5. **Recovery ≠ MFA**
   - The pool recovers via **verified email only**. Do not add `verified_phone_number`
     recovery if SMS is an MFA channel — a stolen phone would reset the password
     and pass MFA.
6. **App clients**
   - Next.js uses the **public** client (no secret, SRP + password + refresh).
   - FastAPI uses the **confidential** client (secret hash on server calls).
7. **SES**
   - Switch `EmailSendingAccount` to SES with a verified `FromEmail` before go-live.

See [fastapi/lambdas/cognito_custom_auth/README.md](../../fastapi/lambdas/cognito_custom_auth/README.md) for the trigger contract
and setup steps.

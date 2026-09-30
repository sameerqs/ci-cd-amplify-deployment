# Cognito custom-auth triggers

Three Lambda functions that turn a Cognito user pool into a passwordless,
magic-link sign-in. Without them this application cannot authenticate
anyone: `InitiateAuth` returns no challenge and the backend logs
`Cognito custom challenge did not return 'magic_token'`.

| File | Pool trigger |
|---|---|
| `define_auth_challenge.py` | Define Auth Challenge |
| `create_auth_challenge.py` | Create Auth Challenge |
| `verify_auth_challenge_response.py` | Verify Auth Challenge Response |

Each is a zero-dependency Python 3.12+ handler named `lambda_handler`.

## The contract with this backend

`create_auth_challenge` returns the one-time token in
`publicChallengeParameters["magic_token"]`. The backend reads exactly that key
(`app/modules/cognito/passwordless.py::CHALLENGE_TOKEN_KEY`), stores a SHA-256 of
it alongside Cognito's `Session` string, and emails the link. When the user
clicks, the backend answers the challenge with the raw token as `ANSWER`, and
`verify_auth_challenge_response` compares it against
`privateChallengeParameters["answer"]`.

Change the key on one side and sign-in stops working, silently, with only that
log line to say why.

## What the session is afterwards

When `define_auth_challenge` sets `issueTokens`, the pool returns an
`AuthenticationResult`. Those tokens *are* the session -- the backend passes
them straight through and mints nothing of its own:

```
access token   -> Authorization: Bearer, verified against this pool's JWKS on
                  every protected request (app/core/cognito_jwt.py)
refresh token  -> HttpOnly cookie, spent only once the access token expires,
                  via GetTokensFromRefreshToken
sub            -> the only thing stored here, in users.cognito_sub
```

Nothing about the session reaches this database, so disabling or deleting a
user in the pool ends their access at the next refresh, and restarting the
backend does not sign anyone out.

## Required user pool and app client settings

The app client must have:

- **`ALLOW_CUSTOM_AUTH`** in its explicit auth flows. Without it `InitiateAuth`
  rejects `AuthFlow=CUSTOM_AUTH` outright.
- **No client secret.** The backend sends no `SECRET_HASH`, so a client
  configured with a secret makes `InitiateAuth` fail with
  `InvalidParameterException`.
- **Refresh tokens enabled**, and a refresh validity at least as long as you
  expect sessions to last.
- **Token revocation enabled**, or sign-out cannot reach Cognito.
- **`ADMIN_NO_SRP_AUTH` is NOT required** — nothing here uses an admin auth flow.

The pool itself needs `email` as a required attribute and auto-verified, since
the flow has no other way to reach the user.

IAM permissions for the backend's credentials: `cognito-idp:AdminGetUser` and
`cognito-idp:AdminCreateUser`. `InitiateAuth`, `RespondToAuthChallenge`,
`GetTokensFromRefreshToken` and `RevokeToken` are token-authorized and need no
IAM grant.

## Deploying

Each file is self-contained, so a zip of the single file is a complete package:

```
cd lambdas/cognito_custom_auth
for f in define_auth_challenge create_auth_challenge verify_auth_challenge_response; do
  zip "$f.zip" "$f.py"
done
```

Create three functions with handler `<file>.lambda_handler`, then attach them to
the pool under **User pool properties → Lambda triggers**, and give each one
`lambda:InvokeFunction` permission for principal `cognito-idp.amazonaws.com`
scoped to your pool ARN.

## Attempt limit

`define_auth_challenge.py` allows `MAX_ATTEMPTS = 3` answers before failing the
authentication. The token is short-lived and delivered by email, so brute force
is the realistic attack; raise it only if you understand that.

## A trade-off worth knowing

Returning the token in `publicChallengeParameters` means it leaves Cognito and
passes through this backend, which is what lets the application own the email
template and delivery. If you would rather the token never left AWS, send the
mail from inside `create_auth_challenge` via SES and return only a correlation id
— the backend change is then to stop reading `magic_token` and to store the
correlation id instead.

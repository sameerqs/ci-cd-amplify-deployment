API_PREFIX = "/api"
API_V1_PREFIX = "/api/v1"

PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED"  # noqa: S105
PASSWORD_CHANGE_EXEMPT: frozenset[tuple[str, str]] = frozenset(
    {
        ("POST", f"{API_V1_PREFIX}/auth/change-password"),
        ("POST", f"{API_V1_PREFIX}/auth/force-change-password"),
        ("POST", f"{API_V1_PREFIX}/auth/logout"),
        ("GET", f"{API_V1_PREFIX}/users/profile"),
    }
)

PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        f"{API_V1_PREFIX}/auth/magic-link",
        f"{API_V1_PREFIX}/auth/magic-link/verify",
        f"{API_V1_PREFIX}/auth/refresh",
        f"{API_V1_PREFIX}/auth/logout",
    }
)


ACCOUNT_PENDING_APPROVAL = "ACCOUNT_PENDING_APPROVAL"
ACCOUNT_NOT_APPROVED = "ACCOUNT_NOT_APPROVED"
ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED"


class Messages:
    ACCOUNT_SUSPENDED = (
        "This account has been suspended. Contact an administrator for more information."
    )
    USER_SUSPENDED = "User suspended"
    USER_RESTORED = "User restored"
    ACCOUNT_PENDING_APPROVAL = (
        "This account is pending approval. An administrator will review the request shortly."
    )
    ACCOUNT_NOT_APPROVED = (
        "This account was not approved. Contact an administrator if this appears to be an error."
    )
    SIGNUP_RECEIVED = (
        "The signup request has been received. An administrator will review it shortly."
    )
    MAGIC_LINK_SENT = "If that email has an approved account, a sign-in link is on its way."
    LOGIN_SUCCESS = "Login successful"
    TOKEN_REFRESHED = "Session refreshed"  # noqa: S105
    LOGGED_OUT = "Logged out"
    PASSWORD_RESET_LINK_SENT = (
        "If an account exists for that email, a password reset link has been sent."  # noqa: S105
    )
    PASSWORD_RESET = "Password reset successfully. Please log in with your new password."  # noqa: S105
    PASSWORD_CHANGED = "Password changed successfully"  # noqa: S105
    COGNITO_SIGNED_UP = "Account created. Check your email for a confirmation code."
    COGNITO_CONFIRMED = "Account confirmed. You can sign in."
    COGNITO_CODE_RESENT = "A new confirmation code has been sent if the account exists."
    COGNITO_CHALLENGE_REQUIRED = "Additional authentication is required."
    COGNITO_MFA_ASSOCIATED = "Scan the QR code or enter the secret in your authenticator app."
    COGNITO_MFA_VERIFIED = "Authenticator app verified."
    COGNITO_MFA_UPDATED = "MFA preference updated."
    COGNITO_NOT_PROVISIONED = (
        "This account is not provisioned in the application. Ask an administrator to invite you."
    )
    PROFILE_UPDATED = "Profile updated successfully"
    USER_INVITED = "User invited successfully"
    USER_UPDATED = "User updated successfully"
    USER_DELETED = "User deleted successfully"
    SIGNUP_APPROVED = "Account approved"
    SIGNUP_REJECTED = "Account rejected"

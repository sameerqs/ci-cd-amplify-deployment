from app.core.pagination import Sortable
from app.modules.signups.models import SignupRequest

SIGNUP_SORTABLE: Sortable = {
    "displayName": (SignupRequest.email,),
    "email": (SignupRequest.email,),
    "status": (SignupRequest.status,),
    "createdAt": (SignupRequest.created_at,),
    "updatedAt": (SignupRequest.updated_at,),
}
# why: signups are reviewed oldest-first - the longest-waiting applicant should surface first.
SIGNUP_DEFAULT_ORDER = (SignupRequest.created_at.asc(),)

SIGNUP_ALREADY_PENDING = (
    "A signup request for this email address is already pending approval. "
    "An administrator will review it shortly."
)
SIGNUP_NOT_APPROVED = (
    "The signup request was not approved. Contact an administrator if this appears to be an error."
)
SIGNUP_NOT_FOUND = "Signup not found"
SIGNUP_EMAIL_TAKEN = "An account with this email already exists."

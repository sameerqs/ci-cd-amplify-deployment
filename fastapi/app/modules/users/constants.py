from app.core.enums import UserStatus
from app.core.pagination import Sortable
from app.modules.users.models import User

SORTABLE: Sortable = {
    "email": (User.email,),
    "createdAt": (User.created_at,),
    "updatedAt": (User.updated_at,),
    "status": (User.status,),
    "isActive": (User.status,),
    "activatedAt": (User.activated_at,),
    "suspendedAt": (User.suspended_at,),
    "displayName": (User.email,),
}
DEFAULT_ORDER = (User.updated_at.desc(),)

SEARCH_STATUS_WORDS = {"active": UserStatus.ACTIVE, "suspended": UserStatus.SUSPENDED}
MAX_EMAIL_LENGTH = 100
MAX_DISPLAY_NAME_LENGTH = 100

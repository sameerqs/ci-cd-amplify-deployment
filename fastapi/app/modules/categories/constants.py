from app.core.pagination import Sortable
from app.modules.categories.models import Category

SORTABLE: Sortable = {
    "name": (Category.name,),
    "isActive": (Category.is_active,),
    "createdAt": (Category.created_at,),
    "updatedAt": (Category.updated_at,),
}
DEFAULT_ORDER = (Category.name.asc(),)
MAX_NAME_LENGTH = 50
MAX_DESCRIPTION_LENGTH = 255

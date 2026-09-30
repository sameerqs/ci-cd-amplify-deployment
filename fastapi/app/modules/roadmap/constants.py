from app.core.pagination import Sortable
from app.modules.roadmap.models import RoadmapItem

SORTABLE: Sortable = {
    "title": (RoadmapItem.title,),
    "isActive": (RoadmapItem.is_active,),
    "createdAt": (RoadmapItem.created_at,),
    "updatedAt": (RoadmapItem.updated_at,),
}
DEFAULT_ORDER = (RoadmapItem.created_at.asc(),)
MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 500
MAX_PROMPT_LENGTH = 200

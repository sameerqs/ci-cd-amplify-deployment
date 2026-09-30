import pytest
from sqlalchemy import select

from app.core.errors import BadRequestError
from app.core.pagination import (
    PageQuery,
    SortSpec,
    apply_page,
    apply_sort,
    get_page_query,
    parse_sort,
)
from app.modules.users.models import User


def test_parse_sort_variants() -> None:
    assert parse_sort(None) == ()
    assert parse_sort("") == ()
    assert parse_sort("firstName") == (SortSpec("firstName", "asc"),)
    assert parse_sort("firstName:desc, createdAt:ASC ,,") == (
        SortSpec("firstName", "desc"),
        SortSpec("createdAt", "asc"),
    )


def test_parse_sort_rejects_bad_direction() -> None:
    with pytest.raises(BadRequestError, match="Invalid sort direction"):
        parse_sort("email:sideways")


def test_get_page_query_defaults_and_trimming() -> None:
    page = get_page_query()
    assert page == PageQuery()
    assert page.offset == 0
    custom = get_page_query(page=3, page_size=10, search="  ada  ", sort="email:desc")
    assert custom.offset == 20
    assert custom.search == "ada"
    assert custom.sort == (SortSpec("email", "desc"),)
    assert get_page_query(search="   ").search is None


SORTABLE = {
    "email": (User.email,),
    "displayName": (User.email, User.status),
}


def test_apply_sort_uses_whitelist_and_default() -> None:
    stmt = select(User)
    default = str(apply_sort(stmt, (), SORTABLE, [User.updated_at.desc()]))
    assert "ORDER BY users.utc_modified_datetime DESC" in default
    sorted_stmt = str(
        apply_sort(stmt, (SortSpec("displayName", "desc"), SortSpec("email", "asc")), SORTABLE, [])
    )
    assert "ORDER BY users.email DESC, users.status DESC, users.email ASC" in sorted_stmt


def test_apply_sort_rejects_unknown_field() -> None:
    with pytest.raises(BadRequestError, match="Unsupported sort field"):
        apply_sort(select(User), (SortSpec("password_hash", "asc"),), SORTABLE, [])


def test_apply_page_offsets() -> None:
    compiled = str(apply_page(select(User), PageQuery(page=2, page_size=15)))
    assert "LIMIT" in compiled and "OFFSET" in compiled

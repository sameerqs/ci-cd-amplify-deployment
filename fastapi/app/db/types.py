from enum import IntEnum

from sqlalchemy import Dialect, Integer
from sqlalchemy.types import TypeDecorator


class IntEnumType[E: IntEnum](TypeDecorator[E]):
    # why: numeric enums persist as plain Int columns, never Postgres/SQLAlchemy enum types,
    # so the stored value stays a bare integer while the mapped attribute stays typed.
    impl = Integer
    cache_ok = True

    def __init__(self, enum_type: type[E]) -> None:
        super().__init__()
        self.enum_type = enum_type

    def process_bind_param(self, value: E | None, dialect: Dialect) -> int | None:
        return None if value is None else int(value)

    def process_result_value(self, value: int | None, dialect: Dialect) -> E | None:
        return None if value is None else self.enum_type(value)

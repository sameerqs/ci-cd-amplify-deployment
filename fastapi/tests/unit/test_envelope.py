from pydantic import BaseModel

from app.core.envelope import (
    ApiError,
    ApiResponse,
    WarningInfo,
    ok,
    ok_empty,
    ok_items,
    total_pages,
)


class Thing(BaseModel):
    name: str


def test_ok_wraps_data_with_camel_case_envelope() -> None:
    response = ok(Thing(name="a"), message="done")
    dumped = response.model_dump(mode="json", by_alias=True)
    assert dumped == {
        "isSuccess": True,
        "message": "done",
        "data": {"name": "a"},
        "errors": [],
        "warningHeading": "",
        "warningMessage": "",
        "warningType": None,
    }


def test_ok_with_warning() -> None:
    response = ok(
        Thing(name="a"), warning=WarningInfo(heading="Heads up", message="x", type="SOFT")
    )
    assert response.warning_heading == "Heads up"
    assert response.warning_message == "x"
    assert response.warning_type == "SOFT"


def test_ok_items_and_empty() -> None:
    assert ok_items([Thing(name="a")]).model_dump(by_alias=True)["data"] == {
        "items": [{"name": "a"}]
    }
    assert ok_empty("bye").model_dump(by_alias=True)["data"] == {}
    assert ok_empty("bye").message == "bye"


def test_envelope_accepts_snake_and_camel_input() -> None:
    parsed = ApiResponse[Thing].model_validate(
        {"isSuccess": False, "data": {"name": "x"}, "errors": [{"message": "m", "code": "C"}]}
    )
    assert parsed.is_success is False
    assert parsed.errors == [ApiError(message="m", code="C")]
    parsed_snake = ApiResponse[Thing].model_validate({"is_success": True, "data": {"name": "y"}})
    assert parsed_snake.data.name == "y"


def test_total_pages() -> None:
    assert total_pages(0, 15) == 0
    assert total_pages(1, 15) == 1
    assert total_pages(15, 15) == 1
    assert total_pages(16, 15) == 2

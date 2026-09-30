from typing import Literal

from pydantic import Field

from app.core.schemas import InputSchema

# why: a client-triggered event is one nobody server-side observes directly --
# a UI interaction with no state change behind it. Every other named event in
# app.core.analytics happens where the app already does the corresponding
# work (a message send, an upload), and stays out of this list on purpose: an
# authenticated client should not be able to write "emergency_redirect_shown"
# into the log for a turn that never happened.
ClientEvent = Literal["chip_tapped", "capture_sheet_opened"]

PropertyValue = str | int | bool


class TrackEventIn(InputSchema):
    event: ClientEvent
    properties: dict[str, PropertyValue] = Field(default_factory=dict)

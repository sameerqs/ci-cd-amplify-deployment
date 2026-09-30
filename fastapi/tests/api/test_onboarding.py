from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from tests.api.conftest import auth_headers

ONBOARDING = "/api/v1/users/onboarding"
BOTH = {"ageConfirmed": True, "betaDisclaimerAccepted": True}


async def test_completing_stamps_the_consent(
    client: AsyncClient, session: AsyncSession, plain_user: User
) -> None:
    res = await client.post(ONBOARDING, headers=auth_headers(plain_user), json=BOTH)

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["ageConfirmed"] is True
    assert data["betaDisclaimerAccepted"] is True
    assert data["onboardingCompletedAt"] is not None
    await session.refresh(plain_user)
    assert plain_user.onboarding_completed_at is not None


async def test_resubmitting_keeps_the_original_stamp(client: AsyncClient, plain_user: User) -> None:
    headers = auth_headers(plain_user)
    first = await client.post(ONBOARDING, headers=headers, json=BOTH)
    second = await client.post(ONBOARDING, headers=headers, json=BOTH)

    assert second.status_code == 200
    assert (
        second.json()["data"]["onboardingCompletedAt"]
        == first.json()["data"]["onboardingCompletedAt"]
    )


async def test_age_alone_is_rejected(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(
        ONBOARDING,
        headers=auth_headers(plain_user),
        json={"ageConfirmed": True, "betaDisclaimerAccepted": False},
    )

    assert res.status_code == 400
    assert "required" in res.json()["errors"][0]["message"]


async def test_disclaimer_alone_is_rejected(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(
        ONBOARDING,
        headers=auth_headers(plain_user),
        json={"ageConfirmed": False, "betaDisclaimerAccepted": True},
    )
    assert res.status_code == 400


async def test_nothing_is_stamped_when_consent_is_incomplete(
    client: AsyncClient, session: AsyncSession, plain_user: User
) -> None:
    await client.post(
        ONBOARDING,
        headers=auth_headers(plain_user),
        json={"ageConfirmed": False, "betaDisclaimerAccepted": False},
    )

    await session.refresh(plain_user)
    assert plain_user.onboarding_completed_at is None
    assert plain_user.age_confirmed is False


async def test_requires_authentication(client: AsyncClient, roles: None) -> None:
    res = await client.post(ONBOARDING, json=BOTH)
    assert res.status_code == 401


async def test_rejects_unknown_fields(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(
        ONBOARDING, headers=auth_headers(plain_user), json={**BOTH, "nickname": "x"}
    )
    assert res.status_code == 422

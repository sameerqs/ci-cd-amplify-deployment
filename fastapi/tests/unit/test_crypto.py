"""The vault: the one secret stored in a form this service can read back."""

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.core import crypto
from app.core.config import settings

SECRET = "a-cognito-refresh-token." + "z" * 500


@pytest.fixture(autouse=True)
def _clear_cipher_cache() -> None:
    crypto._cipher.cache_clear()


def test_a_secret_survives_a_round_trip() -> None:
    assert crypto.decrypt(crypto.encrypt(SECRET)) == SECRET


def test_the_stored_form_does_not_contain_the_secret() -> None:
    stored = crypto.encrypt(SECRET)

    assert SECRET not in stored
    assert stored != SECRET


def test_the_same_secret_encrypts_differently_every_time() -> None:
    # Fernet carries a random IV, so a repeated value is not a repeated ciphertext.
    assert crypto.encrypt(SECRET) != crypto.encrypt(SECRET)


def test_a_secret_written_with_another_key_cannot_be_read(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stored = crypto.encrypt(SECRET)
    monkeypatch.setattr(settings, "SESSION_ENCRYPTION_KEY", _other_key())
    crypto._cipher.cache_clear()

    with pytest.raises(crypto.VaultError):
        crypto.decrypt(stored)


def test_a_corrupt_value_raises_rather_than_returning_rubbish() -> None:
    with pytest.raises(crypto.VaultError):
        crypto.decrypt("not-a-fernet-token")


def test_an_explicit_key_is_preferred_over_the_derived_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    derived = crypto._vault_key()
    explicit = _other_key()
    monkeypatch.setattr(settings, "SESSION_ENCRYPTION_KEY", explicit)
    crypto._cipher.cache_clear()

    assert crypto._vault_key() == explicit.get_secret_value()
    assert crypto._vault_key() != derived
    assert crypto.decrypt(crypto.encrypt(SECRET)) == SECRET


def test_the_derived_key_is_stable_for_one_pepper() -> None:
    assert crypto._vault_key() == crypto._vault_key()


def _other_key() -> SecretStr:
    return SecretStr(Fernet.generate_key().decode())

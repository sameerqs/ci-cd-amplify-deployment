"""Encryption for the one secret this service must be able to read back.

Everything else here is hashed: a magic-link token and a session handle are
only ever compared against, so only their SHA-256 is stored and a database
dump yields nothing. A Cognito refresh token cannot work that way -- it has to
be replayed to Cognito verbatim -- so it is encrypted instead, with a key that
lives in the environment and never in Postgres.
"""

from base64 import urlsafe_b64encode
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

VAULT_INFO = b"pet2text.session-vault.v1"


class VaultError(Exception):
    """A stored secret could not be read back: wrong key, or a corrupt row."""


def _vault_key() -> str:
    configured = settings.SESSION_ENCRYPTION_KEY
    if configured is not None:
        return configured.get_secret_value()
    # why: derived, not defaulted. HKDF with a purpose label gives the vault its
    # own key from a secret the app already requires and already validates, so
    # there is no second secret to forget in a deployment -- and the derived key
    # is useless for anything but this. Set SESSION_ENCRYPTION_KEY to rotate the
    # vault independently of PEPPER_SECRET.
    derived = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=VAULT_INFO).derive(
        settings.PEPPER_SECRET.get_secret_value().encode("utf-8")
    )
    return urlsafe_b64encode(derived).decode("ascii")


@lru_cache(maxsize=4)
def _cipher(key: str) -> Fernet:
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _cipher(_vault_key()).encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    try:
        return _cipher(_vault_key()).decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise VaultError("Stored session secret could not be decrypted") from exc

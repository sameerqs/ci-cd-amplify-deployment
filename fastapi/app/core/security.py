import hashlib
import secrets


def new_opaque_token() -> str:
    """A session handle or a magic-link token: 32 bytes of entropy, hex-encoded.

    These are never stored as written -- only `sha256_hex` of them is -- so the
    value returned here is the only copy that ever exists outside the caller.
    """
    return secrets.token_hex(32)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

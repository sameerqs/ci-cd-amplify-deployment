"""What is left of security.py once Cognito owns credentials: two primitives.

Both back the same property -- a secret this service hands out is never the
secret it stores, so a database dump cannot be replayed against it.
"""

from app.core.security import new_opaque_token, sha256_hex


def test_an_opaque_token_is_32_bytes_of_entropy() -> None:
    token = new_opaque_token()

    assert len(token) == 64
    assert int(token, 16) >= 0
    assert token != new_opaque_token()


def test_the_stored_form_is_a_hash_and_differs_per_token() -> None:
    token = new_opaque_token()

    assert len(sha256_hex(token)) == 64
    assert sha256_hex(token) != token
    assert sha256_hex(token) == sha256_hex(token)
    assert sha256_hex(token) != sha256_hex(new_opaque_token())

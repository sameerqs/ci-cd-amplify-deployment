"""LangChain chat-model provider.

One place builds the model so every caller inherits the same transport, timeout,
retry and temperature policy, and so a missing key fails as a 503 instead of a
500 from deep inside a request. The client is built lazily and cached: importing this
module must not require OPENAI_API_KEY, or the test suite and every non-LLM
route would need a key to run.
"""

from collections.abc import Callable
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.errors import ServiceUnavailableError


@lru_cache(maxsize=1)
def get_chat_model() -> ChatOpenAI:
    if settings.OPENAI_API_KEY is None:
        raise ServiceUnavailableError("Language model is not configured")
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=settings.OPENAI_TEMPERATURE,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
        max_retries=settings.OPENAI_MAX_RETRIES,
        # why: pin the transport. Left unset, langchain-openai picks Chat
        # Completions or Responses from the model name and the payload shape, so
        # editing OPENAI_MODEL alone could move us between the two unannounced.
        use_responses_api=True,
        # why: retention is what makes the whole request and reply readable in
        # the OpenAI dashboard. The Responses API already defaults to it; it is
        # spelled out because it is a data-retention choice, not a tuning knob.
        store=True,
    )


ChatModelDep = Annotated[ChatOpenAI, Depends(get_chat_model)]


def get_chat_model_provider() -> Callable[[], ChatOpenAI]:
    """Hand back the factory, not the model.

    Injecting the model directly makes FastAPI build it while resolving
    dependencies, which happens *before* body validation — so a malformed
    request to an LLM route answered 503 "not configured" instead of 422.
    Deferring the call keeps validation errors honest and still lets tests
    override this dependency.
    """
    return get_chat_model


ChatModelProviderDep = Annotated[Callable[[], ChatOpenAI], Depends(get_chat_model_provider)]

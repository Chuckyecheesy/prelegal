import json
import os

from fastapi import APIRouter, HTTPException
from litellm import completion
from pydantic import BaseModel

from app.nda_fields import NDA_FIELDS

router = APIRouter()

MODEL = "openrouter/openai/gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are a friendly legal-intake assistant helping a user fill out a Mutual "
    "Non-Disclosure Agreement (NDA) through freeform conversation, asking about "
    "one or two missing fields at a time rather than listing them all at once. "
    "Don't ask about fields already captured. Once every field is captured, tell "
    "the user they're all set and can review the document.\n\n"
    "Fields to collect:\n"
    + "\n".join(f"- {key}: {desc}" for key, desc in NDA_FIELDS.items())
    + "\n\nRespond with ONLY a JSON object of the form "
    '{"reply": "<your conversational reply>", "fields": {"<field key>": "<value>"}} '
    '— include in "fields" every field you can confidently extract from the '
    "conversation so far (both newly learned this turn and already-known ones), "
    "using the exact field keys above. Omit any field you don't know yet. Do not "
    "include any text outside the JSON object."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    fields: dict[str, str] = {}


class ChatResponse(BaseModel):
    reply: str
    fields: dict[str, str]


@router.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(
            status_code=500, detail="OPENROUTER_API_KEY is not configured"
        )

    known_fields = (
        ", ".join(f"{k}={v}" for k, v in request.fields.items() if v) or "none yet"
    )
    system_message = {
        "role": "system",
        "content": f"{SYSTEM_PROMPT}\n\nFields captured so far: {known_fields}",
    }
    messages = [system_message] + [m.model_dump() for m in request.messages]

    try:
        response = completion(
            model=MODEL,
            messages=messages,
            extra_body={"provider": {"only": ["Cerebras"]}},
        )
        content = response.choices[0].message.content
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"LLM request failed: {exc}"
        ) from exc

    try:
        parsed = json.loads(content)
        reply = str(parsed.get("reply", ""))
        fields = {
            k: str(v) for k, v in parsed.get("fields", {}).items() if k in NDA_FIELDS and v
        }
    except (json.JSONDecodeError, TypeError, AttributeError):
        reply = content or ""
        fields = {}

    return ChatResponse(reply=reply, fields=fields)

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from litellm import completion
from pydantic import BaseModel

from app.nda_fields import NDA_DOCUMENT_TYPE, NDA_FIELDS

router = APIRouter()

MODEL = "openrouter/openai/gpt-oss-120b"

CATALOG_PATH = Path(__file__).resolve().parent.parent.parent / "catalog.json"
_catalog = json.loads(CATALOG_PATH.read_text())
OTHER_CATALOG_NAMES = [
    entry["name"] for entry in _catalog if entry["name"] != NDA_DOCUMENT_TYPE
]

SYSTEM_PROMPT = (
    "You are a friendly legal-intake assistant that helps a user draft a legal "
    f"document through freeform conversation. Right now you can only draft one "
    f"document type: the {NDA_DOCUMENT_TYPE} (a Mutual NDA). You cannot draft any "
    "other document, including these catalog document types the user might ask "
    "about: " + ", ".join(OTHER_CATALOG_NAMES) + ", or anything else outside that "
    "list.\n\n"
    "If the user asks for, or describes a need best met by, anything other than a "
    f"Mutual NDA, do NOT start collecting NDA fields. Instead, clearly explain you "
    "can't generate that document yet, and offer the Mutual NDA as the closest "
    "document you can generate — then ask whether they'd like to proceed with an "
    "NDA instead. Only start collecting NDA fields once the user has confirmed "
    "they want a Mutual NDA (either because that's what they originally asked for, "
    "or because they agreed to your NDA suggestion).\n\n"
    "Once collecting NDA fields, ask about one or two missing fields at a time "
    "rather than listing them all at once, and don't ask about fields already "
    "captured. Once every field is captured, tell the user they're all set and can "
    "review the document.\n\n"
    "Fields to collect:\n"
    + "\n".join(f"- {key}: {desc}" for key, desc in NDA_FIELDS.items())
    + "\n\nCRITICAL — every reply must move the conversation forward: whenever you "
    "still need something from the user (which document they want, confirmation "
    "they want an NDA instead, or any missing NDA field), your \"reply\" MUST end "
    "with a direct question asking for exactly that. Never reply with only an "
    "acknowledgement (e.g. \"Great, thanks!\") while anything is still missing — "
    "always ask a concrete follow-up question in the same reply.\n\n"
    "Respond with ONLY a JSON object of the form "
    '{"reply": "<your conversational reply>", "fields": {"<field key>": "<value>"}} '
    '— include in "fields" every field you can confidently extract from the '
    "conversation so far (both newly learned this turn and already-known ones), "
    "using the exact field keys above. Omit any field you don't know yet, and "
    "leave \"fields\" empty until the user has confirmed they want a Mutual NDA. "
    "Field values MUST be copied verbatim from the user's own messages — exact "
    "wording, spelling, capitalization, and punctuation, character for character. "
    "Never paraphrase, correct, expand, reformat, or normalize a value (e.g. do "
    "not fix casing, spell out abbreviations, or reword an address). If the user "
    "restates or corrects a field, use their newest exact wording. Do not include "
    "any text outside the JSON object."
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

import json
from types import SimpleNamespace

import app.chat as chat_module
from fastapi.testclient import TestClient

from app.main import app


def _fake_completion(content: str):
    def _completion(**kwargs):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    return _completion


def test_chat_returns_reply_and_filtered_fields(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        chat_module,
        "completion",
        _fake_completion(
            json.dumps(
                {
                    "reply": "Got it, what's Party A's address?",
                    "fields": {"partyAName": "Acme Corp.", "notARealField": "x"},
                }
            )
        ),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "Acme Corp."}], "fields": {}},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Got it, what's Party A's address?"
    assert body["fields"] == {"partyAName": "Acme Corp."}


def test_chat_missing_api_key_returns_500(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with TestClient(app) as client:
        response = client.post("/api/chat", json={"messages": [], "fields": {}})

    assert response.status_code == 500


def test_chat_malformed_llm_json_falls_back_to_raw_reply(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(chat_module, "completion", _fake_completion("not json"))

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "not json"
    assert body["fields"] == {}


def test_chat_llm_failure_returns_502(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def _raise(**kwargs):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(chat_module, "completion", _raise)

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
        )

    assert response.status_code == 502


def test_system_prompt_lists_unsupported_catalog_documents():
    for name in chat_module.OTHER_CATALOG_NAMES:
        assert name in chat_module.SYSTEM_PROMPT
    assert "Cloud Service Agreement" in chat_module.SYSTEM_PROMPT


def test_system_prompt_requires_offering_nda_alternative():
    prompt = chat_module.SYSTEM_PROMPT
    assert "closest document you can generate" in prompt
    assert "do NOT start collecting NDA fields" in prompt


def test_system_prompt_requires_follow_up_question_when_incomplete():
    prompt = chat_module.SYSTEM_PROMPT
    assert "MUST end" in prompt
    assert "Never reply with only an acknowledgement" in prompt


def test_chat_sends_system_prompt_to_llm(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured = {}

    def _completion(**kwargs):
        captured["messages"] = kwargs["messages"]
        message = SimpleNamespace(
            content=json.dumps({"reply": "What document do you need?", "fields": {}})
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    monkeypatch.setattr(chat_module, "completion", _completion)

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={
                "messages": [{"role": "user", "content": "I need a DPA"}],
                "fields": {},
            },
        )

    assert response.status_code == 200
    system_message = captured["messages"][0]
    assert system_message["role"] == "system"
    assert chat_module.SYSTEM_PROMPT in system_message["content"]

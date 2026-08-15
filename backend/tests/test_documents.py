from fastapi.testclient import TestClient

from app.main import app

SAMPLE_FIELDS = {
    "partyAName": "Acme Corp.",
    "partyBName": "Beta LLC",
    "partyAAddress": "1 Main St",
}


def _signup(client: TestClient, email: str = "alice@example.com") -> None:
    client.post(
        "/api/auth/signup", json={"email": email, "password": "hunter2pass"}
    )


def test_save_document_requires_auth():
    with TestClient(app) as client:
        response = client.post("/api/documents", json={"fields": SAMPLE_FIELDS})

    assert response.status_code == 401


def test_save_document_persists_and_returns_it():
    with TestClient(app) as client:
        _signup(client)
        response = client.post("/api/documents", json={"fields": SAMPLE_FIELDS})

    assert response.status_code == 200
    body = response.json()
    assert body["party_a_name"] == "Acme Corp."
    assert body["party_b_name"] == "Beta LLC"
    assert body["fields"] == SAMPLE_FIELDS


def test_list_documents_returns_only_current_users_documents():
    with TestClient(app) as client:
        _signup(client, "alice@example.com")
        client.post("/api/documents", json={"fields": SAMPLE_FIELDS})
        client.post("/api/auth/logout")

        _signup(client, "bob@example.com")
        list_response = client.get("/api/documents")

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_list_documents_returns_saved_documents_newest_first():
    with TestClient(app) as client:
        _signup(client)
        client.post(
            "/api/documents",
            json={"fields": {**SAMPLE_FIELDS, "partyAName": "First Co."}},
        )
        client.post(
            "/api/documents",
            json={"fields": {**SAMPLE_FIELDS, "partyAName": "Second Co."}},
        )
        response = client.get("/api/documents")

    assert response.status_code == 200
    names = [doc["party_a_name"] for doc in response.json()]
    assert names == ["Second Co.", "First Co."]


def test_get_document_returns_full_fields():
    with TestClient(app) as client:
        _signup(client)
        save_response = client.post(
            "/api/documents", json={"fields": SAMPLE_FIELDS}
        )
        doc_id = save_response.json()["id"]
        response = client.get(f"/api/documents/{doc_id}")

    assert response.status_code == 200
    assert response.json()["fields"] == SAMPLE_FIELDS


def test_get_document_not_owned_by_user_returns_404():
    with TestClient(app) as client:
        _signup(client, "alice@example.com")
        save_response = client.post(
            "/api/documents", json={"fields": SAMPLE_FIELDS}
        )
        doc_id = save_response.json()["id"]
        client.post("/api/auth/logout")

        _signup(client, "bob@example.com")
        response = client.get(f"/api/documents/{doc_id}")

    assert response.status_code == 404

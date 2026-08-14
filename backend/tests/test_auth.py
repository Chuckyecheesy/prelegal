from fastapi.testclient import TestClient

from app.main import app


def test_signup_creates_user_and_sets_session_cookie():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/signup",
            json={"email": "alice@example.com", "password": "hunter2pass"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert "session_token" in response.cookies


def test_signup_duplicate_email_returns_409():
    with TestClient(app) as client:
        client.post(
            "/api/auth/signup",
            json={"email": "alice@example.com", "password": "hunter2pass"},
        )
        response = client.post(
            "/api/auth/signup",
            json={"email": "alice@example.com", "password": "otherpass"},
        )

    assert response.status_code == 409


def test_login_with_correct_credentials_succeeds():
    with TestClient(app) as client:
        client.post(
            "/api/auth/signup",
            json={"email": "bob@example.com", "password": "hunter2pass"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "bob@example.com", "password": "hunter2pass"},
        )

    assert response.status_code == 200
    assert response.json()["email"] == "bob@example.com"


def test_login_with_wrong_password_returns_401():
    with TestClient(app) as client:
        client.post(
            "/api/auth/signup",
            json={"email": "bob@example.com", "password": "hunter2pass"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "bob@example.com", "password": "wrongpass"},
        )

    assert response.status_code == 401


def test_login_with_unknown_email_returns_401():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "whatever"},
        )

    assert response.status_code == 401


def test_me_without_session_returns_401():
    with TestClient(app) as client:
        response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_with_session_returns_current_user():
    with TestClient(app) as client:
        client.post(
            "/api/auth/signup",
            json={"email": "carol@example.com", "password": "hunter2pass"},
        )
        response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "carol@example.com"


def test_logout_clears_session():
    with TestClient(app) as client:
        client.post(
            "/api/auth/signup",
            json={"email": "dave@example.com", "password": "hunter2pass"},
        )
        logout_response = client.post("/api/auth/logout")
        me_response = client.get("/api/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401

import secrets
import sqlite3

import bcrypt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr

from app.db import get_connection

router = APIRouter(prefix="/api/auth")

SESSION_COOKIE = "session_token"


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str


def _create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id)
    )
    conn.commit()
    return token


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
    )


def get_current_user(session_token: str | None = Cookie(default=None)) -> UserResponse:
    if not session_token:
        raise HTTPException(status_code=401, detail="Not signed in")

    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT users.id, users.email
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (session_token,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=401, detail="Not signed in")

    return UserResponse(id=row["id"], email=row["email"])


@router.post("/signup", response_model=UserResponse)
def signup(request: SignupRequest, response: Response) -> UserResponse:
    password_hash = bcrypt.hashpw(
        request.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    conn = get_connection()
    try:
        try:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (request.email, password_hash),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = cursor.lastrowid
        token = _create_session(conn, user_id)
    finally:
        conn.close()

    _set_session_cookie(response, token)
    return UserResponse(id=user_id, email=request.email)


@router.post("/login", response_model=UserResponse)
def login(request: LoginRequest, response: Response) -> UserResponse:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (request.email,),
        ).fetchone()

        if row is None or not bcrypt.checkpw(
            request.password.encode("utf-8"), row["password_hash"].encode("utf-8")
        ):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = _create_session(conn, row["id"])
    finally:
        conn.close()

    _set_session_cookie(response, token)
    return UserResponse(id=row["id"], email=row["email"])


@router.post("/logout")
def logout(
    response: Response, session_token: str | None = Cookie(default=None)
) -> dict[str, str]:
    if session_token:
        conn = get_connection()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
            conn.commit()
        finally:
            conn.close()

    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"status": "ok"}


@router.get("/me", response_model=UserResponse)
def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user

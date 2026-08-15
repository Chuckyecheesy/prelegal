import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import UserResponse, get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/documents")


class SaveDocumentRequest(BaseModel):
    fields: dict[str, str]


class DocumentSummary(BaseModel):
    id: int
    party_a_name: str
    party_b_name: str
    created_at: str


class DocumentDetail(DocumentSummary):
    fields: dict[str, str]


@router.post("", response_model=DocumentDetail)
def save_document(
    request: SaveDocumentRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> DocumentDetail:
    party_a_name = request.fields.get("partyAName", "")
    party_b_name = request.fields.get("partyBName", "")

    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO documents (user_id, party_a_name, party_b_name, fields_json)
            VALUES (?, ?, ?, ?)
            """,
            (current_user.id, party_a_name, party_b_name, json.dumps(request.fields)),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, party_a_name, party_b_name, fields_json, created_at "
            "FROM documents WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    finally:
        conn.close()

    return DocumentDetail(
        id=row["id"],
        party_a_name=row["party_a_name"],
        party_b_name=row["party_b_name"],
        created_at=row["created_at"],
        fields=json.loads(row["fields_json"]),
    )


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    current_user: UserResponse = Depends(get_current_user),
) -> list[DocumentSummary]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, party_a_name, party_b_name, created_at
            FROM documents
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (current_user.id,),
        ).fetchall()
    finally:
        conn.close()

    return [
        DocumentSummary(
            id=row["id"],
            party_a_name=row["party_a_name"],
            party_b_name=row["party_b_name"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> DocumentDetail:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT id, party_a_name, party_b_name, fields_json, created_at
            FROM documents
            WHERE id = ? AND user_id = ?
            """,
            (document_id, current_user.id),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDetail(
        id=row["id"],
        party_a_name=row["party_a_name"],
        party_b_name=row["party_b_name"],
        created_at=row["created_at"],
        fields=json.loads(row["fields_json"]),
    )

"""Binary blob storage service.

Uses the SQL database table `blobs` for the MVP so it works out-of-the-box on ephemeral hosting
(Render, Docker) without needing external S3 configuration initially. Can be swapped for an
S3/R2 client later without changing the rest of the application.
"""

from sqlalchemy.orm import Session

from ..models import Blob


def save_blob(db: Session, data: bytes, content_type: str) -> str:
    blob = Blob(content_type=content_type, size=len(data), data=data)
    db.add(blob)
    db.flush()
    return blob.id


def get_blob(db: Session, blob_id: str) -> Blob | None:
    return db.query(Blob).filter(Blob.id == blob_id).first()


def delete_blob(db: Session, blob_id: str) -> bool:
    blob = db.query(Blob).filter(Blob.id == blob_id).first()
    if blob:
        db.delete(blob)
        return True
    return False

"""ORM models.

Geometry for each sheet is stored as a single JSON document (walls / rooms / openings in sheet
pixel coordinates). This keeps editor saves atomic and undo/redo trivial on the client, and is
plenty for MVP-scale drawings.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Blob(Base):
    """Binary storage (uploaded drawings, rendered sheet images).

    Kept in the database for the MVP because Render's filesystem is ephemeral. The storage
    module hides this so it can move to S3/R2 later without touching callers.
    """

    __tablename__ = "blobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200))
    client: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    specs: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    drawings: Mapped[list["Drawing"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Drawing.created_at"
    )
    sheets: Mapped[list["Sheet"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Sheet.position"
    )
    boqs: Mapped[list["Boq"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Boq.created_at.desc()"
    )
    raw_takeoffs: Mapped[list["RawTakeoff"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="RawTakeoff.created_at.desc()"
    )


class Drawing(Base):
    __tablename__ = "drawings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(100))
    blob_id: Mapped[str] = mapped_column(ForeignKey("blobs.id"))
    page_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    project: Mapped[Project] = relationship(back_populates="drawings")
    sheets: Mapped[list["Sheet"]] = relationship(back_populates="drawing", cascade="all, delete-orphan")


class Sheet(Base):
    """One page of a drawing, rendered to an image the user takes off from."""

    __tablename__ = "sheets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    drawing_id: Mapped[str] = mapped_column(ForeignKey("drawings.id", ondelete="CASCADE"), index=True)
    page_index: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(200))

    # Rendered image
    image_blob_id: Mapped[str] = mapped_column(ForeignKey("blobs.id"))
    width_px: Mapped[int] = mapped_column(Integer)
    height_px: Mapped[int] = mapped_column(Integer)
    # DPI the page was rendered at (None for raster uploads, where it is unknown).
    render_dpi: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_vector: Mapped[bool] = mapped_column(Boolean, default=False)

    # Scale: metres per image pixel. None until calibrated.
    scale_m_per_px: Mapped[float | None] = mapped_column(Float, nullable=True)
    calibration: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Takeoff role
    include: Mapped[bool] = mapped_column(Boolean, default=True)
    has_substructure: Mapped[bool] = mapped_column(Boolean, default=True)
    has_roof: Mapped[bool] = mapped_column(Boolean, default=True)

    geometry: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped[Project] = relationship(back_populates="sheets")
    drawing: Mapped[Drawing] = relationship(back_populates="sheets")


class Boq(Base):
    """Elemental Bill of Quantities built according to NIQS BESMM4."""

    __tablename__ = "boqs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(250), default="Bill of Quantities")
    currency: Mapped[str] = mapped_column(String(10), default="NGN")
    currency_symbol: Mapped[str] = mapped_column(String(5), default="₦")
    rounding_rule: Mapped[str] = mapped_column(String(30), default="besmm4_whole")
    # Structured list of bills (Bill 1 to Bill 6) with items
    bills: Mapped[list] = mapped_column(JSON, default=list)
    # Grand summary (Contingency, VAT 7.5%, Overheads & Profit, totals)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped[Project] = relationship(back_populates="boqs")


class RawTakeoff(Base):
    """Traditional Quantity Surveyor dimension-sheet taking off records."""

    __tablename__ = "raw_takeoffs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Raw Dimension Sheet")
    # List of dimension sheet rows: timesing, dim1, dim2, dim3, squaring, description, unit, bill_category
    rows: Mapped[list] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped[Project] = relationship(back_populates="raw_takeoffs")


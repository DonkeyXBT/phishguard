import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    api_key = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship("User", back_populates="organization")
    reports = relationship("EmailReport", back_populates="organization")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    organization = relationship("Organization", back_populates="users")
    actions = relationship("AdminAction", back_populates="admin")


class EmailReport(Base):
    __tablename__ = "email_reports"
    id = Column(String, primary_key=True, default=gen_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    reporter_email = Column(String, nullable=False)
    recipient_email = Column(String)
    subject = Column(String)
    sender = Column(String)
    sender_domain = Column(String)
    reply_to = Column(String)
    email_body_text = Column(Text)
    email_body_html = Column(Text)
    headers = Column(JSON, default={})
    risk_score = Column(Integer, default=0)
    risk_level = Column(String, default="low")  # low / medium / high / critical
    signals = Column(JSON, default=[])
    status = Column(String, default="pending")  # pending / released / deleted / false_positive
    source = Column(String, default="user_report")  # user_report / auto_scan
    reported_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    organization = relationship("Organization", back_populates="reports")
    links = relationship("EmailLink", back_populates="report", cascade="all, delete")
    attachments = relationship("EmailAttachment", back_populates="report", cascade="all, delete")
    actions = relationship("AdminAction", back_populates="report", cascade="all, delete")


class EmailLink(Base):
    __tablename__ = "email_links"
    id = Column(String, primary_key=True, default=gen_uuid)
    report_id = Column(String, ForeignKey("email_reports.id"), nullable=False)
    display_text = Column(String)
    url = Column(String)
    final_url = Column(String)
    domain = Column(String)
    is_suspicious = Column(Boolean, default=False)
    risk_reason = Column(String)
    report = relationship("EmailReport", back_populates="links")


class EmailAttachment(Base):
    __tablename__ = "email_attachments"
    id = Column(String, primary_key=True, default=gen_uuid)
    report_id = Column(String, ForeignKey("email_reports.id"), nullable=False)
    filename = Column(String)
    content_type = Column(String)
    file_size = Column(Integer)
    is_suspicious = Column(Boolean, default=False)
    risk_reason = Column(String)
    report = relationship("EmailReport", back_populates="attachments")


class AdminAction(Base):
    __tablename__ = "admin_actions"
    id = Column(String, primary_key=True, default=gen_uuid)
    report_id = Column(String, ForeignKey("email_reports.id"), nullable=False)
    admin_id = Column(String, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)  # released / deleted / false_positive / escalated
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    report = relationship("EmailReport", back_populates="actions")
    admin = relationship("User", back_populates="actions")

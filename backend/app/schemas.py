from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_admin: bool
    org_id: str

    class Config:
        from_attributes = True


class EmailLinkSchema(BaseModel):
    id: str
    display_text: Optional[str]
    url: Optional[str]
    final_url: Optional[str]
    domain: Optional[str]
    is_suspicious: bool
    risk_reason: Optional[str]

    class Config:
        from_attributes = True


class EmailAttachmentSchema(BaseModel):
    id: str
    filename: Optional[str]
    content_type: Optional[str]
    file_size: Optional[int]
    is_suspicious: bool
    risk_reason: Optional[str]

    class Config:
        from_attributes = True


class AdminActionSchema(BaseModel):
    id: str
    action: str
    notes: Optional[str]
    created_at: datetime
    admin_id: str

    class Config:
        from_attributes = True


class EmailReportCreate(BaseModel):
    reporter_email: str
    recipient_email: Optional[str] = None
    subject: Optional[str] = None
    sender: Optional[str] = None
    reply_to: Optional[str] = None
    email_body_text: Optional[str] = None
    email_body_html: Optional[str] = None
    headers: Optional[dict] = {}
    attachments: Optional[List[dict]] = []
    source: Optional[str] = "user_report"


class EmailReportResponse(BaseModel):
    id: str
    reporter_email: str
    recipient_email: Optional[str]
    subject: Optional[str]
    sender: Optional[str]
    sender_domain: Optional[str]
    reply_to: Optional[str]
    email_body_text: Optional[str]
    email_body_html: Optional[str]
    risk_score: int
    risk_level: str
    signals: List[Any]
    status: str
    source: str
    reported_at: datetime
    reviewed_at: Optional[datetime]
    admin_notes: Optional[str]
    links: List[EmailLinkSchema] = []
    attachments: List[EmailAttachmentSchema] = []
    actions: List[AdminActionSchema] = []

    class Config:
        from_attributes = True


class EmailReportSummary(BaseModel):
    id: str
    reporter_email: str
    subject: Optional[str]
    sender: Optional[str]
    risk_score: int
    risk_level: str
    status: str
    reported_at: datetime
    source: str

    class Config:
        from_attributes = True


class AdminReviewAction(BaseModel):
    action: str  # released / deleted / false_positive / escalated
    notes: Optional[str] = None


class AnalyzeEmailRequest(BaseModel):
    sender: Optional[str] = None
    reply_to: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    headers: Optional[dict] = {}
    attachments: Optional[List[dict]] = []


class AnalyzeEmailResponse(BaseModel):
    risk_score: int
    risk_level: str
    signals: List[dict]
    summary: str


class DashboardStats(BaseModel):
    total_reports: int
    pending_review: int
    released_today: int
    deleted_today: int
    high_risk_count: int
    avg_risk_score: float

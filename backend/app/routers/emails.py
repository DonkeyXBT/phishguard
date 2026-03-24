from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models import EmailReport, EmailLink, EmailAttachment
from ..schemas import EmailReportCreate, EmailReportResponse, AnalyzeEmailRequest, AnalyzeEmailResponse
from ..analyzer.engine import analyze_email, extract_domain
from ..auth import get_api_key_org
import uuid

router = APIRouter(prefix="/api/emails", tags=["emails"])


@router.post("/analyze", response_model=AnalyzeEmailResponse)
def analyze_only(request: AnalyzeEmailRequest, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Analyze an email and return a risk score without storing it."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    org = get_api_key_org(x_api_key, db)
    if not org:
        raise HTTPException(status_code=401, detail="Invalid API key")

    result = analyze_email(
        sender=request.sender,
        reply_to=request.reply_to,
        subject=request.subject,
        body_text=request.body_text,
        body_html=request.body_html,
        headers=request.headers,
        attachments=request.attachments,
    )
    return AnalyzeEmailResponse(
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        signals=result["signals"],
        summary=result["summary"],
    )


@router.post("/report", response_model=EmailReportResponse)
def report_email(payload: EmailReportCreate, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Submit a reported email for admin review."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    org = get_api_key_org(x_api_key, db)
    if not org:
        raise HTTPException(status_code=401, detail="Invalid API key")

    result = analyze_email(
        sender=payload.sender,
        reply_to=payload.reply_to,
        subject=payload.subject,
        body_text=payload.email_body_text,
        body_html=payload.email_body_html,
        headers=payload.headers,
        attachments=payload.attachments,
    )

    sender_domain = extract_domain(payload.sender) if payload.sender else None
    report = EmailReport(
        id=str(uuid.uuid4()),
        org_id=org.id,
        reporter_email=payload.reporter_email,
        recipient_email=payload.recipient_email,
        subject=payload.subject,
        sender=payload.sender,
        sender_domain=sender_domain,
        reply_to=payload.reply_to,
        email_body_text=payload.email_body_text,
        email_body_html=payload.email_body_html,
        headers=payload.headers,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        signals=result["signals"],
        source=payload.source,
        status="pending",
    )
    db.add(report)

    for link in result.get("links", []):
        db.add(EmailLink(
            id=str(uuid.uuid4()),
            report_id=report.id,
            display_text=link.get("display"),
            url=link.get("url"),
            domain=link.get("domain"),
            is_suspicious=link.get("is_suspicious", False),
            risk_reason=link.get("risk_reason"),
        ))

    for att in result.get("attachments", []):
        db.add(EmailAttachment(
            id=str(uuid.uuid4()),
            report_id=report.id,
            filename=att.get("filename"),
            content_type=att.get("content_type"),
            is_suspicious=att.get("is_suspicious", False),
            risk_reason=att.get("risk_reason"),
        ))

    db.commit()
    db.refresh(report)
    return report

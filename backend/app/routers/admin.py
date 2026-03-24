from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, date
from typing import List, Optional
from ..database import get_db
from ..models import User, EmailReport, AdminAction
from ..schemas import EmailReportResponse, EmailReportSummary, AdminReviewAction, DashboardStats, UserResponse
from ..auth import get_current_admin, get_password_hash
import uuid

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    today = date.today()
    total = db.query(EmailReport).filter(EmailReport.org_id == admin.org_id).count()
    pending = db.query(EmailReport).filter(EmailReport.org_id == admin.org_id, EmailReport.status == "pending").count()
    released_today = db.query(EmailReport).filter(
        EmailReport.org_id == admin.org_id,
        EmailReport.status == "released",
        cast(EmailReport.reviewed_at, Date) == today
    ).count()
    deleted_today = db.query(EmailReport).filter(
        EmailReport.org_id == admin.org_id,
        EmailReport.status == "deleted",
        cast(EmailReport.reviewed_at, Date) == today
    ).count()
    high_risk = db.query(EmailReport).filter(
        EmailReport.org_id == admin.org_id,
        EmailReport.risk_level.in_(["high", "critical"])
    ).count()
    avg_score = db.query(func.avg(EmailReport.risk_score)).filter(EmailReport.org_id == admin.org_id).scalar() or 0.0
    return DashboardStats(
        total_reports=total,
        pending_review=pending,
        released_today=released_today,
        deleted_today=deleted_today,
        high_risk_count=high_risk,
        avg_risk_score=round(float(avg_score), 1),
    )


@router.get("/queue", response_model=List[EmailReportSummary])
def get_queue(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    q = db.query(EmailReport).filter(EmailReport.org_id == admin.org_id)
    if status:
        q = q.filter(EmailReport.status == status)
    if risk_level:
        q = q.filter(EmailReport.risk_level == risk_level)
    q = q.order_by(EmailReport.reported_at.desc())
    return q.offset(offset).limit(limit).all()


@router.get("/reports/{report_id}", response_model=EmailReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    report = db.query(EmailReport).filter(EmailReport.id == report_id, EmailReport.org_id == admin.org_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.put("/reports/{report_id}/review")
def review_report(
    report_id: str,
    body: AdminReviewAction,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    report = db.query(EmailReport).filter(EmailReport.id == report_id, EmailReport.org_id == admin.org_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    valid_actions = {"released", "deleted", "false_positive", "escalated"}
    if body.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")

    report.status = body.action
    report.reviewed_at = datetime.utcnow()
    report.reviewed_by = admin.id
    report.admin_notes = body.notes

    action = AdminAction(
        id=str(uuid.uuid4()),
        report_id=report.id,
        admin_id=admin.id,
        action=body.action,
        notes=body.notes,
    )
    db.add(action)
    db.commit()
    return {"message": f"Report marked as {body.action}", "report_id": report_id}


@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(User).filter(User.org_id == admin.org_id).all()


@router.post("/users")
def create_user(
    email: str,
    password: str,
    full_name: Optional[str] = None,
    is_admin: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        id=str(uuid.uuid4()),
        org_id=admin.org_id,
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    return {"message": "User created", "id": user.id}

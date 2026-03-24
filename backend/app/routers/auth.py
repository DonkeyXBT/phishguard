from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import verify_password, create_access_token, get_password_hash
from ..models import User, Organization
from ..schemas import Token, UserLogin, UserResponse
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(db: Session = Depends(get_db), current_user: User = Depends(lambda: None)):
    from ..auth import get_current_user
    from fastapi import Request
    return current_user


@router.post("/setup")
def initial_setup(db: Session = Depends(get_db)):
    """Create default organization and admin user if none exist."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup already complete")
    org = Organization(
        id=str(uuid.uuid4()),
        name="Default Organization",
        api_key=str(uuid.uuid4()).replace("-", "")
    )
    db.add(org)
    from ..auth import get_password_hash
    admin = User(
        id=str(uuid.uuid4()),
        org_id=org.id,
        email="admin@company.com",
        hashed_password=get_password_hash("admin123"),
        full_name="System Administrator",
        is_admin=True
    )
    db.add(admin)
    db.commit()
    return {"message": "Setup complete", "email": "admin@company.com", "password": "admin123", "api_key": org.api_key}

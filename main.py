# Câu lệnh để chạy server FastAPI: py -m uvicorn main:app --reload
import os
import shutil
import csv
import io
import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Query, Request, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from sqlalchemy.orm import Session
import models, schemas
from database import engine, get_db, SessionLocal

# Tạo lại tất cả các bảng trong database (Dành cho việc học/demo, thực tế dùng migrations)
models.Base.metadata.create_all(bind=engine)

# Khởi tạo ứng dụng FastAPI
app = FastAPI(title="Lost & Found Management System")

# Đảm bảo các thư mục cần thiết (uploads, exports) tồn tại
os.makedirs("uploads", exist_ok=True)
os.makedirs("exports", exist_ok=True)

# Mount các thư mục tĩnh để truy cập thông qua URL (ví dụ: đường dẫn /static/, /uploads/)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Khởi tạo Jinja2Templates để render giao diện HTML trong thư mục 'templates'
templates = Jinja2Templates(directory="templates")

async def auto_expire_items():
    """Chạy ngầm liên tục để kiểm tra và tự động cập nhật đồ vật hết hạn sang trạng thái 'completed'"""
    while True:
        db = SessionLocal()
        try:
            today = datetime.now().date()
            # Cập nhật đồ vật có ngày hết hạn < ngày hiện tại
            expired_items = db.query(models.Item).filter(
                models.Item.status.in_(["lost", "found", "verifying"]),
                models.Item.expiry_date != None,
                models.Item.expiry_date < today
            ).all()
            
            for item in expired_items:
                item.status = "completed"
                
            if expired_items:
                db.commit()
        except Exception as e:
            print(f"Lỗi khi cập nhật đồ vật hết hạn: {e}")
        finally:
            db.close()
        
        # Đợi 1 giờ (3600 giây) rồi kiểm tra lại
        await asyncio.sleep(3600)

# Chạy một lần khi khởi động: Thiết lập dữ liệu khởi tạo, kiểm tra và tạo tài khoản Admin mặc định
@app.on_event("startup")
def create_admin_if_not_exists():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin_user = models.User(
            username="admin",
            password="123456",
            full_name="System Administrator",
            phone="000-000-0000",
            role="admin"
        )
        db.add(admin_user)
        db.commit()
    db.close()
    
    # Khởi động task ngầm tự động
    asyncio.create_task(auto_expire_items())

# --- API Xác thực (Auth Endpoints) ---

# API Đăng ký tài khoản người dùng
@app.post("/api/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã được đăng ký")
    
    new_user = models.User(
        username=user.username,
        password=user.password, # Plain text for study/demo
        full_name=user.full_name,
        phone=user.phone,
        secondary_contact=user.secondary_contact,
        role="guest"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# API Đăng nhập
@app.post("/api/login", response_model=schemas.UserResponse)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username, models.User.password == user.password).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Thông tin đăng nhập không hợp lệ")
    return db_user

# API Cập nhật thông tin hồ sơ (profile) của người dùng
@app.put("/api/users/{user_id}/profile", response_model=schemas.UserResponse)
def update_profile(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.phone is not None:
        db_user.phone = user_update.phone
    if user_update.secondary_contact is not None:
        db_user.secondary_contact = user_update.secondary_contact
    if user_update.password:
        db_user.password = user_update.password

    db.commit()
    db.refresh(db_user)
    return db_user


# --- API Quản lý Đồ vật (Item Endpoints) ---

# Giao diện chính (Trả về trang index.html)
@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# API Lấy danh sách đồ vật cùng với các bộ lọc (filter)
@app.get("/api/items", response_model=List[schemas.ItemResponse])
def read_items(
    description: Optional[str] = None,
    identifier: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user_id: Optional[int] = None,
    filter_role: Optional[str] = None, # 'finder' or 'loser'
    db: Session = Depends(get_db)
):
    query = db.query(models.Item)
    if description:
        query = query.filter(models.Item.description.ilike(f"%{description}%") | models.Item.title.ilike(f"%{description}%"))
    if identifier:
        query = query.filter(models.Item.identifier.ilike(f"%{identifier}%"))
    if status:
        query = query.filter(models.Item.status == status)
    if date_from:
        query = query.filter(models.Item.incident_date >= datetime.strptime(date_from, "%Y-%m-%d").date())
    if date_to:
        query = query.filter(models.Item.incident_date <= datetime.strptime(date_to, "%Y-%m-%d").date())
    
    if current_user_id:
        if filter_role == 'finder':
            query = query.filter(models.Item.finder_id == current_user_id)
        elif filter_role == 'loser':
            query = query.filter(models.Item.loser_id == current_user_id)
        elif filter_role == 'activity':
            query = query.filter((models.Item.finder_id == current_user_id) | (models.Item.loser_id == current_user_id))
            
    # Chặn không trả về các đồ vật đã bị lưu trữ (archived) cho màn hình chính, trừ khi đang xem lịch sử hoạt động cá nhân
    if filter_role != 'activity':
        query = query.filter(models.Item.status != 'archived')
            
    return query.all()

# API Tạo mới/Đăng thông tin đồ vật (Hỗ trợ upload hình ảnh đính kèm)
@app.post("/api/items", response_model=schemas.ItemResponse)
def create_item(
    title: str = Form(...),
    description: str = Form(...),
    status: str = Form(...),
    identifier: Optional[str] = Form(None),
    area: Optional[str] = Form(None),
    incident_date: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    finder_id: int = Form(...),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    incident_date_obj = datetime.strptime(incident_date, "%Y-%m-%d").date()
    expiry_date_obj = datetime.strptime(expiry_date, "%Y-%m-%d").date() if expiry_date else None
    
    file_path = None
    if attachment and attachment.filename:
        file_path = f"uploads/{datetime.now().strftime('%Y%m%d%H%M%S')}_{attachment.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(attachment.file, buffer)

    db_item = models.Item(
        title=title,
        description=description,
        status=status,
        identifier=identifier,
        area=area,
        incident_date=incident_date_obj,
        expiry_date=expiry_date_obj,
        attachment_path=file_path,
        finder_id=finder_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# API Yêu cầu xác nhận sở hữu đối với một đồ vật (Claim item)
@app.post("/api/items/{item_id}/claim", response_model=schemas.ItemResponse)
def claim_item(item_id: int, loser_id: int = Form(...), secret_details: str = Form(...), db: Session = Depends(get_db)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món đồ")
    if db_item.status not in ["found", "lost"]:
        raise HTTPException(status_code=400, detail="Món đồ không có sẵn để yêu cầu")
    
    db_item.status = "verifying"
    db_item.loser_id = loser_id
    db_item.secret_details = secret_details
    
    db.commit()
    db.refresh(db_item)
    return db_item

# API Xác nhận thông tin đánh mất trùng khớp, chuyển đồ vật sang trạng thái thành công
@app.post("/api/items/{item_id}/confirm", response_model=schemas.ItemResponse)
def confirm_claim(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món đồ")
    if db_item.status != "verifying":
        raise HTTPException(status_code=400, detail="Món đồ không ở trạng thái 'đang xác minh'")
    
    db_item.status = "completed"
    db.commit()
    db.refresh(db_item)
    return db_item

# API Xóa đồ vật (Chỉ dành cho Admin, cho phép xóa các dòng đã nằm ở trạng thái 'completed')
@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, user_role: str = Query(...), db: Session = Depends(get_db)):
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên mới có thể xóa bản ghi")
        
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món đồ")
    
    if db_item.status != "completed":
        raise HTTPException(status_code=400, detail="Chỉ các món đồ đã hoàn thành mới có thể bị xóa")

    # Chỉ chuyển trạng thái sang archived (lưu trữ) để ẩn khỏi Dashboard nhưng giữ trong lịch sử activity
    db_item.status = "archived"

    db.commit()
    return {"message": "Quản trị viên đã ẩn bản ghi thành công"}

# API Xuất dữ liệu ra file định dạng CSV (Chỉ dành cho Admin)
@app.get("/api/export")
def export_data(user_role: str = Query(..., description="Role of the user requesting export"), db: Session = Depends(get_db)):
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên mới có thể xuất dữ liệu")
    items = db.query(models.Item).all()
    file_path = f"exports/lost_and_found_export.csv"
    with open(file_path, mode="w", newline="", encoding="utf-8-sig") as csv_file:
        fieldnames = ["ID", "Title", "Description", "Status", "Identifier", "Area", "Incident Date", "Expiry Date", "Finder", "Loser"]
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({
                "ID": item.id,
                "Title": item.title,
                "Description": item.description,
                "Status": item.status,
                "Identifier": item.identifier or "",
                "Area": item.area or "",
                "Incident Date": item.incident_date.strftime("%Y-%m-%d") if item.incident_date else "",
                "Expiry Date": item.expiry_date.strftime("%Y-%m-%d") if item.expiry_date else "",
                "Finder": item.finder.username if item.finder else "N/A",
                "Loser": item.loser.username if item.loser else "N/A"
            })
    return FileResponse(path=file_path, filename="export.csv", media_type='text/csv')

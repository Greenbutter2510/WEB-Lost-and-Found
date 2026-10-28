from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# User Schemas - Dữ liệu liên quan đến người dùng
class UserBase(BaseModel):
    # Lớp cơ sở chứa thông tin chung của người dùng
    username: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    secondary_contact: Optional[str] = None  # Liên hệ phụ
    role: str = "guest"  # Vai trò mặc định là khách (guest)

class UserUpdate(BaseModel):
    # Schema dùng khi cập nhật thông tin người dùng
    full_name: Optional[str] = None
    phone: Optional[str] = None
    secondary_contact: Optional[str] = None
    password: Optional[str] = None

class UserCreate(UserBase):
    # Schema dùng khi tạo người dùng mới, yêu cầu mật khẩu
    password: str

class UserLogin(BaseModel):
    # Schema dùng cho chức năng đăng nhập
    username: str
    password: str

class UserResponse(UserBase):
    # Schema dùng để trả về thông tin người dùng cho client (ẩn mật khẩu)
    id: int
    class Config:
        from_attributes = True  # Cho phép ánh xạ từ SQLAlchemy model sang Pydantic

# Item Schemas - Dữ liệu liên quan đến vật phẩm thất lạc/nhặt được
class ItemBase(BaseModel):
    # Lớp cơ sở chứa các thuộc tính chung của một vật phẩm
    title: str  # Tên vật phẩm
    description: str  # Mô tả vật phẩm
    identifier: Optional[str] = None  # Đặc điểm nhận dạng
    area: Optional[str] = None  # Khu vực làm rơi/nhặt được
    incident_date: date  # Ngày xảy ra sự việc (mất/nhặt được)
    expiry_date: Optional[date] = None  # Ngày hết hạn lưu trữ (nếu có)

class ItemCreate(ItemBase):
    # Schema dùng khi báo cáo một vật phẩm mới, trạng thái mặc định là "found" (đã nhặt được)
    status: str = "found"

class ItemUpdate(BaseModel):
    # Schema dùng khi cập nhật thông tin vật phẩm
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # Trạng thái hiện tại (vd: lost, found, returned)
    identifier: Optional[str] = None
    area: Optional[str] = None
    expiry_date: Optional[date] = None
    secret_details: Optional[str] = None  # Thông tin bí mật chỉ chủ nhân thực sự mới biết
    loser_id: Optional[int] = None

class ItemResponse(ItemBase):
    # Schema dùng để phản hồi thông tin chi tiết của vật phẩm cho client
    id: int
    status: str
    attachment_path: Optional[str] = None  # Đường dẫn tới tệp/hình ảnh đính kèm
    finder_id: int  # ID của người nhặt được
    loser_id: Optional[int] = None  # ID của người làm mất (nếu đã xác nhận)
    secret_details: Optional[str] = None
    finder: Optional[UserResponse] = None  # Thông tin chi tiết của người nhặt
    loser: Optional[UserResponse] = None  # Thông tin chi tiết của người liên hệ mất

    class Config:
        from_attributes = True  # Ánh xạ tự động từ ORM SQLAlchemy

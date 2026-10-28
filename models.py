from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# Bảng users: Lưu trữ thông tin tài khoản người dùng (bao gồm Admin và Khách)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False) # Mật khẩu đang được lưu tĩnh dạng Text thường (Dành cho việc học/demo)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    secondary_contact = Column(String(200), nullable=True)
    role = Column(String(20), default="guest") # Phân quyền: admin (Quản trị), guest (Khách/Người dùng)

    # Các mối liên kết (Relationships) với bảng Item (Đồ vật)
    items_found = relationship("Item", foreign_keys="Item.finder_id", back_populates="finder")
    items_lost = relationship("Item", foreign_keys="Item.loser_id", back_populates="loser")

# Bảng items: Lưu trữ thông tin danh sách Đồ Bị Mất / Đồ Nhặt Được
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    secret_details = Column(Text, nullable=True) # Đặc điểm nhận dạng của đồ vật, được giấu kín và chỉ hiển thị trong khi xác thực sở hữu
    status = Column(String(50), nullable=False, index=True, default="found") # Các trạng thái: lost, found, verifying, completed, archived, cancel
    identifier = Column(String(100), nullable=True, index=True) # Thẻ nhận dạng / Mã Sinh Viên / Căn cước công dân
    area = Column(String(100), nullable=True)
    incident_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True) # Ngày hết hạn cất giữ đồ (Thời điểm để chuyển vào kho lưu trữ hoặc quyên góp)
    attachment_path = Column(String(255), nullable=True)

    finder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    loser_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    finder = relationship("User", foreign_keys=[finder_id], back_populates="items_found")
    loser = relationship("User", foreign_keys=[loser_id], back_populates="items_lost")

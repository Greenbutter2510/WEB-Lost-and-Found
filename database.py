from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Đường dẫn kết nối tới database (Sử dụng SQLite database tên là lost_and_found_v2.db)
SQLALCHEMY_DATABASE_URL = "sqlite:///./lost_and_found_v2.db"

# 2. Khởi tạo engine của SQLAlchemy, có cấu hình dành riêng cho SQLite để hỗ trợ đa luồng
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. Khởi tạo SessionLocal, mỗi instance từ đây sẽ đại diện cho một phiên kết nối database thao tác với CSDL
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base class dùng để khai báo các Cấu trúc bảng - models (Được kế thừa lại trong file models.py)
Base = declarative_base()

# 5. Hàm tạo Database Session, được dùng làm dependency tiêm vào cho mỗi request API của FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

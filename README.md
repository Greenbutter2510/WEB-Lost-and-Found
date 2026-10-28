# PTIT Lost and Found Management System 🔍🎒

Hệ thống Quản lý và Tìm kiếm Đồ Thất lạc trực tuyến dành cho sinh viên và cán bộ giảng viên Học viện Công nghệ Bưu chính Viễn thông (PTIT).

## 🚀 Tính năng chính

- **Xác thực & Phân quyền**: Đăng ký, đăng nhập, phân quyền Quản trị viên (`admin`) và Khách/Sinh viên (`guest`).
- **Đăng tin Mất / Nhặt được đồ**: Cho phép đính kèm ảnh, mô tả chi tiết, khu vực nhặt/mất và ngày hết hạn.
- **Quy trình xác minh bảo mật (Claim & Verify)**:
  - Người mất gửi chi tiết bí mật (mã seri, đặc điểm riêng, nội dung nhận dạng).
  - Người nhặt xem xét và phê duyệt.
  - Sau khi xác nhận hoàn tất, hệ thống tự động mở khóa thông tin liên hệ (SĐT, mạng xã hội) để hai bên kết nối trao trả.
- **Tìm kiếm & Bộ lọc nâng cao**: Lọc theo từ khóa, số phòng / mã SV, trạng thái (`lost`, `found`, `verifying`, `completed`, `archived`) và khoảng thời gian.
- **Tự động xử lý hết hạn (Auto Expiry)**: Task chạy ngầm định kỳ kiểm tra và cập nhật các đồ vật quá hạn sang trạng thái hoàn tất.
- **Quản trị & Xuất dữ liệu**: Xuất báo cáo danh sách đồ vật ra định dạng CSV/Excel.

## 🛠️ Công nghệ sử dụng

- **Backend**: Python 3, FastAPI, Uvicorn, SQLAlchemy, Pydantic, Jinja2.
- **Database**: SQLite (`lost_and_found_v2.db`).
- **Frontend**: HTML5, Vanilla CSS (Glassmorphism Dark Theme), JavaScript (Fetch API), Boxicons, Google Fonts.

## 📦 Cài đặt và Khởi chạy

### 1. Cài đặt các thư viện phụ thuộc
```bash
pip install -r requirements.txt
```

### 2. Khởi chạy máy chủ
```bash
py -m uvicorn main:app --reload
```
Hoặc:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Truy cập ứng dụng
Mở trình duyệt và truy cập: [http://localhost:8000](http://localhost:8000)

- Tài khoản Quản trị viên mặc định:
  - **Tên đăng nhập**: `admin`
  - **Mật khẩu**: `123456`

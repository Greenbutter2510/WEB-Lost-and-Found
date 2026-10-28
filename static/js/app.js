document.addEventListener('DOMContentLoaded', () => {
    // Trạng thái Người dùng hiện tại (Current User State)
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

    // Các phần tử DOM trên Giao diện (DOM Elements)
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const loginFormSection = document.getElementById('loginFormSection');
    const registerFormSection = document.getElementById('registerFormSection');
    const dashboardTitle = document.getElementById('currentViewTitle');
    const itemsContainer = document.getElementById('itemsContainer');
    const displayName = document.getElementById('displayName');
    const displayRole = document.getElementById('displayRole');

    // Các biểu mẫu (Forms)
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const reportForm = document.getElementById('reportForm');
    const engageForm = document.getElementById('engageForm');
    const filterForm = document.getElementById('filterForm');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    // Hàm khởi tạo, quyết định giao diện hiển thị ban đầu (Initial View)
    const init = () => {
        if (currentUser) {
            showMainApp();
            loadItems();
        } else {
            showAuthScreen();
        }
    };

    const showAuthScreen = () => {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    };

    const showMainApp = () => {
        authScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        displayName.textContent = currentUser.full_name || currentUser.username;
        displayRole.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        if (currentUser.role !== 'admin') {
            if (exportCsvBtn) exportCsvBtn.style.display = 'none';
        } else {
            if (exportCsvBtn) {
                exportCsvBtn.style.display = 'block';
                exportCsvBtn.href = `/api/export?user_role=${currentUser.role}`;
            }
        }
    };

    window.toggleAuth = (showLogin) => {
        loginFormSection.classList.toggle('hidden', !showLogin);
        registerFormSection.classList.toggle('hidden', showLogin);
    };

    window.logout = () => {
        localStorage.removeItem('currentUser');
        currentUser = null;
        window.location.reload();
    };

    // Các xử lý Xác thực: Đăng nhập/Đăng ký (Auth Actions)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value;
        const password = document.getElementById('loginPass').value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) throw new Error('Thông tin đăng nhập không hợp lệ');
            currentUser = await res.json();
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp();
            loadItems();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUser').value;
        const password = document.getElementById('regPass').value;
        const full_name = document.getElementById('regName').value;
        const phone = document.getElementById('regPhone').value;
        const secondary_contact = document.getElementById('regContact').value;
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, full_name, phone, secondary_contact, role: 'guest' })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Đăng ký thất bại');
            }
            showToast('Đăng ký thành công! Vui lòng đăng nhập.');
            toggleAuth(true);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Tải và hiển thị dữ liệu Danh sách Đồ vật (Data Loading)
    const loadItems = async (filterRole = null, filters = {}) => {
        try {
            itemsContainer.innerHTML = '<div style="width:100%; text-align:center; grid-column:1/-1;">Đang tải dữ liệu...</div>';
            
            const queryParams = new URLSearchParams();
            if (filterRole) {
                queryParams.append('filter_role', filterRole);
                queryParams.append('current_user_id', currentUser.id);
            }
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.description) queryParams.append('description', filters.description);
            if (filters.identifier) queryParams.append('identifier', filters.identifier);
            if (filters.dateFrom) queryParams.append('date_from', filters.dateFrom);
            if (filters.dateTo) queryParams.append('date_to', filters.dateTo);

            let url = `/api/items?${queryParams.toString()}`;

            const res = await fetch(url);
            let items = await res.json();
            
            // Ẩn đồ vật đã lưu trữ khỏi màn hình chính, và ẩn đồ hoàn thành nếu không chủ động lọc bằng status 'completed'
            if (filterRole !== 'activity') {
                items = items.filter(item => {
                    if (item.status === 'archived') return false;
                    if (item.status === 'completed' && filters.status !== 'completed') return false;
                    return true;
                });
            }
            
            itemsContainer.innerHTML = '';
            if (items.length === 0) {
                itemsContainer.innerHTML = '<div style="width:100%; text-align:center; grid-column:1/-1; color:var(--text-muted);">Không tìm thấy dữ liệu.</div>';
                return;
            }

            items.forEach(item => {
                const card = createItemCard(item);
                itemsContainer.appendChild(card);
            });
        } catch (err) {
            showToast('Tải dữ liệu thất bại', 'error');
        }
    };

    const createItemCard = (item) => {
        const div = document.createElement('div');
        div.className = 'item-card glass-panel';
        
        const imgSrc = item.attachment_path ? `/${item.attachment_path}` : 'https://placehold.co/600x400/1e293b/94a3b8?text=No+Photo';
        
        // Nhãn Trạng thái (Status Badge)
        const statusClass = item.status.toLowerCase();
        
        // Logic xử lý hiển thị các nút Hành động dựa theo trạng thái quyền (Actions Logic)
        let actionButtons = '';
        const statusMap = {'lost': 'MẤT', 'found': 'NHẶT ĐƯỢC', 'verifying': 'ĐANG XÁC MINH', 'completed': 'ĐÃ HOÀN THÀNH', 'archived': 'ĐÃ LƯU TRỮ', 'cancel': 'HỦY'};
        let statusText = (statusMap[item.status.toLowerCase()] || item.status).toUpperCase();
        
        if (item.status === 'found') {
            if (item.finder_id === currentUser.id) {
                actionButtons = `<button class="btn btn-outline" disabled>Đang chờ yêu cầu</button>`;
            } else {
                actionButtons = `<button class="btn btn-primary" onclick="openEngageModal(${item.id}, 'found')">Đây là đồ của tôi</button>`;
            }
        } else if (item.status === 'lost') {
            if (item.finder_id === currentUser.id) {
                actionButtons = `<button class="btn btn-outline" disabled>Đã báo mất</button>`;
            } else {
                actionButtons = `<button class="btn btn-primary" onclick="openEngageModal(${item.id}, 'lost')">Tôi nhặt được đồ này</button>`;
            }
        } else if (item.status === 'verifying') {
            if (item.finder_id === currentUser.id) {
                actionButtons = `<button class="btn btn-secondary" onclick="openReviewModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">Xem xét bằng chứng</button>`;
            } else if (item.loser_id === currentUser.id) {
                actionButtons = `<button class="btn btn-secondary" disabled>Đang xác minh...</button>`;
            } else {
                actionButtons = `<button class="btn btn-outline" disabled>Hiện đang xác minh</button>`;
            }
        } else if (item.status === 'completed' || item.status === 'archived') {
            if (currentUser.role === 'admin' && item.status === 'completed') {
                actionButtons = `<button class="btn btn-secondary" style="color:var(--danger)" onclick="deleteItem(${item.id})"><i class='bx bx-trash'></i> Xóa bản ghi</button>`;
            } else if (item.finder_id === currentUser.id || item.loser_id === currentUser.id) {
                if (item.status === 'archived') {
                    // Hiển thị thông tin cả 2 phe (Người đăng & Người tương tác) trong record lưu trữ
                    actionButtons = `
                    <div class="contact-info" style="margin-bottom: 8px;">
                        <p style="margin-bottom: 5px; color: var(--primary); font-weight: bold;">Tác giả (Người đăng)</p>
                        <p><b>Họ tên:</b> ${item.finder ? (item.finder.full_name || item.finder.username) : 'N/A'} ${item.finder && item.finder.phone ? `(${item.finder.phone})` : ''}</p>
                        ${item.finder && item.finder.secondary_contact ? `<p><b>Liên hệ:</b> ${item.finder.secondary_contact}</p>` : ''}
                    </div>
                    <div class="contact-info">
                        <p style="margin-bottom: 5px; color: var(--danger); font-weight: bold;">Người xác nhận</p>
                        <p><b>Họ tên:</b> ${item.loser ? (item.loser.full_name || item.loser.username) : 'Không có (đã hết hạn)'} ${item.loser && item.loser.phone ? `(${item.loser.phone})` : ''}</p>
                        ${item.loser && item.loser.secondary_contact ? `<p><b>Liên hệ:</b> ${item.loser.secondary_contact}</p>` : ''}
                    </div>
                    `;
                } else {
                    const contact = item.finder_id === currentUser.id ? item.loser : item.finder;
                    const roleName = item.finder_id === currentUser.id ? "Người tương tác" : "Người đăng";
                    actionButtons = `<div class="contact-info">
                        <p style="margin-bottom: 5px; color: var(--success); font-weight: bold;">Thông tin ${roleName}</p>
                        <p><b>Họ tên:</b> ${contact ? (contact.full_name || contact.username) : 'N/A'}</p>
                        <p><b>SĐT:</b> ${contact ? (contact.phone || '-') : '-'}</p>
                        ${contact && contact.secondary_contact ? `<p><b>Liên hệ:</b> ${contact.secondary_contact}</p>` : ''}
                    </div>`;
                }
            } else {
                let textStatus = item.status === 'completed' ? 'Đã trao trả' : 'Đã được Ban quản trị lưu trữ';
                actionButtons = `<button class="btn btn-outline" disabled style="width:100%">${textStatus}</button>`;
            }
        }

        div.innerHTML = `
            <img src="${imgSrc}" class="item-card-img" alt="Item">
            <div class="item-card-content">
                <div class="item-card-header">
                    <span class="item-card-title">${item.title}</span>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                <div class="item-details">
                    <p><b>Mã:</b> ${item.identifier || '-'}</p>
                    <p style="margin-top: 5px;">${item.description}</p>
                    <div class="item-meta">
                        <i class='bx bx-map-pin'></i> ${item.area || 'Không rõ'} | 
                        <i class='bx bx-calendar'></i> ${item.incident_date}
                    </div>
                </div>
                <div class="item-footer">
                    ${actionButtons}
                </div>
            </div>
        `;
        return div;
    };

    const getFilters = () => {
        if (!filterForm) return {};
        return {
            description: document.getElementById('filterDesc').value,
            identifier: document.getElementById('filterIdent').value,
            status: document.getElementById('filterStatus').value,
            dateFrom: document.getElementById('filterDateFrom').value,
            dateTo: document.getElementById('filterDateTo').value
        };
    };

    // Xử lý chuyển hướng Menu (Navigation)
    document.getElementById('navAll').addEventListener('click', (e) => {
        updateNav(e.currentTarget);
        dashboardTitle.textContent = 'Tất cả bài đăng';
        loadItems(null, getFilters());
    });
    document.getElementById('navActivity').addEventListener('click', (e) => {
        updateNav(e.currentTarget);
        dashboardTitle.textContent = 'Lịch sử hoạt động';
        loadItems('activity', getFilters());
    });

    // Xử lý Lọc dữ liệu (Filters)
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Send current active role if any
            let currentActiveRole = null;
            if (document.getElementById('navActivity') && document.getElementById('navActivity').classList.contains('active')) currentActiveRole = 'activity';
            loadItems(currentActiveRole, getFilters());
        });

        clearFiltersBtn.addEventListener('click', () => {
            filterForm.reset();
            let currentActiveRole = null;
            if (document.getElementById('navActivity') && document.getElementById('navActivity').classList.contains('active')) currentActiveRole = 'activity';
            loadItems(currentActiveRole);
        });
    }

    const updateNav = (target) => {
        document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
        target.classList.add('active');
    };

    // --- Xử lý các Hộp thoại (Modal Actions) ---
    window.openModal = (id) => document.getElementById(id).classList.add('active');
    window.closeModal = (id) => document.getElementById(id).classList.remove('active');

    document.getElementById('openReportModalBtn').addEventListener('click', () => {
        document.getElementById('incidentDateInput').valueAsDate = new Date();
        openModal('reportModal');
    });

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(reportForm);
        formData.append('finder_id', currentUser.id);

        try {
            const res = await fetch('/api/items', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Đăng tin thất bại');
            showToast('Đăng tin thành công!');
            closeModal('reportModal');
            reportForm.reset();
            loadItems();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Gửi Yêu cầu tương tác (Đòi lại đồ / Thông báo nhặt đồ) (Engaging)
    window.openEngageModal = (id, type) => {
        document.getElementById('engageItemId').value = id;
        const title = document.getElementById('engageModalTitle');
        const desc = document.getElementById('engageModalDesc');
        const label = document.getElementById('engageModalLabel');
        const submitBtn = document.getElementById('engageSubmitBtn');

        if (type === 'found') {
            title.innerHTML = "<i class='bx bx-check-shield'></i> Xác minh quyền sở hữu";
            desc.innerHTML = "Vui lòng cung cấp <b>chi tiết bí mật</b> hoặc đặc điểm nhận dạng mà chỉ chủ sở hữu mới biết (ví dụ: số sê-ri, nội dung cụ thể).";
            label.innerText = "Chi tiết bí mật *";
            submitBtn.innerText = "Gửi yêu cầu";
        } else {
            title.innerHTML = "<i class='bx bx-search-alt'></i> Đã nhặt được";
            desc.innerHTML = "Vui lòng để lại tin nhắn ghi chi tiết chính xác nơi và lúc bạn tìm thấy món đồ này để chủ sở hữu xác minh.";
            label.innerText = "Chi tiết & Tin nhắn *";
            submitBtn.innerText = "Liên hệ người mất";
        }
        
        openModal('engageModal');
    };

    engageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('engageItemId').value;
        const formData = new FormData(engageForm);
        formData.append('loser_id', currentUser.id);

        try {
            const res = await fetch(`/api/items/${itemId}/claim`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Gửi tin nhắn thất bại');
            showToast('Đã gửi tin nhắn! Đang chờ tác giả xem xét.');
            closeModal('engageModal');
            engageForm.reset();
            loadItems();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Xem xét minh chứng & Xác nhận hoàn tất (Review & Confirm)
    window.openReviewModal = (item) => {
        document.getElementById('reviewLoserName').textContent = item.loser.full_name;
        document.getElementById('reviewSecretDetails').textContent = item.secret_details;
        
        const confirmBtn = document.getElementById('confirmClaimBtn');
        confirmBtn.onclick = async () => {
            try {
                const res = await fetch(`/api/items/${item.id}/confirm`, { method: 'POST' });
                if (!res.ok) throw new Error('Xác nhận thất bại');
                showToast('Đã xác nhận! Đã thông báo cho chủ sở hữu.');
                closeModal('reviewModal');
                loadItems();
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
        openModal('reviewModal');
    };

    window.deleteItem = async (id) => {
        if (!confirm('Bạn có chắc chắn muốn xóa bản ghi đã hoàn thành này không?')) return;
        try {
            const res = await fetch(`/api/items/${id}?user_role=${currentUser.role}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Xóa thất bại');
            }
            showToast('Quản trị viên đã xóa bản ghi');
            loadItems();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Tập hợp các Các hàm hỗ trợ (Helpers)
    const showToast = (message, type = 'success') => {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('i');
        const msg = document.getElementById('toastMessage');
        toast.className = 'toast show';
        msg.textContent = message;
        if (type === 'error') {
            toast.classList.add('error');
            icon.className = 'bx bx-error-circle';
        } else {
            toast.classList.remove('error');
            icon.className = 'bx bx-check-circle';
        }
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    // Quản lý Hồ sơ người dùng (Profile Management)
    const profileForm = document.getElementById('profileForm');
    const openProfileModalBtn = document.getElementById('openProfileModalBtn');
    if (openProfileModalBtn) {
        openProfileModalBtn.addEventListener('click', () => {
            document.getElementById('profileName').value = currentUser.full_name || '';
            document.getElementById('profilePhone').value = currentUser.phone || '';
            document.getElementById('profileContact').value = currentUser.secondary_contact || '';
            document.getElementById('profilePass').value = '';
            openModal('profileModal');
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                full_name: document.getElementById('profileName').value,
                phone: document.getElementById('profilePhone').value,
                secondary_contact: document.getElementById('profileContact').value
            };
            const pass = document.getElementById('profilePass').value;
            if (pass) payload.password = pass;

            try {
                const res = await fetch(`/api/users/${currentUser.id}/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Cập nhật hồ sơ thất bại');
                const updatedUser = await res.json();
                
                currentUser = { ...currentUser, ...updatedUser };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                showMainApp(); // refresh display
                showToast('Cập nhật hồ sơ thành công!');
                closeModal('profileModal');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    init();
});

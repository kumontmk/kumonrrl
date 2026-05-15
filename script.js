// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Main Application Script
// ═══════════════════════════════════════════════════════════
const JSONBIN_CONFIG = {
    BIN_ID: '6a054b89c0954111d81ee9ae',
    API_KEY: '$2a$10$knk7dAn110pbuLUoGrzIEeYrPDXJGPq9P8TJIsMekjcFlnFZDLqlm',
    BASE_URL: 'https://api.jsonbin.io/v3/b'
};
const SESSION_KEY = 'kumonLibrarySession';

let books = [];
let nextId = 1;
let isLoading = false;
let isAdmin = false;
let pendingBorrowBookId = null;
let pendingReturnBookId = null;
let selectedBookId = null;
let hasUnsavedChanges = false;
let isSaving = false;

// ═══════════════════════════════════════════════════════════
// UTILITY & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════
async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After') || (i + 1);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            return res;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
        }
    }
    throw new Error('Max retries exceeded');
}

// 🔒 Runs on startup to catch 403/401 before user tries to save
async function verifyJSONBinConfig() {
    if (window.location.protocol === 'file:') {
        console.warn('⚠️ Running from file://. Browsers block JSONBin API requests locally.');
        showToast('⚠️ Use VS Code Live Server or host on HTTP to enable saving.', 'warning');
        return;
    }
    try {
        const res = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
            method: 'GET',
            headers: { 'X-Master-Key': JSONBIN_CONFIG.API_KEY }
        });
        if (res.status === 403) {
            console.error('❌ 403 Forbidden: Check your JSONBin Master Key & Bin ID.');
            console.error('→ Go to https://jsonbin.io/ → Dashboard → API Keys → Copy "Master Key"');
            showToast('❌ API Key rejected (403). Check console for fix steps.', 'error');
        }
    } catch (e) {
        console.error('Config verification failed:', e);
    }
}

// 📱 Safe image compression (handles iOS HEIC/Android WebP)
async function compressImage(file, maxWidth = 300, quality = 0.2) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Image load failed'));
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((maxWidth / width) * height);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    if (!dataUrl || dataUrl.length < 20) throw new Error('Invalid compression output');
                    resolve(dataUrl);
                } catch (err) { reject(err); }
                finally { URL.revokeObjectURL(img.src); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ═══════════════════════════════════════════════════════════
// SESSION & UI HELPERS
// ═══════════════════════════════════════════════════════════
function saveSession() { localStorage.setItem(SESSION_KEY, JSON.stringify({ isAdmin: true, loginTime: new Date().toISOString() })); }
function checkSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.isAdmin === true; } catch { return false; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function setAdminMode(active) {
    isAdmin = active;
    const app = document.getElementById('mainApp');
    const indicator = document.getElementById('modeIndicator');
    if (active) { app.classList.add('admin-mode'); indicator.textContent = '🔐 Admin Mode'; indicator.classList.add('admin'); }
    else { app.classList.remove('admin-mode'); indicator.textContent = '👥 Public View'; indicator.classList.remove('admin'); }
    updateDetailModalVisibility();
}
function updateDetailModalVisibility() { if (selectedBookId) openBookDetail(selectedBookId); }
function logout() { clearSession(); setAdminMode(false); showToast('Logged out - now in Public View', 'info'); }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function setUnsavedChanges(state) {
    hasUnsavedChanges = state;
    const indicator = document.getElementById('unsavedIndicator');
    if (indicator) indicator.style.display = state ? 'inline' : 'none';
}

window.addEventListener('beforeunload', (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; return ''; } });

// ═══════════════════════════════════════════════════════════
// MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════
function openLoginModal() { document.getElementById('loginOverlay').classList.add('show'); document.getElementById('passwordInput').focus(); }
function closeLoginModal() { document.getElementById('loginOverlay').classList.remove('show'); document.getElementById('loginError').style.display = 'none'; }
function openBorrowModal(bookId, bookTitle) {
    if (!isAdmin) { openVisitorBorrowModal(bookId, bookTitle); return; }
    pendingBorrowBookId = bookId;
    document.getElementById('borrowBookTitle').textContent = `"${bookTitle}"`;
    document.getElementById('borrowerName').value = '';
    document.getElementById('borrowerGrade').value = '';
    document.getElementById('borrowerLevel').value = '';
    document.getElementById('borrowModal').classList.add('show');
    document.getElementById('borrowerName').focus();
    setUnsavedChanges(true);
}
function closeBorrowModal() { document.getElementById('borrowModal').classList.remove('show'); pendingBorrowBookId = null; setUnsavedChanges(false); }
function openVisitorBorrowModal(bookId, bookTitle) { pendingBorrowBookId = bookId; document.getElementById('visitorBorrowModal').classList.add('show'); }
function closeVisitorBorrowModal() { document.getElementById('visitorBorrowModal').classList.remove('show'); pendingBorrowBookId = null; }
function openLoginModalFromVisitor() { closeVisitorBorrowModal(); openLoginModal(); }
function openAddBookModal() {
    if (!isAdmin) { openLoginModal(); return; }
    ['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL','newBookCover'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('imageSizeWarning').classList.remove('show');
    document.getElementById('addBookModal').classList.add('show');
    document.getElementById('newBookTitle').focus();
    setUnsavedChanges(true);
}
function closeAddBookModal() { document.getElementById('addBookModal').classList.remove('show'); setUnsavedChanges(false); }
function openEditModal(bookId) {
    if (!isAdmin) { openLoginModal(); return; }
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    document.getElementById('editBookId').value = book.id;
    document.getElementById('editBookTitle').value = book.title;
    document.getElementById('editBookAuthor').value = book.author;
    document.getElementById('editBookGenre').value = book.genre || '';
    document.getElementById('editBookLocation').value = book.location;
    document.getElementById('editBookRRL').value = book.rrlLevel || '';
    document.getElementById('editBookCover').value = '';
    document.getElementById('editImageSizeWarning').classList.remove('show');
    document.getElementById('editBookModal').classList.add('show');
    document.getElementById('editBookTitle').focus();
    setUnsavedChanges(true);
}
function closeEditBookModal() { document.getElementById('editBookModal').classList.remove('show'); setUnsavedChanges(false); }
function openBookDetail(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    selectedBookId = bookId;
    document.getElementById('detailCoverFull').innerHTML = book.coverImage ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}">` : '<span class="placeholder-large">📘</span>';
    document.getElementById('detailTitle').textContent = book.title;
    document.getElementById('detailAuthor').textContent = `by ${book.author}`;
    document.getElementById('detailGenre').textContent = book.genre || 'Uncategorized';
    document.getElementById('detailLocation').textContent = book.location;
    document.getElementById('detailRRL').textContent = book.rrlLevel || 'N/A';
    document.getElementById('detailID').textContent = `#${book.id}`;
    document.getElementById('detailStatus').textContent = book.status === 'available' ? '✓ Available' : '📤 Borrowed';
    document.getElementById('detailStatus').className = `detail-status ${book.status}`;
    const borrowerSection = document.getElementById('detailBorrowerSection');
    if (book.status === 'borrowed' && book.borrower) {
        borrowerSection.style.display = 'block';
        document.getElementById('detailBorrowerName').textContent = book.borrower;
        document.getElementById('detailBorrowerGrade').textContent = book.borrowerGrade || '-';
        document.getElementById('detailBorrowerLevel').textContent = book.borrowerLevel || '-';
        document.getElementById('detailBorrowDate').textContent = book.borrowDate || '-';
    } else { borrowerSection.style.display = 'none'; }
    document.getElementById('detailBorrowBtn').style.display = book.status === 'available' ? 'flex' : 'none';
    document.getElementById('detailReturnBtn').style.display = book.status === 'borrowed' ? 'flex' : 'none';
    document.getElementById('detailModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}
function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); document.body.style.overflow = ''; selectedBookId = null; }
function goHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function handleDetailBorrow() { if (selectedBookId) { const book = books.find(b => b.id === selectedBookId); if (book) { closeDetailModal(); openBorrowModal(book.id, book.title); } } }
function handleDetailReturn() { if (selectedBookId) { returnBook(selectedBookId); closeDetailModal(); } }
function handleDetailRemove() { if (selectedBookId) { const book = books.find(b => b.id === selectedBookId); if (book && confirm(`Remove "${book.title}"?`)) { removeBook(selectedBookId); closeDetailModal(); } } }

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════
function login() {
    const password = document.getElementById('passwordInput').value;
    if (password === '1111') {
        saveSession(); setAdminMode(true); closeLoginModal(); document.getElementById('passwordInput').value = '';
        if (pendingBorrowBookId) { const book = books.find(b => b.id === pendingBorrowBookId); if (book) openBorrowModal(book.id, book.title); pendingBorrowBookId = null; }
        if (pendingReturnBookId) { returnBook(pendingReturnBookId); pendingReturnBookId = null; }
        showToast('✅ Admin mode activated', 'success');
    } else {
        document.getElementById('loginError').style.display = 'block';
        setTimeout(() => { document.getElementById('loginError').style.display = 'none'; }, 2000);
    }
}

// ═══════════════════════════════════════════════════════════
// DATA OPERATIONS
// ═══════════════════════════════════════════════════════════
async function loadBooks() {
    if (isLoading) return;
    isLoading = true;
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('booksGrid').innerHTML = '';
    try {
        const response = await fetchWithRetry(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, { headers: { 'X-Master-Key': JSONBIN_CONFIG.API_KEY, 'Content-Type': 'application/json' }});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        books = Array.isArray(data.record?.books) ? [...data.record.books] : [];
        nextId = books.length > 0 ? Math.max(...books.map(b => b.id)) + 1 : 1;
        updateStats(); renderBooks();
        if (books.length > 0) showToast(`✅ Loaded ${books.length} books`, 'success');
    } catch (error) {
        console.error('Load error:', error);
        showToast(`Failed to load: ${error.message}`, 'error');
        books = []; renderBooks();
    } finally { isLoading = false; document.getElementById('loadingState').style.display = 'none'; setUnsavedChanges(false); }
}

// 🔧 FIXED: Explicit 403/401 handling, 25s timeout, payload limit check
async function saveBooks() {
    if (isSaving) return false;
    isSaving = true;

    const payload = JSON.stringify({ books, lastUpdated: new Date().toISOString() });
    if (payload.length > 800000) {
        isSaving = false;
        showToast(`❌ Library too large (${(payload.length/1024/1024).toFixed(2)}MB). Export backup & delete old books.`, 'error');
        return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
        const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
            method: 'PUT',
            headers: { 'X-Master-Key': JSONBIN_CONFIG.API_KEY, 'Content-Type': 'application/json', 'X-Bin-Meta': 'false' },
            body: payload,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`[JSONBin] Status ${response.status}:`, errText);
            
            let userMsg = 'Save failed';
            if (response.status === 400) userMsg = 'Invalid data format';
            else if (response.status === 401) userMsg = 'API Key rejected (Check JSONBin Dashboard)';
            else if (response.status === 403) userMsg = 'Forbidden: Use Master Key & run on HTTP/HTTPS (not file://)';
            else if (response.status === 413) userMsg = 'Data too large for server';
            else if (response.status === 429) userMsg = 'Too many requests. Wait 10s & retry.';
            else userMsg = `Server Error ${response.status}`;

            showToast(`❌ ${userMsg}`, 'error');
            isSaving = false;
            return false;
        }
        isSaving = false;
        return true;
    } catch (error) {
        clearTimeout(timeoutId);
        isSaving = false;
        console.error('[JSONBin] Network Error:', error);
        if (error.name === 'AbortError') showToast('❌ Request timed out. Check internet/WiFi.', 'error');
        else showToast(`❌ Network error: ${error.message}`, 'error');
        return false;
    }
}

async function testConnection() {
    showToast('Testing connection...', 'info');
    try {
        const res = await fetchWithRetry(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, { headers: { 'X-Master-Key': JSONBIN_CONFIG.API_KEY }});
        const data = await res.json();
        showToast(`✅ Connected! ${data.record?.books?.length || 0} books`, 'success');
    } catch (e) { showToast(`❌ Error: ${e.message}`, 'error'); }
}

function exportBackup() {
    if (books.length === 0) { showToast('No books to export', 'info'); return; }
    const blob = new Blob([JSON.stringify(books, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `kumon-library-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded!', 'success');
}

function updateStats() {
    document.getElementById('totalBooks').textContent = books.length;
    document.getElementById('availableBooks').textContent = books.filter(b => b.status === 'available').length;
    document.getElementById('borrowedBooks').textContent = books.filter(b => b.status === 'borrowed').length;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════════════════════
// BOOK MANAGEMENT
// ═══════════════════════════════════════════════════════════
async function processAddBook() {
    if (isSaving) return;
    const btn = document.getElementById('addBookBtn');
    const warningEl = document.getElementById('imageSizeWarning');
    const title = document.getElementById('newBookTitle').value.trim();
    const author = document.getElementById('newBookAuthor').value.trim();
    const genre = document.getElementById('newBookGenre').value.trim();
    const location = document.getElementById('newBookLocation').value.trim();
    const rrlLevel = document.getElementById('newBookRRL').value.trim();
    const fileInput = document.getElementById('newBookCover');

    if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');
    const file = fileInput.files[0];

    try {
        let coverImage = null;
        if (file) {
            if (file.size > 500 * 1024) { warningEl.textContent = `⚠️ Compressing image...`; warningEl.classList.add('show'); }
            coverImage = await compressImage(file, 300, 0.2);
        }
        const saved = await addBookToSystem(title, author, genre, location, rrlLevel, coverImage);
        if (saved) {
            closeAddBookModal(); fileInput.value = '';
            showToast(`✅ "${title}" saved successfully`, 'success');
        }
    } catch (error) { console.error('Add book error:', error); showToast('❌ Failed to process image.', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Book'; warningEl.classList.remove('show'); }
}

async function addBookToSystem(title, author, genre, location, rrlLevel, coverImage) {
    const newBook = { id: nextId++, title, author, genre: genre || 'Uncategorized', location, rrlLevel: rrlLevel || 'N/A', coverImage, status: 'available', borrower: null, borrowDate: null, borrowerGrade: null, borrowerLevel: null };
    books.unshift(newBook);
    const success = await saveBooks();
    if (success) { updateStats(); renderBooks(); setUnsavedChanges(false); return true; }
    else { books.shift(); nextId--; renderBooks(); return false; }
}

async function processEditBook() {
    const btn = document.getElementById('editBookBtn');
    const warningEl = document.getElementById('editImageSizeWarning');
    const id = parseInt(document.getElementById('editBookId').value);
    const title = document.getElementById('editBookTitle').value.trim();
    const author = document.getElementById('editBookAuthor').value.trim();
    const genre = document.getElementById('editBookGenre').value.trim();
    const location = document.getElementById('editBookLocation').value.trim();
    const rrlLevel = document.getElementById('editBookRRL').value.trim();
    const fileInput = document.getElementById('editBookCover');
    if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }

    const book = books.find(b => b.id === id); if (!book) return;
    btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');

    try {
        let coverImage = book.coverImage;
        const file = fileInput.files[0];
        if (file) { if (file.size > 500 * 1024) { warningEl.textContent = `⚠️ Compressing image...`; warningEl.classList.add('show'); } coverImage = await compressImage(file, 300, 0.2); }
        book.title = title; book.author = author; book.genre = genre || 'Uncategorized'; book.location = location; book.rrlLevel = rrlLevel || 'N/A'; book.coverImage = coverImage;
        if (await saveBooks()) { closeEditBookModal(); renderBooks(); openBookDetail(id); showToast(`✅ "${title}" updated`, 'success'); setUnsavedChanges(false); }
    } catch (error) { console.error('Edit error:', error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Update Book'; warningEl.classList.remove('show'); }
}

async function removeBook(id) {
    const book = books.find(b => b.id === id);
    if (book && confirm(`Remove "${book.title}"?`)) {
        books = books.filter(b => b.id !== id);
        if (await saveBooks()) { updateStats(); renderBooks(); showToast(`"${book.title}" removed`, 'success'); setUnsavedChanges(false); }
    }
}

async function confirmBorrow() {
    const name = document.getElementById('borrowerName').value.trim();
    const grade = document.getElementById('borrowerGrade').value.trim();
    const level = document.getElementById('borrowerLevel').value.trim();
    if (!name || !grade || !level) { showToast('Please fill in all borrower fields', 'error'); return; }
    const book = books.find(b => b.id === pendingBorrowBookId);
    if (book) {
        book.status = 'borrowed'; book.borrower = name; book.borrowerGrade = grade; book.borrowerLevel = level; book.borrowDate = new Date().toISOString().split('T')[0];
        if (await saveBooks()) { closeBorrowModal(); renderBooks(); updateStats(); showToast(`✅ "${book.title}" borrowed by ${name}`, 'success'); setUnsavedChanges(false); }
    }
}

async function returnBook(id) {
    if (!isAdmin) { pendingReturnBookId = id; openLoginModal(); return; }
    const book = books.find(b => b.id === id);
    if (book) {
        const info = `${book.borrower} (${book.borrowerGrade}, ${book.borrowerLevel})`;
        book.status = 'available'; book.borrower = null; book.borrowerGrade = null; book.borrowerLevel = null; book.borrowDate = null;
        if (await saveBooks()) { renderBooks(); updateStats(); showToast(`✅ "${book.title}" returned by ${info}`, 'success'); setUnsavedChanges(false); }
    }
}

// ═══════════════════════════════════════════════════════════
// RENDERING & FILTERING
// ═══════════════════════════════════════════════════════════
function getFilteredAndSortedBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const sortBy = document.getElementById('sortBy').value;
    let filtered = books.filter(book => {
        const matchesSearch = book.title.toLowerCase().includes(searchTerm) || book.author.toLowerCase().includes(searchTerm) || book.location.toLowerCase().includes(searchTerm);
        const matchesStatus = filterStatus === 'all' || book.status === filterStatus;
        return matchesSearch && matchesStatus;
    });
    filtered.sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'author') return a.author.localeCompare(b.author);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        if (sortBy === 'rrl') { const levelA = (a.rrlLevel || 'Z').toUpperCase(); const levelB = (b.rrlLevel || 'Z').toUpperCase(); return levelA.localeCompare(levelB, undefined, { numeric: true }); }
        return 0;
    });
    return filtered;
}

function renderBooks() {
    const grid = document.getElementById('booksGrid');
    const emptyState = document.getElementById('emptyState');
    const filteredBooks = getFilteredAndSortedBooks();
    if (filteredBooks.length === 0 && books.length > 0) { grid.innerHTML = ''; emptyState.style.display = 'block'; emptyState.querySelector('h2').textContent = 'No matching books'; emptyState.querySelector('p').textContent = 'Try adjusting your search or filter'; return; }
    if (books.length === 0) { grid.innerHTML = ''; emptyState.style.display = 'block'; emptyState.querySelector('h2').textContent = '📚 Library is empty'; emptyState.querySelector('p').textContent = isAdmin ? 'Click ➕ to add your first book' : 'Check back soon!'; return; }
    emptyState.style.display = 'none';

    grid.innerHTML = filteredBooks.map(book => `
        <div class="book-card ${book.status}" onclick="openBookDetail(${book.id})">
            ${book.coverImage ? `<img src="${book.coverImage}" class="book-cover" alt="${escapeHtml(book.title)}" onerror="this.parentElement.innerHTML='<div class=\\'book-cover\\'>📘</div>'">` : `<div class="book-cover">📘</div>`}
            <div class="book-title">${escapeHtml(book.title)}</div>
            <div class="book-author">by ${escapeHtml(book.author)}</div>
            <div class="book-location">📍 ${escapeHtml(book.location)}</div>
            <div class="book-meta"><span>${escapeHtml(book.genre)}</span> <span>•</span> <span class="rrl-badge">RRL: ${escapeHtml(book.rrlLevel || 'N/A')}</span> <span>•</span> <span>ID: ${book.id}</span></div>
            <span class="status-badge ${book.status}">${book.status === 'available' ? '✓ Available' : '📤 Borrowed'}</span>
            ${book.status === 'borrowed' ? `<div style="margin-top:0.5rem;"><span class="borrower-badge">${escapeHtml(book.borrower)}</span><br><small style="color:#64748b;display:block;margin-top:0.25rem">Grade: ${escapeHtml(book.borrowerGrade)} • Level: ${escapeHtml(book.borrowerLevel)}</small><small style="color:#94a3b8;display:block">Since: ${book.borrowDate}</small></div>` : ''}
            <div class="book-actions" onclick="event.stopPropagation()">
                ${book.status === 'available' ? `<button class="btn btn-primary" onclick="openBorrowModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')" >📚 Borrow</button>` : `<button class="btn btn-success" onclick="returnBook(${book.id})">✅ Return</button>`}
                <button class="btn btn-primary btn-small admin-only" onclick="openEditModal(${book.id})" style="background:#7c3aed">✏️ Edit</button>
                <button class="btn btn-danger btn-small admin-only" onclick="removeBook(${book.id})">🗑 Remove</button>
            </div>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION & LISTENERS
// ═══════════════════════════════════════════════════════════
function initApp() {
    if (checkSession()) { setAdminMode(true); showToast('✅ Admin session restored', 'info'); }
    else { setAdminMode(false); }
    verifyJSONBinConfig(); // 🔍 Check for 403/401 early
    loadBooks();
}
document.addEventListener('DOMContentLoaded', initApp);
document.getElementById('passwordInput').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
document.getElementById('searchInput').addEventListener('input', renderBooks);
document.getElementById('filterStatus').addEventListener('change', renderBooks);
document.getElementById('sortBy').addEventListener('change', renderBooks);
document.getElementById('newBookCover')?.addEventListener('change', function(e) {
    const file = e.target.files[0]; const warningEl = document.getElementById('imageSizeWarning');
    if (file && file.size > 500 * 1024) { warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Will compress.`; warningEl.classList.add('show'); }
    else { warningEl.classList.remove('show'); }
});
['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL'].forEach(id => { document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processAddBook(); }); });
document.getElementById('editBookCover')?.addEventListener('change', function(e) {
    const file = e.target.files[0]; const warningEl = document.getElementById('editImageSizeWarning');
    if (file && file.size > 500 * 1024) { warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Will compress.`; warningEl.classList.add('show'); }
    else { warningEl.classList.remove('show'); }
});
['editBookTitle','editBookAuthor','editBookGenre','editBookLocation','editBookRRL'].forEach(id => { document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processEditBook(); }); });
document.getElementById('loginOverlay')?.addEventListener('click', e => { if (e.target.id === 'loginOverlay') closeLoginModal(); });
document.getElementById('borrowModal')?.addEventListener('click', e => { if (e.target.id === 'borrowModal') closeBorrowModal(); });
document.getElementById('addBookModal')?.addEventListener('click', e => { if (e.target.id === 'addBookModal') closeAddBookModal(); });
document.getElementById('editBookModal')?.addEventListener('click', e => { if (e.target.id === 'editBookModal') closeEditBookModal(); });
document.getElementById('visitorBorrowModal')?.addEventListener('click', e => { if (e.target.id === 'visitorBorrowModal') closeVisitorBorrowModal(); });
document.getElementById('detailModal')?.addEventListener('click', e => { if (e.target.id === 'detailModal') closeDetailModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetailModal(); });

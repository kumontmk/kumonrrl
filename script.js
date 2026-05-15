// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Main Application Script (FIXED)
// ═══════════════════════════════════════════════════════════
const JSONBIN_CONFIG = {
    BIN_ID: '6a054b89c0954111d81ee9ae',
    API_KEY: '$2a$10$qpIr10Jqth.YmzBxSKxOGOhrZca7MHe5TVL0CzCc1uzkh/U9A1GHW',
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
// DIAGNOSTICS: Check for file:// and API key issues
// ═══════════════════════════════════════════════════════════
function checkEnvironment() {
    if (window.location.protocol === 'file:') {
        console.error('❌ CRITICAL: Running from file:// blocks API requests.');
        console.error('✅ FIX: Use VS Code Live Server or run: python3 -m http.server 8000');
        showToast('⚠️ Open via HTTP server to enable saving (not file://)', 'error');
        return false;
    }
    if (!JSONBIN_CONFIG.API_KEY.startsWith('$2a$')) {
        console.error('❌ API Key must be a Master Key (starts with $2a$)');
        showToast('❌ Invalid API Key format', 'error');
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
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
function closeAddBook

// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Realtime Database + Storage
// ═══════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref as dbRef, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 1. FIREBASE CONFIG (Spaces trimmed)
const firebaseConfig = {
  apiKey: "AIzaSyBo0DXOWKztyMXUXfPhNyoFo9P_Fu-MEn4",
  authDomain: "kumon-library.firebaseapp.com",
  databaseURL: "https://kumon-library-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kumon-library",
  storageBucket: "kumon-library.firebasestorage.app",
  messagingSenderId: "479472870788",
  appId: "1:479472870788:web:624ae89b2ce853beac29d1",
  measurementId: "G-V4BJ8FP9QR"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const booksRef = dbRef(db, 'books');

// 3. Global State
let books = [];
let isAdmin = false;
let nextId = 1;
let isLoading = false;
let pendingBorrowBookId = null;
let pendingReturnBookId = null;
let selectedBookId = null;
const SESSION_KEY = 'kumon_library_session';

// ═══════════════════════════════════════════════════════════
// DATABASE OPERATIONS (Realtime Database)
// ═══════════════════════════════════════════════════════════
function loadBooks() {
  if (isLoading) return;
  isLoading = true;
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('booksGrid').innerHTML = '';

  onValue(booksRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      books = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      nextId = books.length > 0 ? Math.max(...books.map(b => parseInt(b.id) || 0)) + 1 : 1;
    } else {
      books = [];
      nextId = 1;
    }
    updateStats();
    renderBooks();
    isLoading = false;
    document.getElementById('loadingState').style.display = 'none';
  }, (error) => {
    console.error("Load error:", error);
    showToast("Failed to load library", "error");
    isLoading = false;
    document.getElementById('loadingState').style.display = 'none';
  });
}

async function uploadImage(file, bookId) {
  if (!file) return null;
  const ref = storageRef(storage, `covers/${bookId}`);
  const snapshot = await uploadBytes(ref, file);
  return await getDownloadURL(snapshot.ref);
}

async function addBookToSystem(title, author, genre, location, rrlLevel, coverFile) {
  try {
    const newBookRef = push(booksRef);
    const bookId = newBookRef.key;
    
    await set(newBookRef, {
      title, author, genre: genre || 'Uncategorized', location,
      rrlLevel: rrlLevel || 'N/A', status: 'available',
      borrower: null, borrowDate: null, borrowerGrade: null, borrowerLevel: null,
      lastUpdated: new Date().toISOString()
    });

    if (coverFile) {
      const url = await uploadImage(coverFile, bookId);
      await update(newBookRef, { coverImage: url });
    }

    showToast(`"${title}" added successfully`, 'success');
  } catch (error) {
    console.error("Add error:", error);
    showToast("Failed to save book", "error");
  }
}

async function processAddBook() {
  const btn = document.getElementById('addBookBtn');
  const warningEl = document.getElementById('imageSizeWarning');
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();
  const genre = document.getElementById('newBookGenre').value.trim();
  const location = document.getElementById('newBookLocation').value.trim();
  const rrlLevel = document.getElementById('newBookRRL').value.trim();
  
  if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');
  const file = document.getElementById('newBookCover').files[0];

  try {
    let finalFile = file;
    if (file && file.size > 500 * 1024) {
      warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Auto-compressing...`;
      warningEl.classList.add('show');
      finalFile = await compressImageToBlob(file, 300, 0.2);
    }
    await addBookToSystem(title, author, genre, location, rrlLevel, finalFile);
    closeAddBookModal();
  } catch (error) {
    showToast(`Image error. Adding without image.`, 'error');
    await addBookToSystem(title, author, genre, location, rrlLevel, null);
    closeAddBookModal();
  } finally {
    btn.disabled = false; btn.textContent = 'Save Book'; warningEl.classList.remove('show');
  }
}

async function processEditBook() {
  const btn = document.getElementById('editBookBtn');
  const warningEl = document.getElementById('editImageSizeWarning');
  const id = document.getElementById('editBookId').value;
  const title = document.getElementById('editBookTitle').value.trim();
  const author = document.getElementById('editBookAuthor').value.trim();
  const genre = document.getElementById('editBookGenre').value.trim();
  const location = document.getElementById('editBookLocation').value.trim();
  const rrlLevel = document.getElementById('editBookRRL').value.trim();
  
  if (!title || !author || !location) { showToast('Please fill required fields', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Saving...';
  const file = document.getElementById('editBookCover').files[0];

  try {
    let updates = { title, author, genre: genre || 'Uncategorized', location, rrlLevel: rrlLevel || 'N/A', lastUpdated: new Date().toISOString() };
    
    if (file) {
      const url = await uploadImage(file, id);
      updates.coverImage = url;
    }

    await update(dbRef(db, `books/${id}`), updates);
    showToast(`"${title}" updated`, 'success');
    closeEditBookModal();
  } catch (error) {
    showToast("Update failed", "error");
  } finally {
    btn.disabled = false; btn.textContent = 'Update Book'; warningEl.classList.remove('show');
  }
}

async function removeBook(id) {
  const book = books.find(b => b.id === id);
  if (book && confirm(`Remove "${book.title}"?`)) {
    try {
      await remove(dbRef(db, `books/${id}`));
      showToast(`"${book.title}" removed`, 'success');
    } catch (error) {
      showToast("Delete failed", "error");
    }
  }
}

async function confirmBorrow() {
  const name = document.getElementById('borrowerName').value.trim();
  const grade = document.getElementById('borrowerGrade').value.trim();
  const level = document.getElementById('borrowerLevel').value.trim();
  if (!name || !grade || !level) { showToast('Fill all borrower fields', 'error'); return; }

  const book = books.find(b => b.id === pendingBorrowBookId);
  if (!book) return;

  try {
    await update(dbRef(db, `books/${book.id}`), {
      status: 'borrowed', borrower: name, borrowerGrade: grade,
      borrowerLevel: level, borrowDate: new Date().toISOString().split('T')[0]
    });
    closeBorrowModal();
    showToast(`Borrowed by ${name}`, 'success');
  } catch (error) {
    showToast("Borrow failed", "error");
  }
}

async function returnBook(id) {
  if (!isAdmin) { pendingReturnBookId = id; openLoginModal(); return; }
  const book = books.find(b => b.id === id);
  if (!book) return;

  try {
    await update(dbRef(db, `books/${id}`), {
      status: 'available', borrower: null, borrowerGrade: null,
      borrowerLevel: null, borrowDate: null
    });
    showToast(`"${book.title}" returned`, 'success');
  } catch (error) {
    showToast("Return failed", "error");
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY & UI FUNCTIONS
// ═══════════════════════════════════════════════════════════
function compressImageToBlob(file, maxWidth = 300, quality = 0.2) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > maxWidth) { height = Math.round((maxWidth / width) * height); width = maxWidth; }
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(img.src);
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Image load failed')); };
    img.src = URL.createObjectURL(file);
  });
}

function saveSession() { localStorage.setItem(SESSION_KEY, JSON.stringify({ isAdmin: true, loginTime: new Date().toISOString() })); }
function checkSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.isAdmin === true; } catch { return false; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function setAdminMode(active) {
  isAdmin = active;
  const appEl = document.getElementById('mainApp');
  const indicator = document.getElementById('modeIndicator');
  if (!appEl || !indicator) return;
  if (active) { appEl.classList.add('admin-mode'); indicator.textContent = '🔐 Admin Mode'; indicator.classList.add('admin'); } 
  else { appEl.classList.remove('admin-mode'); indicator.textContent = '👥 Public View'; indicator.classList.remove('admin'); }
  if (selectedBookId) openBookDetail(selectedBookId);
}
function logout() { clearSession(); setAdminMode(false); showToast('Logged out', 'info'); }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function updateStats() {
  document.getElementById('totalBooks').textContent = books.length;
  document.getElementById('availableBooks').textContent = books.filter(b => b.status === 'available').length;
  document.getElementById('borrowedBooks').textContent = books.filter(b => b.status === 'borrowed').length;
}
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Modals
function openLoginModal() { document.getElementById('loginOverlay').classList.add('show'); document.getElementById('passwordInput').focus(); }
function closeLoginModal() { document.getElementById('loginOverlay').classList.remove('show'); document.getElementById('loginError').style.display = 'none'; }
function openBorrowModal(bookId, bookTitle) { if (!isAdmin) { openVisitorBorrowModal(bookId, bookTitle); return; } pendingBorrowBookId = bookId; document.getElementById('borrowBookTitle').textContent = `"${bookTitle}"`; document.getElementById('borrowModal').classList.add('show'); }
function closeBorrowModal() { document.getElementById('borrowModal').classList.remove('show'); pendingBorrowBookId = null; }
function openVisitorBorrowModal(bookId, bookTitle) { pendingBorrowBookId = bookId; document.getElementById('visitorBorrowModal').classList.add('show'); }
function closeVisitorBorrowModal() { document.getElementById('visitorBorrowModal').classList.remove('show'); pendingBorrowBookId = null; }
function openLoginModalFromVisitor() { closeVisitorBorrowModal(); openLoginModal(); }
function openAddBookModal() { if (!isAdmin) { openLoginModal(); return; } ['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL','newBookCover'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); document.getElementById('addBookModal').classList.add('show'); }
function closeAddBookModal() { document.getElementById('addBookModal').classList.remove('show'); }
function openEditModal(bookId) { if (!isAdmin) { openLoginModal(); return; } const book = books.find(b => b.id === bookId); if (!book) return; document.getElementById('editBookId').value = book.id; document.getElementById('editBookTitle').value = book.title; document.getElementById('editBookAuthor').value = book.author; document.getElementById('editBookGenre').value = book.genre || ''; document.getElementById('editBookLocation').value = book.location; document.getElementById('editBookRRL').value = book.rrlLevel || ''; document.getElementById('editBookCover').value = ''; document.getElementById('editBookModal').classList.add('show'); }
function closeEditBookModal() { document.getElementById('editBookModal').classList.remove('show'); }
function openBookDetail(bookId) {
  const book = books.find(b => b.id === bookId); if (!book) return;
  selectedBookId = bookId;
  document.getElementById('detailCoverFull').innerHTML = book.coverImage ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}">` : '<span class="placeholder-large">📘</span>';
  document.getElementById('detailTitle').textContent = book.title;
  document.getElementById('detailAuthor').textContent = `by ${book.author}`;
  document.getElementById('detailGenre').textContent = book.genre || 'Uncategorized';
  document.getElementById('detailLocation').textContent = book.location;
  document.getElementById('detailRRL').textContent = book.rrlLevel || 'N/A';
  document.getElementById('detailID').textContent = `#${book.id}`;
  const statusEl = document.getElementById('detailStatus'); statusEl.textContent = book.status === 'available' ? '✓ Available' : '📤 Borrowed'; statusEl.className = `detail-status ${book.status}`;
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
  document.getElementById('detailModal').classList.add('show'); document.body.style.overflow = 'hidden';
}
function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); document.body.style.overflow = ''; selectedBookId = null; }
function goHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function handleDetailBorrow() { if (selectedBookId) { const book = books.find(b => b.id === selectedBookId); if (book) { closeDetailModal(); openBorrowModal(book.id, book.title); } } }
function handleDetailReturn() { if (selectedBookId) { returnBook(selectedBookId); closeDetailModal(); } }
function handleDetailRemove() { if (selectedBookId) { const book = books.find(b => b.id === selectedBookId); if (book && confirm(`Remove "${book.title}"?`)) { removeBook(selectedBookId); closeDetailModal(); } } }

function login() {
  const password = document.getElementById('passwordInput').value;
  if (password === '1111') {
    saveSession(); setAdminMode(true); closeLoginModal(); document.getElementById('passwordInput').value = '';
    if (pendingBorrowBookId) { const book = books.find(b => b.id === pendingBorrowBookId); if (book) openBorrowModal(book.id, book.title); pendingBorrowBookId = null; }
    if (pendingReturnBookId) { returnBook(pendingReturnBookId); pendingReturnBookId = null; }
    showToast('✅ Admin mode activated', 'success');
  } else { document.getElementById('loginError').style.display = 'block'; setTimeout(() => { document.getElementById('loginError').style.display = 'none'; }, 2000); }
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
    if (sortBy === 'rrl') return (a.rrlLevel || 'Z').localeCompare(b.rrlLevel || 'Z', undefined, { numeric: true });
    return 0;
  });
  return filtered;
}

function renderBooks() {
  const grid = document.getElementById('booksGrid');
  const emptyState = document.getElementById('emptyState');
  const filteredBooks = getFilteredAndSortedBooks();
  
  if (filteredBooks.length === 0 && books.length > 0) { 
    grid.innerHTML = ''; emptyState.style.display = 'block'; emptyState.querySelector('h2').textContent = 'No matching books'; emptyState.querySelector('p').textContent = 'Try adjusting your search or filter'; return; 
  }
  if (books.length === 0) { 
    grid.innerHTML = ''; emptyState.style.display = 'block'; emptyState.querySelector('h2').textContent = '📚 Library is empty'; emptyState.querySelector('p').textContent = isAdmin ? 'Click ➕ to add your first book' : 'Check back soon!'; return;  
  }
  emptyState.style.display = 'none';

  grid.innerHTML = filteredBooks.map(book => `
    <div class="book-card ${book.status}" onclick="openBookDetail('${book.id}')">
      ${book.coverImage ? `<img src="${book.coverImage}" class="book-cover" alt="${escapeHtml(book.title)}" onerror="this.parentElement.innerHTML='<div class=\'book-cover\'>📘</div>'">` : `<div class="book-cover">📘</div>`}
      <div class="book-title">${escapeHtml(book.title)}</div>
      <div class="book-author">by ${escapeHtml(book.author)}</div>
      <div class="book-location">📍 ${escapeHtml(book.location)}</div>
      <div class="book-meta">
        <span>${escapeHtml(book.genre)}</span><span>•</span>
        <span class="rrl-badge">RRL: ${escapeHtml(book.rrlLevel || 'N/A')}</span><span>•</span>
        <span>ID: ${book.id}</span>
      </div>
      <span class="status-badge ${book.status}">${book.status === 'available' ? '✓ Available' : '📤 Borrowed'}</span>
      ${book.status === 'borrowed' ? `<div style="margin-top:0.5rem;"><span class="borrower-badge">${escapeHtml(book.borrower)}</span><br><small style="color:#64748b;display:block;margin-top:0.25rem">Grade: ${escapeHtml(book.borrowerGrade)} • Level: ${escapeHtml(book.borrowerLevel)}</small><small style="color:#94a3b8;display:block">Since: ${book.borrowDate}</small></div>` : ''}
      <div class="book-actions" onclick="event.stopPropagation()">
        ${book.status === 'available' ? `<button class="btn btn-primary" onclick="openBorrowModal('${book.id}', '${escapeHtml(book.title).replace(/'/g, "\\'")}')">📚 Borrow</button>` : `<button class="btn btn-success" onclick="returnBook('${book.id}')">✅ Return</button>`}
        <button class="btn btn-primary btn-small admin-only" onclick="openEditModal('${book.id}')" style="background:#7c3aed">✏️ Edit</button>
        <button class="btn btn-danger btn-small admin-only" onclick="removeBook('${book.id}')">🗑 Remove</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION & EVENT LISTENERS
// ═══════════════════════════════════════════════════════════
function initApp() {
  if (checkSession()) { setAdminMode(true); showToast('✅ Admin session restored', 'info'); } 
  else { setAdminMode(false); }
  loadBooks();
}
document.addEventListener('DOMContentLoaded', initApp);
document.getElementById('passwordInput').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
document.getElementById('searchInput').addEventListener('input', renderBooks);
document.getElementById('filterStatus').addEventListener('change', renderBooks);
document.getElementById('sortBy').addEventListener('change', renderBooks);

document.getElementById('newBookCover')?.addEventListener('change', function(e) {
  const file = e.target.files[0]; const warningEl = document.getElementById('imageSizeWarning');
  if (file && file.size > 500 * 1024) { warningEl.textContent = `⚠️ Large image. Will auto-compress.`; warningEl.classList.add('show'); } 
  else { warningEl.classList.remove('show'); }
});
document.getElementById('editBookCover')?.addEventListener('change', function(e) {
  const file = e.target.files[0]; const warningEl = document.getElementById('editImageSizeWarning');
  if (file && file.size > 500 * 1024) { warningEl.textContent = `⚠️ Large image. Will auto-compress.`; warningEl.classList.add('show'); } 
  else { warningEl.classList.remove('show'); }
});

['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL'].forEach(id => document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processAddBook(); }));
['editBookTitle','editBookAuthor','editBookGenre','editBookLocation','editBookRRL'].forEach(id => document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processEditBook(); }));

['loginOverlay','borrowModal','addBookModal','editBookModal','visitorBorrowModal','detailModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) { if(id==='detailModal')closeDetailModal(); else if(id==='loginOverlay')closeLoginModal(); else if(id==='borrowModal')closeBorrowModal(); else if(id==='addBookModal')closeAddBookModal(); else if(id==='editBookModal')closeEditBookModal(); else if(id==='visitorBorrowModal')closeVisitorBorrowModal(); } });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetailModal(); });

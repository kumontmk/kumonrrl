// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Firebase Realtime Database Version
// ═══════════════════════════════════════════════════════════

// Firebase Configuration
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const BOOKS_REF = database.ref('books');

// App State
const SESSION_KEY = 'kumonLibrarySession';
let books = [];
let nextId = 1;
let isLoading = false;
let isAdmin = false;
let pendingBorrowBookId = null;
let pendingReturnBookId = null;
let selectedBookId = null;
let hasUnsavedChanges = false;

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function compressImage(file, maxWidth = 300, quality = 0.2) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(img.src);
      resolve(compressed);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Image load failed'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ 
    isAdmin: true, 
    loginTime: new Date().toISOString() 
  }));
}

function checkSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.isAdmin === true;
  } catch {
    return false;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function setAdminMode(active) {
  isAdmin = active;
  const app = document.getElementById('mainApp');
  const indicator = document.getElementById('modeIndicator');
  
  if (active) {
    app.classList.add('admin-mode');
    indicator.textContent = '🔐 Admin Mode';
    indicator.classList.add('admin');
  } else {
    app.classList.remove('admin-mode');
    indicator.textContent = '👥 Public View';
    indicator.classList.remove('admin');
  }
  updateDetailModalVisibility();
}

function updateDetailModalVisibility() {
  if (selectedBookId) openBookDetail(selectedBookId);
}

function logout() {
  clearSession();
  setAdminMode(false);
  showToast('Logged out - now in Public View', 'info');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setUnsavedChanges(state) {
  hasUnsavedChanges = state;
  const indicator = document.getElementById('unsavedIndicator');
  if (indicator) {
    indicator.style.display = state ? 'inline' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════
// PAGE EXIT CONFIRMATION
// ═══════════════════════════════════════════════════════════
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// ═══════════════════════════════════════════════════════════
// MODAL FUNCTIONS (Unchanged - copy from original)
// ═══════════════════════════════════════════════════════════
// [Keep all your existing modal functions: openLoginModal, closeLoginModal, 
//  openBorrowModal, closeBorrowModal, openVisitorBorrowModal, etc.]
// For brevity, I'm not repeating them here - just copy from your original script.js

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════
function login() {
  const password = document.getElementById('passwordInput').value;
  if (password === '1111') {
    saveSession();
    setAdminMode(true);
    closeLoginModal();
    document.getElementById('passwordInput').value = '';
    
    if (pendingBorrowBookId) { 
      const book = books.find(b => b.id === pendingBorrowBookId); 
      if (book) openBorrowModal(book.id, book.title); 
      pendingBorrowBookId = null; 
    }
    if (pendingReturnBookId) { 
      returnBook(pendingReturnBookId); 
      pendingReturnBookId = null; 
    }
    showToast('✅ Admin mode activated', 'success');
  } else {
    document.getElementById('loginError').style.display = 'block';
    setTimeout(() => { 
      document.getElementById('loginError').style.display = 'none'; 
    }, 2000);
  }
}

// ═══════════════════════════════════════════════════════════
// FIREBASE DATA OPERATIONS ⭐ KEY CHANGES
// ═══════════════════════════════════════════════════════════

async function loadBooks() {
  if (isLoading) return;
  isLoading = true;
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('booksGrid').innerHTML = '';
  
  try {
    const snapshot = await BOOKS_REF.once('value');
    const data = snapshot.val();
    
    // Firebase stores as object { "1": {...}, "2": {...} }, convert to array
    if (data) {
      books = Object.values(data);
      // Ensure nextId is higher than any existing ID
      const maxId = Math.max(...books.map(b => b.id), 0);
      nextId = maxId + 1;
    } else {
      books = [];
      nextId = 1;
    }
    
    updateStats();
    renderBooks();
    
    if (books.length > 0) {
      showToast(`✅ Loaded ${books.length} books`, 'success');
    }
    
  } catch (error) {
    console.error('Load error:', error);
    showToast(`Failed to load: ${error.message}`, 'error');
    books = [];
    renderBooks();
  } finally {
    isLoading = false;
    document.getElementById('loadingState').style.display = 'none';
    setUnsavedChanges(false);
  }
}

async function saveBooks() {
  try {
    // Convert array to object with ID keys for Firebase
    const booksObj = {};
    books.forEach(book => {
      booksObj[book.id] = book;
    });
    
    await BOOKS_REF.set(booksObj);
    return true;
  } catch (error) {
    console.error('Save error:', error);
    showToast(`Save failed: ${error.message}`, 'error');
    return false;
  }
}

async function testConnection() {
  showToast('Testing Firebase connection...', 'info');
  try {
    const snapshot = await BOOKS_REF.once('value');
    const data = snapshot.val();
    const count = data ? Object.keys(data).length : 0;
    showToast(`✅ Connected! ${count} books in database`, 'success');
  } catch (error) {
    showToast(`❌ Error: ${error.message}`, 'error');
  }
}

function exportBackup() {
  if (books.length === 0) { 
    showToast('No books to export', 'info'); 
    return; 
  }
  const blob = new Blob([JSON.stringify(books, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kumon-library-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded!', 'success');
}

function updateStats() {
  document.getElementById('totalBooks').textContent = books.length;
  document.getElementById('availableBooks').textContent = 
    books.filter(b => b.status === 'available').length;
  document.getElementById('borrowedBooks').textContent = 
    books.filter(b => b.status === 'borrowed').length;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════════════════════
// BOOK MANAGEMENT (Same logic, just calls Firebase saveBooks)
// ═══════════════════════════════════════════════════════════

async function processAddBook() {
  const btn = document.getElementById('addBookBtn');
  const warningEl = document.getElementById('imageSizeWarning');
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();
  const genre = document.getElementById('newBookGenre').value.trim();
  const location = document.getElementById('newBookLocation').value.trim();
  const rrlLevel = document.getElementById('newBookRRL').value.trim();
  
  if (!title || !author || !location) { 
    showToast('Please fill in title, author, and location', 'error'); 
    return; 
  }

  btn.disabled = true; 
  btn.textContent = 'Saving...'; 
  warningEl.classList.remove('show');
  const file = document.getElementById('newBookCover').files[0];

  try {
    let coverImage = null;
    if (file) {
      if (file.size > 500 * 1024) { 
        warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Auto-compressing...`; 
        warningEl.classList.add('show'); 
      }
      coverImage = await compressImage(file, 300, 0.2);
    }
    await addBookToSystem(title, author, genre, location, rrlLevel, coverImage);
    closeAddBookModal();
  } catch (error) {
    console.error('Image error:', error);
    showToast(`Image error. Adding without image.`, 'error');
    await addBookToSystem(title, author, genre, location, rrlLevel, null);
    closeAddBookModal();
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Save Book'; 
    warningEl.classList.remove('show');
  }
}

async function addBookToSystem(title, author, genre, location, rrlLevel, coverImage) {
  const newBook = {
    id: nextId++,
    title,
    author,
    genre: genre || 'Uncategorized',
    location,
    rrlLevel: rrlLevel || 'N/A',
    coverImage,
    status: 'available',
    borrower: null,
    borrowDate: null,
    borrowerGrade: null,
    borrowerLevel: null
  };
  
  books.unshift(newBook);
  
  if (await saveBooks()) {
    updateStats();
    renderBooks();
    showToast(`"${title}" added successfully`, 'success');
    setUnsavedChanges(false);
  }
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
  
  if (!title || !author || !location) { 
    showToast('Please fill in title, author, and location', 'error'); 
    return; 
  }

  const book = books.find(b => b.id === id);
  if (!book) return;

  btn.disabled = true; 
  btn.textContent = 'Saving...'; 
  warningEl.classList.remove('show');

  try {
    let coverImage = book.coverImage;
    const file = fileInput.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Auto-compressing...`;
        warningEl.classList.add('show');
      }
      coverImage = await compressImage(file, 300, 0.2);
    }

    book.title = title;
    book.author = author;
    book.genre = genre || 'Uncategorized';
    book.location = location;
    book.rrlLevel = rrlLevel || 'N/A';
    book.coverImage = coverImage;

    if (await saveBooks()) {
      closeEditBookModal();
      renderBooks();
      openBookDetail(id);
      showToast(`"${title}" updated successfully`, 'success');
      setUnsavedChanges(false);
    }
  } catch (error) {
    console.error('Edit error:', error);
    showToast(`Error updating book: ${error.message}`, 'error');
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Update Book'; 
    warningEl.classList.remove('show');
  }
}

async function removeBook(id) {
  const book = books.find(b => b.id === id);
  if (book && confirm(`Remove "${book.title}"?`)) {
    books = books.filter(b => b.id !== id);
    if (await saveBooks()) {
      updateStats();
      renderBooks();
      showToast(`"${book.title}" removed`, 'success');
      setUnsavedChanges(false);
    }
  }
}

async function confirmBorrow() {
  const name = document.getElementById('borrowerName').value.trim();
  const grade = document.getElementById('borrowerGrade').value.trim();
  const level = document.getElementById('borrowerLevel').value.trim();
  
  if (!name || !grade || !level) { 
    showToast('Please fill in all borrower fields', 'error'); 
    return; 
  }

  const book = books.find(b => b.id === pendingBorrowBookId);
  if (book) {
    book.status = 'borrowed';
    book.borrower = name;
    book.borrowerGrade = grade;
    book.borrowerLevel = level;
    book.borrowDate = new Date().toISOString().split('T')[0];
    
    if (await saveBooks()) {
      closeBorrowModal();
      renderBooks();
      updateStats();
      showToast(`"${book.title}" borrowed by ${name} (${grade}, ${level})`, 'success');
      setUnsavedChanges(false);
    }
  }
}

async function returnBook(id) {
  if (!isAdmin) { 
    pendingReturnBookId = id; 
    openLoginModal(); 
    return; 
  }
  
  const book = books.find(b => b.id === id);
  if (book) {
    const info = `${book.borrower} (${book.borrowerGrade}, ${book.borrowerLevel})`;
    book.status = 'available';
    book.borrower = null;
    book.borrowerGrade = null;
    book.borrowerLevel = null;
    book.borrowDate = null;
    
    if (await saveBooks()) {
      renderBooks();
      updateStats();
      showToast(`✅ "${book.title}" returned by ${info}`, 'success');
      setUnsavedChanges(false);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RENDERING & FILTERING (Unchanged)
// ═══════════════════════════════════════════════════════════
// [Copy your existing getFilteredAndSortedBooks() and renderBooks() functions]
// They work the same way - just ensure you keep the full functions from original

// ═══════════════════════════════════════════════════════════
// INITIALIZATION & EVENT LISTENERS
// ═══════════════════════════════════════════════════════════
function initApp() {
  if (checkSession()) {
    setAdminMode(true);
    showToast('✅ Admin session restored', 'info');
  } else {
    setAdminMode(false);
  }
  loadBooks();
}

document.addEventListener('DOMContentLoaded', initApp);

// [Keep all your existing event listeners from original script.js]
// passwordInput keypress, searchInput, filterStatus, sortBy, file inputs, modal clicks, etc.

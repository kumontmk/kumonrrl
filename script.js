// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Firebase Realtime Version
// ═══════════════════════════════════════════════════════════
// ✅ FIX: Removed trailing spaces in config keys that could cause connection errors
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
let selectedRating = 0;

// Barcode Scanner Instance
let html5QrCode = null;
let isScanning = false;

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function compressImage(file, maxWidth = 300, quality = 0.2) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > maxWidth) { height = Math.round((maxWidth / width) * height); width = maxWidth; }
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(img.src);
      resolve(compressed);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Image load failed')); };
    img.src = URL.createObjectURL(file);
  });
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ isAdmin: true, loginTime: new Date().toISOString() }));
}

function checkSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.isAdmin === true; }
  catch { return false; }
}

function clearSession() { localStorage.removeItem(SESSION_KEY); }

function setAdminMode(active) {
  isAdmin = active;
  document.body.classList.toggle('admin-mode', active);
  if (active) hasUnsavedChanges = false;
  
  const indicators = ['modeIndicator', 'mobileModeIndicator'];
  indicators.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = active ? '🔐 Admin Mode' : '👥 Public View';
      el.classList.toggle('admin', active);
    }
  });

  updateUnsavedIndicator();
  updateDetailModalVisibility();
}

function updateUnsavedIndicator() {
  const show = isAdmin && hasUnsavedChanges;
  ['unsavedIndicator', 'mobileUnsavedIndicator'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', show);
  });
}

function setUnsavedChanges(state) {
  hasUnsavedChanges = state;
  updateUnsavedIndicator();
}

function updateDetailModalVisibility() {
  if (selectedBookId) openBookDetail(selectedBookId);
}

function logout() {
  clearSession();
  setAdminMode(false);
  closeMobileMenu();
  renderBooks();
  updateDetailModalVisibility();
  showToast('Logged out - now in Public View', 'info');
}

// ═══════════════════════════════════════════════════════════
// BARCODE SCANNER FUNCTIONS
// ═══════════════════════════════════════════════════════════
async function startBarcodeScanner() {
  const readerDiv = document.getElementById('barcode-reader');
  const stopBtn = document.getElementById('stopScanBtn');
  const startBtn = document.getElementById('startScanBtn');
  
  if (isScanning) return;
  
  readerDiv.style.display = 'block';
  stopBtn.style.display = 'inline-block';
  startBtn.style.display = 'none';
  
  try {
    html5QrCode = new Html5Qrcode("barcode-reader");
    await html5QrCode.start(
      { facingMode: "environment" }, // Forces back camera on mobile
      {
        fps: 10,
        qrbox: { width: 250, height: 150 }
      },
      onScanSuccess,
      onScanFailure
    );
    isScanning = true;
    showToast('📷 Camera started. Point at ISBN barcode.', 'info');
  } catch (err) {
    console.error("Failed to start scanner", err);
    showToast('❌ Failed to start camera. Check permissions.', 'error');
    stopBarcodeScanner();
  }
}

function stopBarcodeScanner() {
  if (html5QrCode && isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
      isScanning = false;
      document.getElementById('barcode-reader').style.display = 'none';
      document.getElementById('stopScanBtn').style.display = 'none';
      document.getElementById('startScanBtn').style.display = 'inline-block';
    }).catch(err => {
      console.error("Failed to stop scanner", err);
    });
  }
}

function onScanSuccess(decodedText, decodedResult) {
  // Clean ISBN (remove dashes and spaces)
  const isbn = decodedText.replace(/[-\s]/g, '');
  
  // Validate ISBN-13 or ISBN-10
  if (isbn.match(/^\d{10,13}$/)) {
    stopBarcodeScanner();
    document.getElementById('newBookTitle').value = `ISBN: ${isbn}`;
    showToast(`✅ Scanned ISBN: ${isbn}`, 'success');
    // Auto-fetch book info using ISBN
    fetchBookByISBN(isbn);
  } else {
    // Ignore non-ISBN barcodes
    return;
  }
}

function onScanFailure(error) {
  // Ignore scan failures during continuous scanning
}

async function fetchBookByISBN(isbn) {
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();
    
    if (data.totalItems > 0) {
      const book = data.items[0].volumeInfo;
      document.getElementById('newBookTitle').value = book.title || `ISBN: ${isbn}`;
      document.getElementById('newBookAuthor').value = book.authors ? book.authors.join(', ') : '';
      
      // Fix genre extraction
      let genre = '';
      if (book.categories && book.categories.length > 0) {
        const cat = book.categories[0];
        genre = typeof cat === 'string' ? cat : (cat.name || cat.title || String(cat));
      }
      document.getElementById('newBookGenre').value = genre;

      if (book.imageLinks?.thumbnail) {
        fetchAndSetCover(book.imageLinks.thumbnail.replace('http:', 'https:'));
      }
    }
  } catch (error) {
    console.error('Fetch error:', error);
    // Do not show error, just let user type manually
  }
}

async function fetchAndSetCover(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('newBookCover').files = dataTransfer.files;
    
    const warningEl = document.getElementById('imageSizeWarning');
    if (file.size > 500 * 1024) {
      warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Will compress on save.`;
      warningEl.classList.add('show');
    }
  } catch (error) {
    console.error('Cover fetch error:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// MOBILE MENU FUNCTIONS
// ═══════════════════════════════════════════════════════════
function toggleMobileMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('show');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu')?.classList.remove('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.querySelector('.hamburger-btn');
  if (menu?.classList.contains('show') && !menu.contains(e.target) && !hamburger?.contains(e.target)) {
    closeMobileMenu();
  }
});

// ═══════════════════════════════════════════════════════════
// CAROUSEL LOGIC
// ═══════════════════════════════════════════════════════════
let currentSlide = 0;
let carouselInterval;

function initCarousel() {
  const slides = document.querySelectorAll('.carousel-slide');
  const dotsContainer = document.querySelector('.carousel-dots');
  slides.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.classList.add('dot');
    if (index === 0) dot.classList.add('active');
    dot.onclick = () => goToSlide(index);
    dotsContainer.appendChild(dot);
  });
  startCarouselAutoPlay();
}

function updateCarousel() {
  const track = document.querySelector('.carousel-track');
  const dots = document.querySelectorAll('.dot');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  dots.forEach((dot, index) => dot.classList.toggle('active', index === currentSlide));
}

function moveSlide(direction) {
  const slides = document.querySelectorAll('.carousel-slide');
  currentSlide = (currentSlide + direction + slides.length) % slides.length;
  updateCarousel();
  resetCarouselAutoPlay();
}

function goToSlide(index) {
  currentSlide = index;
  updateCarousel();
  resetCarouselAutoPlay();
}

function startCarouselAutoPlay() {
  carouselInterval = setInterval(() => moveSlide(1), 5000);
}

function resetCarouselAutoPlay() {
  clearInterval(carouselInterval);
  startCarouselAutoPlay();
}

document.querySelector('.banner-carousel')?.addEventListener('mouseenter', () => clearInterval(carouselInterval));
document.querySelector('.banner-carousel')?.addEventListener('mouseleave', () => startCarouselAutoPlay());

// ═══════════════════════════════════════════════════════════
// RATING SYSTEM
// ═══════════════════════════════════════════════════════════
function getAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return (sum / ratings.length).toFixed(1);
}

function selectRating(val) {
  selectedRating = val;
  document.querySelectorAll('#detailStars .star-btn').forEach((btn, index) => {
    btn.classList.toggle('active', index < val);
  });
}

async function submitRating() {
  if (selectedRating === 0) { showToast('Please select a rating', 'error'); return; }
  const book = books.find(b => b.id === selectedBookId);
  if (book) {
    book.ratings = book.ratings || [];
    book.ratings.push(selectedRating);
    if (await saveBooksToFirebase()) {
      showToast('Rating submitted!', 'success');
      openBookDetail(selectedBookId);
      renderBooks();
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PAGE EXIT & BACK BUTTON CONFIRMATION
// ═══════════════════════════════════════════════════════════
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; return ''; }
});

// ═══════════════════════════════════════════════════════════
// MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════
function openLoginModal() {
  document.getElementById('loginOverlay').classList.add('show');
  document.getElementById('passwordInput').focus();
}

function closeLoginModal() {
  document.getElementById('loginOverlay').classList.remove('show');
  document.getElementById('loginError').style.display = 'none';
}

function openBorrowModal(bookId, bookTitle) {
  if (!isAdmin) { openVisitorBorrowModal(bookId, bookTitle); return; }
  pendingBorrowBookId = bookId;
  document.getElementById('borrowBookTitle').textContent = `"${bookTitle}"`;
  ['borrowerName','borrowerGrade','borrowerLevel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('borrowerPhone').value = '';
  document.getElementById('borrowerCenter').value = '';
  document.getElementById('borrowModal').classList.add('show');
  document.getElementById('borrowerName').focus();
  setUnsavedChanges(true);
}

function closeBorrowModal() {
  document.getElementById('borrowModal').classList.remove('show');
  pendingBorrowBookId = null;
  setUnsavedChanges(false);
}

function openVisitorBorrowModal(bookId, bookTitle) {
  pendingBorrowBookId = bookId;
  document.getElementById('visitorBorrowModal').classList.add('show');
}

function closeVisitorBorrowModal() {
  document.getElementById('visitorBorrowModal').classList.remove('show');
  pendingBorrowBookId = null;
}

function openLoginModalFromVisitor() {
  closeVisitorBorrowModal();
  openLoginModal();
}

function openAddBookModal() {
  if (!isAdmin) { openLoginModal(); return; }
  ['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL','newBookCover'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('imageSizeWarning').classList.remove('show');
  document.getElementById('barcode-reader').style.display = 'none';
  stopBarcodeScanner();
  document.getElementById('addBookModal').classList.add('show');
  document.getElementById('newBookTitle').focus();
  setUnsavedChanges(true);
}

function closeAddBookModal() {
  stopBarcodeScanner();
  document.getElementById('addBookModal').classList.remove('show');
  setUnsavedChanges(false);
}

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

function closeEditBookModal() {
  document.getElementById('editBookModal').classList.remove('show');
  setUnsavedChanges(false);
}

function openRRLInfoModal() {
  document.getElementById('rrlInfoModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeRRLInfoModal() {
  document.getElementById('rrlInfoModal').classList.remove('show');
  document.body.style.overflow = '';
}

function openBookDetail(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  selectedBookId = bookId;
  
  const coverEl = document.getElementById('detailCoverFull');
  coverEl.innerHTML = book.coverImage 
    ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}">` 
    : '<span class="placeholder-large">📘</span>';
    
  document.getElementById('detailTitle').textContent = book.title;
  document.getElementById('detailAuthor').textContent = `by ${book.author}`;
  document.getElementById('detailGenre').textContent = book.genre || 'Uncategorized';
  document.getElementById('detailLocation').textContent = book.location;
  document.getElementById('detailRRL').textContent = book.rrlLevel || 'N/A';
  document.getElementById('detailID').textContent = `#${book.id}`;
  
  const isBorrowed = (book.status || '').toLowerCase().trim() === 'borrowed';
  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = isBorrowed ? '📤 Borrowed' : '✓ Available';
  statusEl.className = `detail-status ${isBorrowed ? 'borrowed' : 'available'}`;
  
  const borrowerSection = document.getElementById('detailBorrowerSection');
  if (isBorrowed && book.borrower && isAdmin) {
    borrowerSection.style.display = 'block';
    document.getElementById('detailBorrowerName').textContent = book.borrower;
    document.getElementById('detailBorrowerGrade').textContent = book.borrowerGrade || '-';
    document.getElementById('detailBorrowerLevel').textContent = book.borrowerLevel || '-';
    document.getElementById('detailBorrowerPhone').textContent = book.borrowerPhone || '-';
    document.getElementById('detailBorrowerCenter').textContent = book.borrowerCenter || 'No Center';
    document.getElementById('detailBorrowDate').textContent = book.borrowDate || '-';
  } else {
    borrowerSection.style.display = 'none';
  }
  
  selectedRating = 0;
  document.querySelectorAll('#detailStars .star-btn').forEach(btn => btn.classList.remove('active'));
  const avg = getAverageRating(book.ratings);
  const count = (book.ratings || []).length;
  document.getElementById('detailRatingSummary').textContent = count > 0 ? `Overall: ⭐ ${avg} (${count} ratings)` : 'No ratings yet';
  
  const returnBtn = document.getElementById('detailReturnBtn');
  const borrowBtn = document.getElementById('detailBorrowBtn');
  if (isBorrowed) {
    returnBtn.style.setProperty('display', 'flex', 'important');
    borrowBtn.style.setProperty('display', 'none', 'important');
  } else {
    returnBtn.style.setProperty('display', 'none', 'important');
    borrowBtn.style.setProperty('display', 'flex', 'important');
  }
  
  document.getElementById('detailModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show');
  document.body.style.overflow = '';
  selectedBookId = null;
}

function handleDetailBorrow() {
  if (selectedBookId) {
    const book = books.find(b => b.id === selectedBookId);
    if (book) { closeDetailModal(); openBorrowModal(book.id, book.title); }
  }
}

function handleDetailReturn() {
  if (selectedBookId) { returnBook(selectedBookId); closeDetailModal(); }
}

function handleDetailRemove() {
  if (selectedBookId) {
    const book = books.find(b => b.id === selectedBookId);
    if (book && confirm(`Remove "${book.title}"?`)) { removeBook(selectedBookId); closeDetailModal(); }
  }
}

function handleDetailEdit() {
  if (!selectedBookId) return;
  const bookId = selectedBookId;
  closeDetailModal();
  openEditModal(bookId);
}

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════
function login() {
  const password = document.getElementById('passwordInput').value;
  if (password === '1111') {
    saveSession();
    setAdminMode(true);
    renderBooks();
    closeLoginModal();
    closeMobileMenu();
    document.getElementById('passwordInput').value = '';
    if (pendingBorrowBookId) {
      const book = books.find(b => b.id === pendingBorrowBookId);
      if (book) openBorrowModal(book.id, book.title);
      pendingBorrowBookId = null;
    }
    if (pendingReturnBookId) { returnBook(pendingReturnBookId); pendingReturnBookId = null; }
    showToast('✅ Admin mode activated', 'success');
  } else {
    document.getElementById('loginError').style.display = 'block';
    setTimeout(() => { document.getElementById('loginError').style.display = 'none'; }, 2000);
  }
}

// ═══════════════════════════════════════════════════════════
// FIREBASE REALTIME OPERATIONS
// ═══════════════════════════════════════════════════════════
function startRealtimeSync() {
  BOOKS_REF.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      books = Object.values(data).map(b => {
        b.ratings = b.ratings || [];
        return b;
      });
      books.sort((a, b) => b.id - a.id);
      const maxId = Math.max(...books.map(b => b.id), 0);
      nextId = maxId + 1;
    } else {
      books = [];
      nextId = 1;
    }
    updateStats();
    renderBooks();
    document.getElementById('loadingState').style.display = 'none';
    setUnsavedChanges(false);
  }, (error) => {
    console.error('Firebase sync error:', error);
    showToast('Connection lost. Retrying...', 'error');
  });
}

async function saveBooksToFirebase() {
  try {
    const booksObj = {};
    books.forEach(book => { booksObj[book.id] = book; });
    await BOOKS_REF.set(booksObj);
    return true;
  } catch (error) {
    console.error('Save error:', error);
    showToast(`Save failed: ${error.message}`, 'error');
    return false;
  }
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
  const btn = document.getElementById('addBookBtn');
  const warningEl = document.getElementById('imageSizeWarning');
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();
  const genre = document.getElementById('newBookGenre').value.trim();
  const location = document.getElementById('newBookLocation').value.trim();
  const rrlLevel = document.getElementById('newBookRRL').value;
  
  if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }
  
  btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');
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
    btn.disabled = false; btn.textContent = 'Save Book'; warningEl.classList.remove('show');
  }
}

async function addBookToSystem(title, author, genre, location, rrlLevel, coverImage) {
  const newBook = {
    id: nextId++, title, author,
    genre: genre || 'Uncategorized', location,
    rrlLevel: rrlLevel || 'N/A', coverImage,
    status: 'available',
    ratings: [],
    borrower: null, borrowDate: null, borrowerGrade: null, borrowerLevel: null, borrowerPhone: null, borrowerCenter: null
  };
  books.unshift(newBook);
  if (await saveBooksToFirebase()) {
    updateStats(); renderBooks();
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
  const rrlLevel = document.getElementById('editBookRRL').value;
  const fileInput = document.getElementById('editBookCover');
  
  if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }
  const book = books.find(b => b.id === id);
  if (!book) return;
  
  btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');
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
    book.title = title; book.author = author;
    book.genre = genre || 'Uncategorized'; book.location = location;
    book.rrlLevel = rrlLevel || 'N/A'; book.coverImage = coverImage;

    if (await saveBooksToFirebase()) {
      closeEditBookModal(); renderBooks(); openBookDetail(id);
      showToast(`"${title}" updated successfully`, 'success');
      setUnsavedChanges(false);
    }
  } catch (error) {
    console.error('Edit error:', error);
    showToast(`Error updating book: ${error.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Update Book'; warningEl.classList.remove('show');
  }
}

async function removeBook(id) {
  const book = books.find(b => b.id === id);
  if (book && confirm(`Remove "${book.title}"?`)) {
    books = books.filter(b => b.id !== id);
    if (await saveBooksToFirebase()) {
      updateStats(); renderBooks();
      showToast(`"${book.title}" removed`, 'success');
      setUnsavedChanges(false);
    }
  }
}

async function confirmBorrow() {
  const name = document.getElementById('borrowerName').value.trim();
  const grade = document.getElementById('borrowerGrade').value.trim();
  const level = document.getElementById('borrowerLevel').value.trim();
  const phoneInput = document.getElementById('borrowerPhone').value.trim().replace(/\D/g, '');
  const center = document.getElementById('borrowerCenter').value;
  
  if (!name || !grade || !level) { showToast('Please fill in all fields', 'error'); return; }
  if (!phoneInput || phoneInput.length < 6) { showToast('Please enter a valid phone number', 'error'); return; }
  
  const book = books.find(b => b.id === pendingBorrowBookId);
  if (book) {
    book.status = 'borrowed';
    book.borrower = name;
    book.borrowerGrade = grade;
    book.borrowerLevel = level;
    book.borrowerPhone = `+853 ${phoneInput}`;
    book.borrowerCenter = center || null;
    book.borrowDate = new Date().toISOString().split('T')[0];
    if (await saveBooksToFirebase()) {
      closeBorrowModal(); renderBooks(); updateStats();
      showToast(`"${book.title}" borrowed by ${name}`, 'success');
      setUnsavedChanges(false);
    }
  }
}

async function returnBook(id) {
  if (!isAdmin) { pendingReturnBookId = id; openLoginModal(); return; }
  const book = books.find(b => b.id === id);
  if (book) {
    const info = `${book.borrower} (${book.borrowerGrade}, ${book.borrowerLevel})`;
    book.status = 'available';
    book.borrower = null; book.borrowerGrade = null; book.borrowerLevel = null;
    book.borrowerPhone = null; book.borrowerCenter = null; book.borrowDate = null;
    if (await saveBooksToFirebase()) {
      renderBooks(); updateStats();
      showToast(`✅ "${book.title}" returned by ${info}`, 'success');
      setUnsavedChanges(false);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RENDERING & FILTERING
// ═══════════════════════════════════════════════════════════
function getFilteredAndSortedBooks() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterStatus = document.getElementById('filterStatus').value;
  const filterRRL = document.getElementById('filterRRL').value;
  const sortBy = document.getElementById('sortBy').value;
  
  let filtered = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm) ||
      book.location.toLowerCase().includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || book.status === filterStatus;
    const matchesRRL = filterRRL === '' || book.rrlLevel === filterRRL;
    return matchesSearch && matchesStatus && matchesRRL;
  });
  
  filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'rrl') {
      const levelA = (a.rrlLevel || 'Z').toUpperCase();
      const levelB = (b.rrlLevel || 'Z').toUpperCase();
      return levelA.localeCompare(levelB, undefined, { numeric: true });
    }
    return 0;
  });
  return filtered;
}

function renderBooks() {
  const grid = document.getElementById('booksGrid');
  const emptyState = document.getElementById('emptyState');
  const filteredBooks = getFilteredAndSortedBooks();
  
  if (filteredBooks.length === 0 && books.length > 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.querySelector('h2').textContent = 'No matching books';
    emptyState.querySelector('p').textContent = 'Try adjusting your search or filter';
    return;
  }
  if (books.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.querySelector('h2').textContent = '📚 Library is empty';
    emptyState.querySelector('p').textContent = isAdmin ? 'Click ➕ to add your first book' : 'Check back soon!';
    return;
  }
  
  emptyState.style.display = 'none';
  // ✅ FIX: Fixed syntax error in map function from previous code
  grid.innerHTML = filteredBooks.map(book => {
    const isBorrowed = (book.status || '').toLowerCase().trim() === 'borrowed';
    const avg = getAverageRating(book.ratings);
    const totalRatings = (book.ratings || []).length;
    const ratingDisplay = totalRatings > 0 ? `<div class="book-rating">⭐ ${avg} <span class="rating-count">(${totalRatings})</span></div>` : '';
    
    return `
     <div class="book-card ${isBorrowed ? 'borrowed' : 'available'}" onclick="openBookDetail(${book.id})">
      ${book.coverImage 
        ? `<img src="${book.coverImage}" class="book-cover" alt="${escapeHtml(book.title)}" onerror="this.parentElement.innerHTML='<div class=\\'book-cover\\'>📘</div>'">` 
        : `<div class="book-cover">📘</div>`}
       <div class="book-title">${escapeHtml(book.title)}</div>
       <div class="book-author">by ${escapeHtml(book.author)}</div>
       <div class="book-location">📍 ${escapeHtml(book.location)}</div>
       <div class="book-meta">
         <span>${escapeHtml(book.genre)}</span> <span>•</span>
         <span class="rrl-badge">RRL: ${escapeHtml(book.rrlLevel || 'N/A')}</span> <span>•</span>
         <span>ID: ${book.id}</span>
       </div>
      ${ratingDisplay}
       <span class="status-badge ${isBorrowed ? 'borrowed' : 'available'}">
        ${isBorrowed ? '📤 Borrowed' : '✓ Available'}
       </span>
      ${isBorrowed 
        ? `<div style="margin-top:0.5rem;">
            ${isAdmin ? `
               <span class="borrower-badge">${escapeHtml(book.borrower)}</span><br>
               <small style="color:#64748b;display:block;margin-top:0.25rem">Grade: ${escapeHtml(book.borrowerGrade)} • Level: ${escapeHtml(book.borrowerLevel)}</small>
               <small style="color:#64748b;display:block;margin-top:0.15rem">Phone: ${escapeHtml(book.borrowerPhone || 'N/A')}</small>
               <small style="color:#64748b;display:block;margin-top:0.15rem">Center: ${escapeHtml(book.borrowerCenter || 'No Center')}</small>
               <small style="color:#94a3b8;display:block;margin-top:0.15rem">Since: ${book.borrowDate}</small>
            ` : '<small style="color:#64748b">Currently borrowed</small>'}
            </div>` 
        : ''}
       <div class="book-actions" onclick="event.stopPropagation()">
        ${!isBorrowed 
          ? `<button class="btn btn-primary" onclick="openBorrowModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')">📚 Borrow</button>` 
          : `<button class="btn btn-success" onclick="returnBook(${book.id})">✅ Return</button>`}
         <button class="btn btn-primary btn-small admin-only" onclick="openEditModal(${book.id})" style="background:#7c3aed">✏️ Edit</button>
         <button class="btn btn-danger btn-small admin-only" onclick="removeBook(${book.id})">🗑 Remove</button>
       </div>
     </div>`;
  }).join('');
}

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
  startRealtimeSync();
  initCarousel();
  
  window.history.pushState(null, null, window.location.href);
  window.addEventListener('popstate', function () {
    if (confirm('Are you sure you want to exit?')) {
      window.history.back();
    } else {
      window.history.pushState(null, null, window.location.href);
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
document.getElementById('passwordInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
document.getElementById('searchInput')?.addEventListener('input', renderBooks);
document.getElementById('filterStatus')?.addEventListener('change', renderBooks);
document.getElementById('filterRRL')?.addEventListener('change', renderBooks);
document.getElementById('sortBy')?.addEventListener('change', renderBooks);

document.getElementById('newBookCover')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  const warningEl = document.getElementById('imageSizeWarning');
  if (file && file.size > 500 * 1024) {
    warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Will compress to 300px @ 20%.`;
    warningEl.classList.add('show');
  } else { warningEl.classList.remove('show'); }
});
['newBookTitle','newBookAuthor','newBookGenre','newBookLocation','newBookRRL'].forEach(id => {
  document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processAddBook(); });
});
document.getElementById('editBookCover')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  const warningEl = document.getElementById('editImageSizeWarning');
  if (file && file.size > 500 * 1024) {
    warningEl.textContent = `⚠️ Image is ${(file.size/1024/1024).toFixed(1)}MB. Will compress to 300px @ 20%.`;
    warningEl.classList.add('show');
  } else { warningEl.classList.remove('show'); }
});
['editBookTitle','editBookAuthor','editBookGenre','editBookLocation','editBookRRL'].forEach(id => {
  document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processEditBook(); });
});

['loginOverlay','borrowModal','addBookModal','editBookModal','visitorBorrowModal','detailModal','rrlInfoModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) {
    if (id === 'loginOverlay') closeLoginModal();
    if (id === 'borrowModal') closeBorrowModal();
    if (id === 'addBookModal') closeAddBookModal();
    if (id === 'editBookModal') closeEditBookModal();
    if (id === 'visitorBorrowModal') closeVisitorBorrowModal();
    if (id === 'detailModal') closeDetailModal();
    if (id === 'rrlInfoModal') closeRRLInfoModal();
  }});
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetailModal();
    closeRRLInfoModal();
    closeMobileMenu();
  }
});

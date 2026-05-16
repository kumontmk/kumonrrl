// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Firebase Realtime Version
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
  // Apply class to BODY to affect Header and FAB
  if (active) {
    document.body.classList.add('admin-mode');
    document.getElementById('modeIndicator').textContent = '🔐 Admin Mode';
    document.getElementById('modeIndicator').classList.add('admin');
  } else {
    document.body.classList.remove

// ═══════════════════════════════════════════════════════════
// Kumon RRL Online Library - Firebase Realtime Version
// ═══════════════════════════════════════════════════════════
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const BOOKS_REF = database.ref('books');

const SESSION_KEY = 'kumonLibrarySession';

let books = [];
let nextId = 1;
let isAdmin = false;
let pendingBorrowBookId = null;
let pendingReturnBookId = null;
let selectedBookId = null;
let hasUnsavedChanges = false;
let selectedRating = 0;
let html5QrCode = null;
let isScanning = false;
let pendingBookDescription = ''; // ✅ Temp storage for fetched description
let isInitialLoad = true;        // ✅ Flag to prevent saving during initial load
let initialLoadComplete = false; // ✅ Track if first sync completed

// ═══════════════════════════════════════════════════════════
// 🌐 I18N — TRANSLATION LAYER (same pattern as parent-request)
// ═══════════════════════════════════════════════════════════
const I18N = {
  en: {
    pageTitle: 'Kumon Recommended Reading List Online Library',
    adminMode: '🔐 Admin Mode', publicView: '👥 Public View',
    unsaved: '● Unsaved changes', logout: '🚪 Logout', adminLogin: '🔐 Admin Login',
    caption1: 'Read • Grow • Learn', caption2: 'Explore our Collection', caption3: 'Start Your Journey',
    statTotal: 'Total Books', statAvailable: 'Available', statBorrowed: 'Borrowed',
    knowMore: '📖 Know more about the RRL',
    searchPh: 'Search by title, author or location...',
    allBooks: 'All Books', availableOnly: 'Available Only', borrowedOnly: 'Borrowed Only',
    allRRL: 'All RRL Levels', rrlReadTogether: 'Read Together', rrlFurther: 'Further Reading',
    sortByNewest: 'Sort by Newest', sortByTitle: 'Sort by Title', sortByAuthor: 'Sort by Author',
    sortByStatus: 'Sort by Status', sortByRRL: 'Sort by RRL Level',
    loading: 'Loading books from Firebase...',
    emptyTitle: '📚 Library is empty', emptyAddHint: 'Click ➕ to add your first book',
    emptyPublicHint: 'Check back soon!', noMatchTitle: 'No matching books',
    noMatchHint: 'Try adjusting your search or filter',
    loginTitle: '🔐 Admin Login', loginHint: 'Enter password to manage library',
    loginErrorMsg: 'Invalid password', passwordPh: 'Password',
    loginBtn: 'Login as Admin', continueVisitor: 'Continue as Visitor',
    borrowTitle: '📚 Borrow Book', borrowing: 'Borrowing:',
    name: 'Name', grade: 'Grade', level: 'Level', phone: 'Phone', center: 'Center',
    noCenter: 'No Center', confirmBorrow: 'Confirm Borrow', cancel: 'Cancel',
    visitorTitle: '📚 Borrow a Book',
    visitorHint: 'To borrow books from our library, please:',
    visitCall: '📞 Visit or Call Us', loginAsAdmin: '🔐 Login as Admin', close: 'Close',
    addBookTitle: '➕ Add New Book',
    titlePh: 'Book Title *', authorPh: 'Author *', genrePh: 'Genre', locationPh: 'Location *',
    selectRRL: 'Select RRL Level', scanIsbn: '📷 Scan ISBN Barcode', stop: '⏹ Stop',
    searchCover: '🔍 Search Cover Online',
    cameraHint: '📱 On mobile: tap to choose file OR take photo with camera',
    saveBook: 'Save Book', saving: 'Saving...',
    editBookTitle: '✏️ Edit Book', keepCoverHint: 'Leave empty to keep current cover image.',
    updateBook: 'Update Book',
    by: 'by', available: '✓ Available', borrowed: '📤 Borrowed', uncategorized: 'Uncategorized',
    genre: 'Genre', location: 'Location', rrlLevel: 'RRL Level', bookId: 'Book ID',
    rateThisBook: 'Rate this Book', submitRating: 'Submit Rating', noRatings: 'No ratings yet',
    overallRating: 'Overall: ⭐ {{avg}} ({{count}} ratings)',
    borrowerInfo: '📤 Borrower Information', borrowedOn: 'Borrowed',
    detailBorrow: '📚 Borrow Book', detailReturn: '✅ Return Book',
    edit: '✏️ Edit', remove: '🗑 Remove',
    currentlyBorrowed: 'Currently borrowed', borrowBtn: '📚 Borrow', returnBtn: '✅ Return',
    since: 'Since',
    loggedOut: 'Logged out - now in Public View',
    adminActivated: '✅ Admin mode activated', adminRestored: '✅ Admin session restored',
    fillRequired: 'Please fill in title, author, and location',
    fillAllFields: 'Please fill in all fields',
    validPhone: 'Please enter a valid phone number',
    bookAdded: '"{{title}}" added successfully', bookUpdated: '"{{title}}" updated successfully',
    bookRemoved: '"{{title}}" removed',
    bookBorrowedBy: '"{{title}}" borrowed by {{name}}',
    bookReturned: '✅ "{{title}}" returned by {{info}}',
    updateError: 'Error updating book: {{msg}}', saveFailed: 'Save failed: {{msg}}',
    saveNoBooks: '⚠️ Save cancelled: No books to save',
    saveInvalid: '❌ Save failed: Invalid book data',
    syncIssue: '⚠️ Sync issue - keeping local data', connLost: 'Connection lost. Retrying...',
    removeConfirm: 'Remove "{{title}}"?',
    removeAllConfirm: '⚠️ This will remove ALL books. Are you absolutely sure?',
    exitConfirm: 'Are you sure you want to exit?',
    selectRatingMsg: 'Please select a rating', ratingSubmitted: 'Rating submitted!',
    lastBook: '📖 Last book in list', firstBook: '📖 First book in list',
    cameraStarted: '📷 Camera started. Point at ISBN barcode.',
    cameraFailed: '❌ Failed to start camera. Check permissions.',
    scannedIsbn: '✅ Scanned ISBN: {{isbn}}', invalidIsbn: '⚠️ Not a valid ISBN barcode',
    searchingDb: '🔍 Searching free book databases...',
    foundGoogle: '✅ Found via Google Books', foundOpenLib: '✅ Found via Open Library',
    notFoundManual: '📖 Book not found. Please fill in details manually.',
    enterTitleFirst: 'Please enter a book title first',
    searchingSources: '🔍 Searching multiple sources...',
    noCoversFound: 'No covers found. Try a different title or upload manually.',
    coversFound: '✅ Found {{count}} cover(s)',
    coverSearchFailed: 'Search failed. Check your internet connection.',
    downloadingCover: '⬇️ Downloading cover...', coverSelected: '✅ Cover selected!',
    coverLoadFailed: '❌ Failed to load cover.',
    imgWillCompress: '⚠️ Image is {{size}}MB. Will compress on save.',
    imgCompressing: '⚠️ Image is {{size}}MB. Auto-compressing...',
    imgErrorNoImg: 'Image error. Adding without image.',
    rrlInfoTitle: '📖 Introduction to the Kumon Recommended Reading List',
    rrlWhatH: '📚 What is the Kumon Recommended Reading List?',
    rrlWhatP: 'The Kumon Recommended Reading List (RRL) is a list of 380 books intended to help Kumon students find books that they will enjoy reading, and to encourage them to read books from a wide range of genres and styles.',
    rrlChosenH: '📋 How are the Books Chosen?',
    rrlChosenP: 'The books on the RRL have been selected because they are popular, award winning, or recognised literary classics. They were all available from major online bookshops at the time of writing.',
    rrlArrangedH: '📂 How are the Books Arranged?',
    rrlArrangedP: 'The books are divided into twelve sections, broadly corresponding to the levels of the Kumon English Programme. Each title includes a short blurb to help students choose books, and students can colour in stars to rate the books.',
    rrlRTH: '👶 Read Together',
    rrlRTP: "This section was created for children who haven't started reading independently yet.",
    rrl2AH: '📖 Level 2A to Level I',
    rrl2AP: 'The thirty books in each level from Level 2A to Level I are listed in order of difficulty, with the easiest at number one.',
    rrlFRH: '🌟 Further Reading',
    rrlFRP: 'These thirty books are recommended for more confident, mature readers. They include classics and seminal works from a range of genres and periods.',
    rrlWideH: '📚 A Wide Range of Books for a Wide Range of Readers!',
    rrlWideP: 'The RRL contains something for everyone. Not every book will be appropriate for every student, but everyone will find something they will enjoy!',
    rrlParentsH: '👨‍👩‍👧 Information for Parents',
    rrlParentsP: 'The following information is intended to help parents make the best use of the Recommended Reading List (RRL), and to give ideas on how to help inspire in children a lifelong love of reading.',
    rrlHomeH: "🏠 Creating a 'Reading-Friendly' Environment at Home",
    rrlHomeP: "Store your child's books within reach. Create a reading corner. Visit the library together. Take an active interest in what your child is reading.",
    rrlRecH: '📚 Recommending Books',
    rrlRecP: 'Children should read books that match their ability and interests, which may not correspond to their age or school year.',
    rrlAloudH: '🗣️ Reading Aloud to Your Child',
    rrlAloudP: 'The stories you read aloud are their first introduction to the world of books. Let your child choose, read at their pace, and talk about the story.',
    rrlIndH: '🚀 Encouraging Independent Reading',
    rrlIndP: 'Children feel achievement when reading a whole book. Listen, give encouragement, and start with simple books.',
    rrlConfH: '⭐ More Confident Readers',
    rrlConfP: "Continue to recommend books. Use genre icons to explore. Don't force reading choices; keep it fun and satisfying.",
    rrlClosing: '📖 The Kumon Recommended Reading List helps students discover the joy of reading!'
  },
  'zh-TW': {
    pageTitle: '公文式推薦閱讀書單網上圖書館',
    adminMode: '🔐 管理員模式', publicView: '👥 公眾模式',
    unsaved: '● 有未儲存的變更', logout: '🚪 登出', adminLogin: '🔐 管理員登入',
    caption1: '閱讀 • 成長 • 學習', caption2: '探索我們的館藏', caption3: '展開閱讀旅程',
    statTotal: '書籍總數', statAvailable: '可借閱', statBorrowed: '已借出',
    knowMore: '📖 了解更多關於RRL',
    searchPh: '搜尋書名、作者或位置...',
    allBooks: '全部書籍', availableOnly: '僅可借閱', borrowedOnly: '僅已借出',
    allRRL: '所有RRL級別', rrlReadTogether: '一起閱讀', rrlFurther: '延伸閱讀',
    sortByNewest: '按最新排序', sortByTitle: '按書名排序', sortByAuthor: '按作者排序',
    sortByStatus: '按狀態排序', sortByRRL: '按RRL級別排序',
    loading: '正在載入書籍...',
    emptyTitle: '📚 圖書館尚未有書籍', emptyAddHint: '點擊 ➕ 添加第一本書',
    emptyPublicHint: '請稍後再來！', noMatchTitle: '沒有符合的書籍',
    noMatchHint: '請嘗試調整搜尋或篩選條件',
    loginTitle: '🔐 管理員登入', loginHint: '輸入密碼以管理圖書館',
    loginErrorMsg: '密碼無效', passwordPh: '密碼',
    loginBtn: '以管理員身分登入', continueVisitor: '繼續以訪客身分',
    borrowTitle: '📚 借閱書籍', borrowing: '正在借閱：',
    name: '姓名', grade: '年級', level: '級別', phone: '電話', center: '中心',
    noCenter: '沒有中心', confirmBorrow: '確認借閱', cancel: '取消',
    visitorTitle: '📚 借閱書籍',
    visitorHint: '如需借閱本館書籍，請：',
    visitCall: '📞 親臨或致電我們', loginAsAdmin: '🔐 以管理員身分登入', close: '關閉',
    addBookTitle: '➕ 添加新書',
    titlePh: '書名 *', authorPh: '作者 *', genrePh: '體裁', locationPh: '位置 *',
    selectRRL: '選擇RRL級別', scanIsbn: '📷 掃描ISBN條碼', stop: '⏹ 停止',
    searchCover: '🔍 網上搜尋封面',
    cameraHint: '📱 手機：點擊選擇檔案或使用相機拍照',
    saveBook: '儲存書籍', saving: '儲存中...',
    editBookTitle: '✏️ 編輯書籍', keepCoverHint: '留空以保留現有封面圖片。',
    updateBook: '更新書籍',
    by: '作者：', available: '✓ 可借閱', borrowed: '📤 已借出', uncategorized: '未分類',
    genre: '體裁', location: '位置', rrlLevel: 'RRL級別', bookId: '書籍編號',
    rateThisBook: '為本書評分', submitRating: '提交評分', noRatings: '暫無評分',
    overallRating: '整體評分：⭐ {{avg}}（{{count}}個評分）',
    borrowerInfo: '📤 借閱者資訊', borrowedOn: '借出日期',
    detailBorrow: '📚 借閱書籍', detailReturn: '✅ 歸還書籍',
    edit: '✏️ 編輯', remove: '🗑 移除',
    currentlyBorrowed: '目前已被借出', borrowBtn: '📚 借閱', returnBtn: '✅ 歸還',
    since: '借出日期',
    loggedOut: '已登出 - 現為公眾模式',
    adminActivated: '✅ 已啟動管理員模式', adminRestored: '✅ 已恢復管理員工作階段',
    fillRequired: '請填寫書名、作者及位置',
    fillAllFields: '請填寫所有欄位',
    validPhone: '請輸入有效的電話號碼',
    bookAdded: '已成功添加「{{title}}」', bookUpdated: '已成功更新「{{title}}」',
    bookRemoved: '已移除「{{title}}」',
    bookBorrowedBy: '「{{title}}」已由 {{name}} 借出',
    bookReturned: '✅ 「{{title}}」已由 {{info}} 歸還',
    updateError: '更新書籍時出錯：{{msg}}', saveFailed: '儲存失敗：{{msg}}',
    saveNoBooks: '⚠️ 已取消儲存：沒有書籍可儲存',
    saveInvalid: '❌ 儲存失敗：書籍資料無效',
    syncIssue: '⚠️ 同步問題 - 保留本機資料', connLost: '連線中斷，正在重試...',
    removeConfirm: '移除「{{title}}」？',
    removeAllConfirm: '⚠️ 這將移除所有書籍。您確定嗎？',
    exitConfirm: '確定要離開嗎？',
    selectRatingMsg: '請選擇評分', ratingSubmitted: '評分已提交！',
    lastBook: '📖 已是最後一本書', firstBook: '📖 已是第一本書',
    cameraStarted: '📷 相機已啟動，請對準ISBN條碼。',
    cameraFailed: '❌ 無法啟動相機，請檢查權限。',
    scannedIsbn: '✅ 已掃描ISBN：{{isbn}}', invalidIsbn: '⚠️ 不是有效的ISBN條碼',
    searchingDb: '🔍 正在搜尋免費書籍資料庫...',
    foundGoogle: '✅ 經Google Books找到', foundOpenLib: '✅ 經Open Library找到',
    notFoundManual: '📖 未找到書籍，請手動填寫詳情。',
    enterTitleFirst: '請先輸入書名',
    searchingSources: '🔍 正在搜尋多個來源...',
    noCoversFound: '未找到封面。請嘗試其他書名或手動上傳。',
    coversFound: '✅ 找到 {{count}} 個封面',
    coverSearchFailed: '搜尋失敗，請檢查網路連線。',
    downloadingCover: '⬇️ 正在下載封面...', coverSelected: '✅ 已選擇封面！',
    coverLoadFailed: '❌ 無法載入封面。',
    imgWillCompress: '⚠️ 圖片大小為 {{size}}MB，儲存時將自動壓縮。',
    imgCompressing: '⚠️ 圖片大小為 {{size}}MB，正在自動壓縮...',
    imgErrorNoImg: '圖片錯誤，將不附圖片添加。',
    rrlInfoTitle: '📖 公文式推薦閱讀書單簡介',
    rrlWhatH: '📚 什麼是公文式推薦閱讀書單？',
    rrlWhatP: '公文式推薦閱讀書單（RRL）是一份包含380本書的書單，旨在幫助公文式學生找到他們感興趣的書籍，並鼓勵他們發掘不同體裁和風格的作品。',
    rrlChosenH: '📋 書籍如何挑選？',
    rrlChosenP: 'RRL上的書籍均因廣受歡迎、獲獎或公認的文學經典而入選。在編寫時，所有書籍均可於主要網上書店購得。',
    rrlArrangedH: '📂 書籍如何編排？',
    rrlArrangedP: '書籍分為十二個部分，大致對應公文式英語課程的級別。每本書均附有簡短介紹，幫助學生選書，學生亦可為書籍塗上星星作評分。',
    rrlRTH: '👶 一起閱讀',
    rrlRTP: '此部分專為尚未開始獨立閱讀的兒童而設。',
    rrl2AH: '📖 Level 2A 至 Level I',
    rrl2AP: 'Level 2A至Level I每個級別各有三十本書，按難度排序，第一本最為簡單。',
    rrlFRH: '🌟 延伸閱讀',
    rrlFRP: '這三十本書推薦給更有信心、更成熟的讀者，涵蓋不同時期和體裁的經典及重要作品。',
    rrlWideH: '📚 為不同讀者提供豐富的書籍！',
    rrlWideP: 'RRL老少咸宜。並非每本書都適合每位學生，但每個人都能找到喜歡的書！',
    rrlParentsH: '👨‍👩‍👧 家長資訊',
    rrlParentsP: '以下資訊旨在幫助家長善用推薦閱讀書單（RRL），並提供啟發孩子終身熱愛閱讀的方法。',
    rrlHomeH: '🏠 在家中營造「閱讀友善」環境',
    rrlHomeP: '把孩子的書籍存放在他們觸手可及的地方。設置閱讀角。一起到圖書館。主動關心孩子正在閱讀的書籍。',
    rrlRecH: '📚 推薦書籍',
    rrlRecP: '孩子應閱讀符合其能力和興趣的書籍，這未必與其年齡或就讀年級相符。',
    rrlAloudH: '🗣️ 為孩子朗讀',
    rrlAloudP: '您朗讀的故事是孩子認識書籍世界的第一步。讓孩子選書，按他們的節奏閱讀，並一起討論故事。',
    rrlIndH: '🚀 鼓勵獨立閱讀',
    rrlIndP: '孩子讀完整本書時會感到充滿成就感。請聆聽、給予鼓勵，並從簡單的書籍開始。',
    rrlConfH: '⭐ 更有信心的讀者',
    rrlConfP: '繼續推薦書籍。利用體裁圖示探索不同作品。不要強迫孩子選擇讀物；讓閱讀保持趣味和滿足感。',
    rrlClosing: '📖 公文式推薦閱讀書單幫助學生發現閱讀的樂趣！'
  }
};

// 🌐 Shares the same localStorage key as the parent-request site
let lang = localStorage.getItem('pfl_lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en');

function tr(key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  if (vars) {
    Object.keys(vars).forEach(v => { s = s.split('{{' + v + '}}').join(vars[v]); });
  }
  return s;
}

const RRL_CODES = ['2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
// Display text is bilingual; VALUES are unchanged so existing Firebase data stays compatible
const CENTER_OPTIONS = [
  { value: 'Kumon Taipa Mei Keng', label: 'Kumon Taipa Mei Keng 氹仔美景' },
  { value: 'Kumon Taipa Pac Tat', label: 'Kumon Taipa Pac Tat 氹仔百達' },
  { value: 'Kumon Champs', label: 'Kumon Champs 卓思' },
  { value: 'Kumon Tap Siac', label: 'Kumon Tap Siac 塔石' }
];

function applyLang() {
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-TW' : 'en';
  const toggleLabel = lang === 'en' ? '中文' : 'EN';
  ['langToggle', 'mobileLangToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = toggleLabel;
  });
  document.querySelectorAll('[data-tr]').forEach(el => { el.textContent = tr(el.dataset.tr); });
  document.querySelectorAll('[data-tr-placeholder]').forEach(el => { el.placeholder = tr(el.dataset.trPlaceholder); });
  document.title = tr('pageTitle');
}

function fillSelect(el, options) {
  if (!el) return;
  const prev = el.value;
  el.innerHTML = '';
  options.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    el.appendChild(opt);
  });
  if (Array.from(el.options).some(o => o.value === prev)) el.value = prev;
}

function rebuildSelects() {
  fillSelect(document.getElementById('filterStatus'), [
    ['all', tr('allBooks')], ['available', tr('availableOnly')], ['borrowed', tr('borrowedOnly')]
  ]);
  fillSelect(document.getElementById('filterRRL'), [
    ['', tr('allRRL')],
    ['Read Together', tr('rrlReadTogether')],
    ...RRL_CODES.map(c => [c, c]),
    ['Further Reading', tr('rrlFurther')]
  ]);
  fillSelect(document.getElementById('sortBy'), [
    ['newest', tr('sortByNewest')], ['title', tr('sortByTitle')], ['author', tr('sortByAuthor')],
    ['status', tr('sortByStatus')], ['rrl', tr('sortByRRL')]
  ]);
  const rrlFormOptions = [
    ['', tr('selectRRL')],
    ['Read Together', tr('rrlReadTogether')],
    ...RRL_CODES.map(c => [c, c]),
    ['Further Reading', tr('rrlFurther')],
    ['N/A', 'N/A']
  ];
  fillSelect(document.getElementById('newBookRRL'), rrlFormOptions);
  fillSelect(document.getElementById('editBookRRL'), rrlFormOptions);
  fillSelect(document.getElementById('borrowerCenter'), [
    ['', tr('noCenter')],
    ...CENTER_OPTIONS.map(c => [c.value, c.label])
  ]);
}

function switchLang() {
  lang = lang === 'en' ? 'zh-TW' : 'en';
  localStorage.setItem('pfl_lang', lang);
  applyLang();
  rebuildSelects();
  // Refresh mode indicator text without touching hasUnsavedChanges
  ['modeIndicator', 'mobileModeIndicator'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = isAdmin ? tr('adminMode') : tr('publicView');
      el.classList.toggle('admin', isAdmin);
    }
  });
  renderBooks();
  if (selectedBookId) openBookDetail(selectedBookId);
}

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
      el.textContent = active ? tr('adminMode') : tr('publicView');
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
  showToast(tr('loggedOut'), 'info');
}

// ═══════════════════════════════════════════════════════════
// BARCODE SCANNER & COVER SEARCH
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
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      onScanSuccess,
      onScanFailure
    );
    isScanning = true;
    showToast(tr('cameraStarted'), 'info');
  } catch (err) {
    console.error("Failed to start scanner", err);
    showToast(tr('cameraFailed'), 'error');
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
    }).catch(err => console.error("Failed to stop scanner", err));
  }
}

function onScanSuccess(decodedText, decodedResult) {
  const match = decodedText.match(/\d{10,13}/);
  const isbn = match ? match[0] : decodedText.replace(/[-\s]/g, '');
  if (isbn.match(/^\d{10,13}$/)) {
    stopBarcodeScanner();
    showToast(tr('scannedIsbn', { isbn }), 'success');
    fetchBookByISBN(isbn);
  } else {
    showToast(tr('invalidIsbn'), 'error');
  }
}
function onScanFailure(error) { /* Ignore continuous failures */ }

async function fetchBookByISBN(isbn) {
  showToast(tr('searchingDb'), 'info');
  let data = await fetchFromGoogleBooks(isbn);
  if (data) { fillBookForm(data); showToast(tr('foundGoogle'), 'success'); return; }
  data = await fetchFromOpenLibrary(isbn);
  if (data) { fillBookForm(data); showToast(tr('foundOpenLib'), 'success'); return; }
  showToast(tr('notFoundManual'), 'info');
}

async function fetchFromGoogleBooks(isbn) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const json = await res.json();
    if (json.totalItems > 0) {
      const info = json.items[0].volumeInfo;
      const rawDesc = info.description || '';
      const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim();
      return {
        title: info.title || '',
        authors: info.authors || [],
        categories: info.categories || [],
        thumbnail: (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail)?.replace('http:', 'https:') || null,
        description: cleanDesc
      };
    }
  } catch (e) { console.warn('Google Books API failed', e); }
  return null;
}

async function fetchFromOpenLibrary(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const json = await res.json();
    const key = `ISBN:${isbn}`;
    if (json[key]) {
      const info = json[key];
      let rawDesc = '';
      if (typeof info.description === 'string') {
        rawDesc = info.description;
      } else if (info.description?.value) {
        rawDesc = info.description.value;
      } else if (info.excerpts?.[0]?.text) {
        rawDesc = info.excerpts[0].text;
      }
      const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim();
      return {
        title: info.title || '',
        authors: info.authors?.map(a => a.name) || [],
        categories: info.subjects || [],
        thumbnail: (info.cover?.large || info.cover?.medium || info.cover?.small) || null,
        description: cleanDesc
      };
    }
  } catch (e) { console.warn('Open Library API failed', e); }
  return null;
}

function fillBookForm(data) {
  document.getElementById('newBookTitle').value = data.title;
  document.getElementById('newBookAuthor').value = data.authors.join(', ');
  pendingBookDescription = data.description || '';
  let genre = '';
  if (data.categories && data.categories.length > 0) {
    const cat = data.categories[0];
    genre = typeof cat === 'string' ? cat : (cat.name || cat.title || String(cat));
  }
  document.getElementById('newBookGenre').value = genre;
  if (data.thumbnail) { fetchAndSetCover(data.thumbnail); }
}

async function searchBookCovers() {
  const title = document.getElementById('newBookTitle').value.trim();
  if (!title) {
    showToast(tr('enterTitleFirst'), 'error');
    return;
  }
  const resultsDiv = document.getElementById('coverSearchResults');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `<p style="text-align:center;padding:0.5rem;color:var(--text-muted);">${tr('searchingSources')}</p>`;
  const allCovers = new Map();
  try {
    const apiPromises = [searchGoogleBooks(title), searchOpenLibrary(title), searchiTunesBooks(title)];
    const results = await Promise.allSettled(apiPromises);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const apiName = ['Google Books', 'Open Library', 'iTunes'][index];
        result.value.forEach(cover => {
          if (!allCovers.has(cover.url)) {
            allCovers.set(cover.url, { ...cover, source: apiName });
          }
        });
      }
    });
    if (allCovers.size === 0) {
      resultsDiv.innerHTML = `<p style="text-align:center;padding:0.5rem;color:var(--text-muted);">${tr('noCoversFound')}</p>`;
      return;
    }
    let html = '<div class="cover-search-grid">';
    Array.from(allCovers.values()).forEach((cover) => {
      html += `<div class="cover-search-item" onclick="selectCoverFromSearch('${cover.url}')" title="Source: ${cover.source}"><img src="${cover.url}" alt="${cover.title}" loading="lazy"><div style="font-size:0.65rem;text-align:center;padding:0.2rem;background:rgba(0,0,0,0.6);color:#fff;">${cover.source}</div></div>`;
    });
    html += '</div>';
    resultsDiv.innerHTML = html;
    showToast(tr('coversFound', { count: allCovers.size }), 'success');
  } catch (err) {
    console.error('Cover search error:', err);
    resultsDiv.innerHTML = `<p style="text-align:center;padding:0.5rem;color:var(--danger);">${tr('coverSearchFailed')}</p>`;
  }
}

async function searchGoogleBooks(title) {
  try {
    const query = encodeURIComponent(`intitle:"${title}"`);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=8&printType=books&key=AIzaSyBo0DXOWKztyMXUXfPhNyoFo9P_Fu-MEn4`);
    if (!res.ok) throw new Error('Google Books API error');
    const data = await res.json();
    if (!data.items) return [];
    return data.items.map(book => {
      const links = book.volumeInfo?.imageLinks;
      const url = links?.large || links?.thumbnail || links?.smallThumbnail;
      return url ? { url: url.replace('http:', 'https:'), title: book.volumeInfo?.title || 'Unknown', source: 'Google Books' } : null;
    }).filter(Boolean);
  } catch (e) { console.warn('Google Books search failed:', e); return []; }
}

async function searchOpenLibrary(title) {
  try {
    const query = encodeURIComponent(`title:"${title}"`);
    const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=8`);
    if (!res.ok) throw new Error('Open Library API error');
    const data = await res.json();
    if (!data.docs) return [];
    return data.docs.map(book => {
      if (book.cover_i) {
        return { url: `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`, title: book.title || 'Unknown', source: 'Open Library' };
      }
      return null;
    }).filter(Boolean);
  } catch (e) { console.warn('Open Library search failed:', e); return []; }
}

async function searchiTunesBooks(title) {
  try {
    const query = encodeURIComponent(`${title} ebook`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=ebook&limit=8`);
    if (!res.ok) throw new Error('iTunes API error');
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map(book => {
      let url = book.artworkUrl100;
      if (url) {
        url = url.replace('100x100bb', '600x600bb');
        return { url, title: book.trackName || 'Unknown', source: 'iTunes Books' };
      }
      return null;
    }).filter(Boolean);
  } catch (e) { console.warn('iTunes Books search failed:', e); return []; }
}

async function selectCoverFromSearch(url) {
  showToast(tr('downloadingCover'), 'info');
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('newBookCover').files = dt.files;
    document.getElementById('coverSearchResults').style.display = 'none';
    showToast(tr('coverSelected'), 'success');
  } catch (e) { showToast(tr('coverLoadFailed'), 'error'); }
}

async function fetchAndSetCover(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('newBookCover').files = dt.files;
    const warningEl = document.getElementById('imageSizeWarning');
    if (file.size > 500 * 1024) {
      warningEl.textContent = tr('imgWillCompress', { size: (file.size / 1024 / 1024).toFixed(1) });
      warningEl.classList.add('show');
    }
  } catch (e) { console.warn('Cover fetch blocked.', e); }
}

// ═══════════════════════════════════════════════════════════
// MOBILE MENU & CAROUSEL
// ═══════════════════════════════════════════════════════════
function toggleMobileMenu() { document.getElementById('mobileMenu')?.classList.toggle('show'); }
function closeMobileMenu() { document.getElementById('mobileMenu')?.classList.remove('show'); }
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.querySelector('.hamburger-btn');
  if (menu?.classList.contains('show') && !menu.contains(e.target) && !hamburger?.contains(e.target)) closeMobileMenu();
});

let currentSlide = 0, carouselInterval;
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
  document.querySelector('.carousel-track').style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.dot').forEach((dot, index) => dot.classList.toggle('active', index === currentSlide));
}
function moveSlide(direction) {
  const slides = document.querySelectorAll('.carousel-slide');
  currentSlide = (currentSlide + direction + slides.length) % slides.length;
  updateCarousel(); resetCarouselAutoPlay();
}
function goToSlide(index) { currentSlide = index; updateCarousel(); resetCarouselAutoPlay(); }
function startCarouselAutoPlay() { carouselInterval = setInterval(() => moveSlide(1), 5000); }
function resetCarouselAutoPlay() { clearInterval(carouselInterval); startCarouselAutoPlay(); }
document.querySelector('.banner-carousel')?.addEventListener('mouseenter', () => clearInterval(carouselInterval));
document.querySelector('.banner-carousel')?.addEventListener('mouseleave', () => startCarouselAutoPlay());

// ═══════════════════════════════════════════════════════════
// RATING SYSTEM & MODALS
// ═══════════════════════════════════════════════════════════
function getAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
}

function selectRating(val) {
  selectedRating = val;
  document.querySelectorAll('#detailStars .star-btn').forEach((btn, index) => btn.classList.toggle('active', index < val));
}

async function submitRating() {
  if (selectedRating === 0) { showToast(tr('selectRatingMsg'), 'error'); return; }
  const book = books.find(b => b.id === selectedBookId);
  if (book) {
    book.ratings = book.ratings || [];
    book.ratings.push(selectedRating);
    if (await saveBooksToFirebase()) {
      showToast(tr('ratingSubmitted'), 'success');
      openBookDetail(selectedBookId); renderBooks();
    }
  }
}

window.addEventListener('beforeunload', (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });

function openLoginModal() { document.getElementById('loginOverlay').classList.add('show'); document.getElementById('passwordInput').focus(); }
function closeLoginModal() { document.getElementById('loginOverlay').classList.remove('show'); document.getElementById('loginError').style.display = 'none'; }

function openBorrowModal(bookId, bookTitle) {
  if (!isAdmin) { openVisitorBorrowModal(bookId, bookTitle); return; }
  pendingBorrowBookId = bookId;
  document.getElementById('borrowBookTitle').textContent = `"${bookTitle}"`;
  ['borrowerName', 'borrowerGrade', 'borrowerLevel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('borrowerPhone').value = '';
  document.getElementById('borrowerCenter').value = '';
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
  ['newBookTitle', 'newBookAuthor', 'newBookGenre', 'newBookLocation', 'newBookRRL', 'newBookCover'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('imageSizeWarning').classList.remove('show');
  document.getElementById('barcode-reader').style.display = 'none';
  document.getElementById('coverSearchResults').style.display = 'none';
  stopBarcodeScanner();
  document.getElementById('addBookModal').classList.add('show');
  document.getElementById('newBookTitle').focus();
  setUnsavedChanges(true);
}
function closeAddBookModal() { stopBarcodeScanner(); document.getElementById('addBookModal').classList.remove('show'); document.getElementById('coverSearchResults').style.display = 'none'; setUnsavedChanges(false); }

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

function openRRLInfoModal() { document.getElementById('rrlInfoModal').classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeRRLInfoModal() { document.getElementById('rrlInfoModal').classList.remove('show'); document.body.style.overflow = ''; }

function openBookDetail(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  selectedBookId = bookId;
  const coverEl = document.getElementById('detailCoverFull');
  coverEl.innerHTML = book.coverImage ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}">` : '<span class="placeholder-large">📘</span>';
  document.getElementById('detailTitle').textContent = book.title;
  document.getElementById('detailAuthor').textContent = `${tr('by')} ${book.author}`;
  document.getElementById('detailGenre').textContent = book.genre || tr('uncategorized');
  document.getElementById('detailLocation').textContent = book.location;
  document.getElementById('detailRRL').textContent = book.rrlLevel || 'N/A';
  document.getElementById('detailID').textContent = `#${book.id}`;
  const isBorrowed = (book.status || '').toLowerCase().trim() === 'borrowed';
  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = isBorrowed ? tr('borrowed') : tr('available');
  statusEl.className = `detail-status ${isBorrowed ? 'borrowed' : 'available'}`;
  const borrowerSection = document.getElementById('detailBorrowerSection');
  if (isBorrowed && book.borrower && isAdmin) {
    borrowerSection.style.display = 'block';
    document.getElementById('detailBorrowerName').textContent = book.borrower;
    document.getElementById('detailBorrowerGrade').textContent = book.borrowerGrade || '-';
    document.getElementById('detailBorrowerLevel').textContent = book.borrowerLevel || '-';
    document.getElementById('detailBorrowerPhone').textContent = book.borrowerPhone || '-';
    document.getElementById('detailBorrowerCenter').textContent = book.borrowerCenter || tr('noCenter');
    document.getElementById('detailBorrowDate').textContent = book.borrowDate || '-';
  } else { borrowerSection.style.display = 'none'; }
  selectedRating = 0;
  document.querySelectorAll('#detailStars .star-btn').forEach(btn => btn.classList.remove('active'));
  const avg = getAverageRating(book.ratings);
  const count = (book.ratings || []).length;
  document.getElementById('detailRatingSummary').textContent = count > 0 ? tr('overallRating', { avg, count }) : tr('noRatings');
  // ✅ Display description if available
  const descEl = document.getElementById('detailDescription');
  if (descEl) {
    if (book.description && book.description.trim()) {
      descEl.textContent = book.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  }
  document.getElementById('detailReturnBtn').style.setProperty('display', isBorrowed ? 'flex' : 'none', 'important');
  document.getElementById('detailBorrowBtn').style.setProperty('display', isBorrowed ? 'none' : 'flex', 'important');
  document.getElementById('detailModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); document.body.style.overflow = ''; selectedBookId = null; }

function handleDetailBorrow() { if (selectedBookId) { const book = books.find(b => b.id === selectedBookId); if (book) { closeDetailModal(); openBorrowModal(book.id, book.title); } } }
function handleDetailReturn() { if (selectedBookId) { returnBook(selectedBookId); closeDetailModal(); } }
function handleDetailEdit() { if (selectedBookId) { const bookId = selectedBookId; closeDetailModal(); openEditModal(bookId); } }
function handleDetailRemove() {
  if (selectedBookId) {
    const book = books.find(b => b.id === selectedBookId);
    if (book && confirm(tr('removeConfirm', { title: book.title }))) { removeBook(selectedBookId); closeDetailModal(); }
  }
}

// ═══════════════════════════════════════════════════════════
// AUTH & FIREBASE
// ═══════════════════════════════════════════════════════════
function login() {
  const password = document.getElementById('passwordInput').value;
  if (password === '1111') {
    saveSession(); setAdminMode(true); renderBooks(); closeLoginModal(); closeMobileMenu();
    document.getElementById('passwordInput').value = '';
    if (pendingBorrowBookId) { const book = books.find(b => b.id === pendingBorrowBookId); if (book) openBorrowModal(book.id, book.title); pendingBorrowBookId = null; }
    if (pendingReturnBookId) { returnBook(pendingReturnBookId); pendingReturnBookId = null; }
    showToast(tr('adminActivated'), 'success');
  } else {
    document.getElementById('loginError').style.display = 'block';
    setTimeout(() => { document.getElementById('loginError').style.display = 'none'; }, 2000);
  }
}

function startRealtimeSync() {
  isInitialLoad = true;
  BOOKS_REF.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      books = Object.values(data).map(b => { b.ratings = b.ratings || []; return b; });
      books.sort((a, b) => b.id - a.id);
      nextId = Math.max(...books.map(b => b.id), 0) + 1;
    } else {
      if (!initialLoadComplete) {
        books = [];
        nextId = 1;
        console.log('📚 Database is empty - starting fresh');
      } else {
        console.warn('⚠️ Firebase returned null after initial load - keeping local data');
        showToast(tr('syncIssue'), 'warning');
        return;
      }
    }
    if (isInitialLoad) {
      isInitialLoad = false;
      initialLoadComplete = true;
      console.log('✅ Initial load complete -', books.length, 'books loaded');
    }
    updateStats();
    renderBooks();
    document.getElementById('loadingState').style.display = 'none';
    setUnsavedChanges(false);
  }, (error) => {
    console.error('Firebase sync error:', error);
    showToast(tr('connLost'), 'error');
  });
}

async function saveBooksToFirebase() {
  if (books.length === 0 && !isInitialLoad) {
    console.warn('⚠️ Prevented saving empty books array - this would delete all books!');
    showToast(tr('saveNoBooks'), 'error');
    return false;
  }
  if (isInitialLoad && !initialLoadComplete) {
    console.warn('⚠️ Save blocked: Initial load not complete');
    return false;
  }
  try {
    const booksObj = {};
    books.forEach(book => {
      if (book && book.id) {
        booksObj[book.id] = book;
      }
    });
    if (Object.keys(booksObj).length === 0 && books.length > 0) {
      console.error('❌ All books have invalid IDs - aborting save');
      showToast(tr('saveInvalid'), 'error');
      return false;
    }
    await BOOKS_REF.set(booksObj);
    return true;
  } catch (error) {
    console.error('Save error:', error);
    showToast(tr('saveFailed', { msg: error.message }), 'error');
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
// BOOK MANAGEMENT & RENDERING
// ═══════════════════════════════════════════════════════════
async function processAddBook() {
  const btn = document.getElementById('addBookBtn');
  const warningEl = document.getElementById('imageSizeWarning');
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();
  const genre = document.getElementById('newBookGenre').value.trim();
  const location = document.getElementById('newBookLocation').value.trim();
  const rrlLevel = document.getElementById('newBookRRL').value;
  if (!title || !author || !location) { showToast(tr('fillRequired'), 'error'); return; }
  btn.disabled = true; btn.textContent = tr('saving'); warningEl.classList.remove('show');
  const file = document.getElementById('newBookCover').files[0];
  try {
    let coverImage = null;
    if (file) {
      if (file.size > 500 * 1024) {
        warningEl.textContent = tr('imgCompressing', { size: (file.size / 1024 / 1024).toFixed(1) });
        warningEl.classList.add('show');
      }
      coverImage = await compressImage(file, 300, 0.2);
    }
    await addBookToSystem(title, author, genre, location, rrlLevel, coverImage, pendingBookDescription);
    closeAddBookModal();
  } catch (error) {
    console.error('Image error:', error);
    showToast(tr('imgErrorNoImg'), 'error');
    await addBookToSystem(title, author, genre, location, rrlLevel, null, pendingBookDescription);
    closeAddBookModal();
  } finally {
    btn.disabled = false;
    btn.textContent = tr('saveBook');
    warningEl.classList.remove('show');
    pendingBookDescription = '';
  }
}

async function addBookToSystem(title, author, genre, location, rrlLevel, coverImage, description = '') {
  const newBook = {
    id: nextId++, title, author, genre: genre || 'Uncategorized', location, rrlLevel: rrlLevel || 'N/A',
    coverImage, description: description || '', status: 'available',
    ratings: [], borrower: null, borrowDate: null, borrowerGrade: null, borrowerLevel: null, borrowerPhone: null, borrowerCenter: null
  };
  books.unshift(newBook);
  if (await saveBooksToFirebase()) { updateStats(); renderBooks(); showToast(tr('bookAdded', { title }), 'success'); setUnsavedChanges(false); }
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
  if (!title || !author || !location) { showToast(tr('fillRequired'), 'error'); return; }
  const book = books.find(b => b.id === id);
  if (!book) return;
  btn.disabled = true; btn.textContent = tr('saving'); warningEl.classList.remove('show');
  try {
    let coverImage = book.coverImage;
    const file = fileInput.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        warningEl.textContent = tr('imgCompressing', { size: (file.size / 1024 / 1024).toFixed(1) });
        warningEl.classList.add('show');
      }
      coverImage = await compressImage(file, 300, 0.2);
    }
    book.title = title; book.author = author; book.genre = genre || 'Uncategorized'; book.location = location; book.rrlLevel = rrlLevel || 'N/A'; book.coverImage = coverImage;
    // Note: description is not editable via UI (system-generated only)
    if (await saveBooksToFirebase()) { closeEditBookModal(); renderBooks(); openBookDetail(id); showToast(tr('bookUpdated', { title }), 'success'); setUnsavedChanges(false); }
  } catch (error) { console.error('Edit error:', error); showToast(tr('updateError', { msg: error.message }), 'error'); }
  finally { btn.disabled = false; btn.textContent = tr('updateBook'); warningEl.classList.remove('show'); }
}

async function removeBook(id) {
  const book = books.find(b => b.id === id);
  if (book && confirm(tr('removeConfirm', { title: book.title }))) {
    books = books.filter(b => b.id !== id);
    if (books.length === 0) {
      if (!confirm(tr('removeAllConfirm'))) {
        books.unshift(book);
        return;
      }
    }
    if (await saveBooksToFirebase()) {
      updateStats();
      renderBooks();
      showToast(tr('bookRemoved', { title: book.title }), 'success');
      setUnsavedChanges(false);
    } else {
      books.unshift(book);
      books.sort((a, b) => b.id - a.id);
      renderBooks();
    }
  }
}

async function confirmBorrow() {
  const name = document.getElementById('borrowerName').value.trim();
  const grade = document.getElementById('borrowerGrade').value.trim();
  const level = document.getElementById('borrowerLevel').value.trim();
  const phoneInput = document.getElementById('borrowerPhone').value.trim().replace(/\D/g, '');
  const center = document.getElementById('borrowerCenter').value;
  if (!name || !grade || !level) { showToast(tr('fillAllFields'), 'error'); return; }
  if (!phoneInput || phoneInput.length < 6) { showToast(tr('validPhone'), 'error'); return; }
  const book = books.find(b => b.id === pendingBorrowBookId);
  if (book) {
    book.status = 'borrowed'; book.borrower = name; book.borrowerGrade = grade; book.borrowerLevel = level; book.borrowerPhone = `+853 ${phoneInput}`; book.borrowerCenter = center || null; book.borrowDate = new Date().toISOString().split('T')[0];
    if (await saveBooksToFirebase()) { closeBorrowModal(); renderBooks(); updateStats(); showToast(tr('bookBorrowedBy', { title: book.title, name }), 'success'); setUnsavedChanges(false); }
  }
}

async function returnBook(id) {
  if (!isAdmin) { pendingReturnBookId = id; openLoginModal(); return; }
  const book = books.find(b => b.id === id);
  if (book) {
    const info = `${book.borrower} (${book.borrowerGrade}, ${book.borrowerLevel})`;
    book.status = 'available'; book.borrower = null; book.borrowerGrade = null; book.borrowerLevel = null; book.borrowerPhone = null; book.borrowerCenter = null; book.borrowDate = null;
    if (await saveBooksToFirebase()) { renderBooks(); updateStats(); showToast(tr('bookReturned', { title: book.title, info }), 'success'); setUnsavedChanges(false); }
  }
}

function getFilteredAndSortedBooks() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterStatus = document.getElementById('filterStatus').value;
  const filterRRL = document.getElementById('filterRRL').value;
  const sortBy = document.getElementById('sortBy').value;
  let filtered = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm) || book.author.toLowerCase().includes(searchTerm) || book.location.toLowerCase().includes(searchTerm);
    return matchesSearch && (filterStatus === 'all' || book.status === filterStatus) && (filterRRL === '' || book.rrlLevel === filterRRL);
  });
  filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'rrl') return (a.rrlLevel || 'Z').toUpperCase().localeCompare((b.rrlLevel || 'Z').toUpperCase(), undefined, { numeric: true });
    return 0;
  });
  return filtered;
}

function renderBooks() {
  const grid = document.getElementById('booksGrid');
  const emptyState = document.getElementById('emptyState');
  const filteredBooks = getFilteredAndSortedBooks();
  if (filteredBooks.length === 0 && books.length > 0) {
    grid.innerHTML = ''; emptyState.style.display = 'block';
    emptyState.querySelector('h2').textContent = tr('noMatchTitle');
    emptyState.querySelector('p').textContent = tr('noMatchHint');
    return;
  }
  if (books.length === 0) {
    grid.innerHTML = ''; emptyState.style.display = 'block';
    emptyState.querySelector('h2').textContent = tr('emptyTitle');
    emptyState.querySelector('p').textContent = isAdmin ? tr('emptyAddHint') : tr('emptyPublicHint');
    return;
  }
  emptyState.style.display = 'none';
  grid.innerHTML = filteredBooks.map(book => {
    const isBorrowed = (book.status || '').toLowerCase().trim() === 'borrowed';
    const avg = getAverageRating(book.ratings);
    const totalRatings = (book.ratings || []).length;
    const ratingDisplay = totalRatings > 0 ? `<div class="book-rating">⭐ ${avg} <span class="rating-count">(${totalRatings})</span></div>` : '';
    return `<div class="book-card ${isBorrowed ? 'borrowed' : 'available'}" onclick="openBookDetail(${book.id})">
      ${book.coverImage ? `<img src="${book.coverImage}" class="book-cover" alt="${escapeHtml(book.title)}" onerror="this.parentElement.innerHTML='<div class=\\'book-cover\\'>📘</div>'">` : `<div class="book-cover">📘</div>`}
      <div class="book-title">${escapeHtml(book.title)}</div>
      <div class="book-author">${tr('by')} ${escapeHtml(book.author)}</div>
      <div class="book-location">📍 ${escapeHtml(book.location)}</div>
      <div class="book-meta"><span>${escapeHtml(book.genre)}</span><span>•</span><span class="rrl-badge">RRL: ${escapeHtml(book.rrlLevel || 'N/A')}</span><span>•</span><span>ID: ${book.id}</span></div>
      ${ratingDisplay}
      <span class="status-badge ${isBorrowed ? 'borrowed' : 'available'}">${isBorrowed ? tr('borrowed') : tr('available')}</span>
      ${isBorrowed ? `<div style="margin-top:0.5rem;">${isAdmin ? `<span class="borrower-badge">${escapeHtml(book.borrower)}</span><br><small style="color:#64748b;display:block;margin-top:0.25rem">${tr('grade')}: ${escapeHtml(book.borrowerGrade)} • ${tr('level')}: ${escapeHtml(book.borrowerLevel)}</small><small style="color:#64748b;display:block;margin-top:0.15rem">${tr('phone')}: ${escapeHtml(book.borrowerPhone || 'N/A')}</small><small style="color:#64748b;display:block;margin-top:0.15rem">${tr('center')}: ${escapeHtml(book.borrowerCenter || tr('noCenter'))}</small><small style="color:#94a3b8;display:block;margin-top:0.15rem">${tr('since')}: ${book.borrowDate}</small>` : `<small style="color:#64748b">${tr('currentlyBorrowed')}</small>`}</div>` : ''}
      <div class="book-actions" onclick="event.stopPropagation()">
        ${!isBorrowed ? `<button class="btn btn-primary" onclick="openBorrowModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')">${tr('borrowBtn')}</button>` : `<button class="btn btn-success" onclick="returnBook(${book.id})">${tr('returnBtn')}</button>`}
        <button class="btn btn-primary btn-small admin-only" onclick="openEditModal(${book.id})" style="background:#7c3aed">${tr('edit')}</button>
        <button class="btn btn-danger btn-small admin-only" onclick="removeBook(${book.id})">${tr('remove')}</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// CLEAN SWIPE NAVIGATION FOR DETAIL MODAL
// ═══════════════════════════════════════════════════════════
let touchStartX = 0, touchStartY = 0;
const SWIPE_THRESHOLD = 60;

function initSwipeNavigation() {
  const modal = document.getElementById('detailModal');
  if (!modal) return;
  modal.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, input, select, a, .star-btn, .book-actions, textarea')) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  modal.addEventListener('touchend', (e) => {
    if (e.target.closest('button, input, select, a, .star-btn, .book-actions, textarea')) return;
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      navigateBookModal(deltaX < 0 ? 1 : -1);
    }
  }, { passive: true });
}

function navigateBookModal(direction) {
  const content = document.querySelector('.detail-content');
  if (!content) return;
  const filtered = getFilteredAndSortedBooks();
  const currentIndex = filtered.findIndex(b => b.id === selectedBookId);
  let newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= filtered.length) {
    showToast(direction > 0 ? tr('lastBook') : tr('firstBook'), 'info');
    return;
  }
  content.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
  content.style.transform = `translateX(${direction * 100}vw)`;
  content.style.opacity = '0';
  setTimeout(() => {
    openBookDetail(filtered[newIndex].id);
    content.style.transition = 'none';
    content.style.transform = `translateX(${-direction * 100}vw)`;
    content.style.opacity = '0';
    void content.offsetWidth;
    requestAnimationFrame(() => {
      content.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease';
      content.style.transform = 'translateX(0)';
      content.style.opacity = '1';
    });
    content.addEventListener('transitionend', () => {
      content.style.transform = '';
      content.style.opacity = '';
      content.style.transition = '';
    }, { once: true });
  }, 250);
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════
function initApp() {
  applyLang();
  rebuildSelects();
  document.getElementById('langToggle')?.addEventListener('click', switchLang);
  document.getElementById('mobileLangToggle')?.addEventListener('click', switchLang);
  if (checkSession()) { setAdminMode(true); showToast(tr('adminRestored'), 'info'); } else { setAdminMode(false); }
  startRealtimeSync();
  initCarousel();
  initSwipeNavigation();
  window.history.pushState(null, null, window.location.href);
  window.addEventListener('popstate', function () {
    if (confirm(tr('exitConfirm'))) { window.history.back(); }
    else { window.history.pushState(null, null, window.location.href); }
  });
}
document.addEventListener('DOMContentLoaded', initApp);

document.getElementById('passwordInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
document.getElementById('searchInput')?.addEventListener('input', renderBooks);
document.getElementById('filterStatus')?.addEventListener('change', renderBooks);
document.getElementById('filterRRL')?.addEventListener('change', renderBooks);
document.getElementById('sortBy')?.addEventListener('change', renderBooks);

document.getElementById('newBookCover')?.addEventListener('change', function(e) {
  const file = e.target.files[0]; const warningEl = document.getElementById('imageSizeWarning');
  if (file && file.size > 500 * 1024) {
    warningEl.textContent = tr('imgWillCompress', { size: (file.size / 1024 / 1024).toFixed(1) });
    warningEl.classList.add('show');
  } else { warningEl.classList.remove('show'); }
});

['newBookTitle', 'newBookAuthor', 'newBookGenre', 'newBookLocation', 'newBookRRL'].forEach(id => document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processAddBook(); }));
['editBookTitle', 'editBookAuthor', 'editBookGenre', 'editBookLocation', 'editBookRRL'].forEach(id => document.getElementById(id)?.addEventListener('keypress', e => { if (e.key === 'Enter') processEditBook(); }));

['loginOverlay', 'borrowModal', 'addBookModal', 'editBookModal', 'visitorBorrowModal', 'detailModal', 'rrlInfoModal'].forEach(id => document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) { if (id === 'loginOverlay') closeLoginModal(); if (id === 'borrowModal') closeBorrowModal(); if (id === 'addBookModal') closeAddBookModal(); if (id === 'editBookModal') closeEditBookModal(); if (id === 'visitorBorrowModal') closeVisitorBorrowModal(); if (id === 'detailModal') closeDetailModal(); if (id === 'rrlInfoModal') closeRRLInfoModal(); } }));

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetailModal(); closeRRLInfoModal(); closeMobileMenu(); } });

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    const activeTag = document.activeElement?.tagName;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
      openAddBookModal();
    }
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    const activeTag = document.activeElement?.tagName;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});
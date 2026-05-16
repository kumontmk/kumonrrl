// In openEditModal function - update this part:
function openEditModal(bookId) {
if (!isAdmin) { openLoginModal(); return; }
const book = books.find(b => b.id === bookId);
if (!book) return;
document.getElementById('editBookId').value = book.id;
document.getElementById('editBookTitle').value = book.title;
document.getElementById('editBookAuthor').value = book.author;
document.getElementById('editBookGenre').value = book.genre || '';
document.getElementById('editBookLocation').value = book.location;

// Set RRL dropdown value
const rrlSelect = document.getElementById('editBookRRL');
rrlSelect.value = book.rrlLevel || '';

document.getElementById('editBookCover').value = '';
document.getElementById('editImageSizeWarning').classList.remove('show');
document.getElementById('editBookModal').classList.add('show');
document.getElementById('editBookTitle').focus();
setUnsavedChanges(true);  // ⚠️ User is editing a book
}

// In processEditBook function - update this part:
async function processEditBook() {
const btn = document.getElementById('editBookBtn');
const warningEl = document.getElementById('editImageSizeWarning');
const id = parseInt(document.getElementById('editBookId').value);
const title = document.getElementById('editBookTitle').value.trim();
const author = document.getElementById('editBookAuthor').value.trim();
const genre = document.getElementById('editBookGenre').value.trim();
const location = document.getElementById('editBookLocation').value.trim();
const rrlLevel = document.getElementById('editBookRRL').value;  // Get dropdown value
const fileInput = document.getElementById('editBookCover');
if (!title || !author || !location) { showToast('Please fill in title, author, and location', 'error'); return; }

const book = books.find(b => b.id === id);
if (!book) return;

btn.disabled = true; btn.textContent = 'Saving...'; warningEl.classList.remove('show');

try {
    let coverImage = book.coverImage; // Keep existing by default
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
    book.rrlLevel = rrlLevel || 'N/A';  // Use dropdown value
    book.coverImage = coverImage;

    if (await saveBooks()) {
        closeEditBookModal();
        renderBooks();
        openBookDetail(id); // Refresh detail modal if open
        showToast(`"${title}" updated successfully`, 'success');
        setUnsavedChanges(false);  // ✅ Changes saved
    }
} catch (error) {
    console.error('Edit error:', error);
    showToast(`Error updating book: ${error.message}`, 'error');
} finally {
    btn.disabled = false; btn.textContent = 'Update Book'; warningEl.classList.remove('show');
}
}

// In processAddBook function - update this part:
async function processAddBook() {
const btn = document.getElementById('addBookBtn');
const warningEl = document.getElementById('imageSizeWarning');
const title = document.getElementById('newBookTitle').value.trim();
const author = document.getElementById('newBookAuthor').value.trim();
const genre = document.getElementById('newBookGenre').value.trim();
const location = document.getElementById('newBookLocation').value.trim();
const rrlLevel = document.getElementById('newBookRRL').value;  // Get dropdown value
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

// ==================== CONSTANTS ====================
const CSV_BUCKET = 'csv-files';
const MARKDOWN_BUCKET = 'markdown-files';
const NOTES_TABLE = 'notes';
const SUBMISSIONS_TABLE = 'submissions';

// Store for current submission
let currentSubmittedMarkdown = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabSwitching();
    attachEventListeners();
    loadInitialData();
});

// ==================== TAB SWITCHING ====================
function initializeTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove active from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Refresh data when switching to Tab 2 and Tab 3
            if (tabId === 'tab2') {
                loadSubmittedMarkdown();
            } else if (tabId === 'tab3') {
                loadCsvFiles();
                loadNotes();
                loadSubmissions();
            }
        });
    });
}

// ==================== EVENT LISTENERS ====================
function attachEventListeners() {
    // Tab 1: Save Notes (Feedback)
    document.getElementById('saveNotesBtn')?.addEventListener('click', saveNotes);

    // Tab 1: Upload CSV (Resume)
    document.getElementById('uploadCsvBtn')?.addEventListener('click', uploadCsv);

    // Tab 1: Upload Markdown (Optional/Removed in current UI)
    document.getElementById('uploadMarkdownBtn')?.addEventListener('click', uploadMarkdown);

    // Tab 3: Submit Markdown
    document.getElementById('submitMarkdownBtn')?.addEventListener('click', submitMarkdown);

    // File input labels - show file name on selection
    ['csvFileInput', 'markdownFileInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const label = e.target.nextElementSibling;
                if (e.target.files.length > 0 && label && label.classList.contains('file-label')) {
                    label.textContent = e.target.files[0].name;
                }
            });
        }
    });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function showStatus(elementId, message, type = 'success') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message show ${type}`;
}

// ==================== TAB 1: NOTES MANAGEMENT ====================
async function saveNotes() {
    const content = document.getElementById('notesInput').value.trim();

    if (!content) {
        showStatus('uploadStatus', 'Please enter some notes', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from(NOTES_TABLE)
            .insert([{ content }]);

        if (error) throw new Error(error.message);

        showToast('✅ Feedback submitted successfully!', 'success');
        showStatus('uploadStatus', 'Feedback saved to database', 'success');
        document.getElementById('notesInput').value = '';

        // Refresh notes in Tab 3 if visible
        loadNotes();
    } catch (err) {
        console.error('Error saving notes:', err);
        showToast('❌ Failed to save notes', 'error');
        showStatus('uploadStatus', `Error: ${err.message}`, 'error');
    }
}

// ==================== TAB 1: CSV UPLOAD ====================
async function uploadCsv() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];

    if (!file) {
        showStatus('uploadStatus', 'Please select a CSV file', 'error');
        return;
    }

    try {
        // Create timestamped filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${timestamp}_${file.name}`;

        const { error: uploadError } = await supabaseClient.storage
            .from(CSV_BUCKET)
            .upload(fileName, file);

        if (uploadError) throw new Error(uploadError.message);

        showToast('✅ Resume uploaded successfully!', 'success');
        showStatus('uploadStatus', `Uploaded: ${file.name}`, 'success');
        fileInput.value = '';
        const label = document.querySelector('label[for="csvFileInput"]');
        if (label) label.textContent = 'upload resume';

        // Refresh files list in Tab 3
        loadCsvFiles();
    } catch (err) {
        console.error('Error uploading CSV:', err);
        showToast('❌ Failed to upload CSV', 'error');
        showStatus('uploadStatus', `Error: ${err.message}`, 'error');
    }
}

// ==================== TAB 1: MARKDOWN UPLOAD ====================
async function uploadMarkdown() {
    const fileInput = document.getElementById('markdownFileInput');
    const file = fileInput.files[0];

    if (!file) {
        showStatus('uploadStatus', 'Please select a markdown file', 'error');
        return;
    }

    try {
        showStatus('uploadStatus', 'Uploading...', 'info');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${timestamp}_${file.name}`;

        const { error: uploadError } = await supabaseClient.storage
            .from(MARKDOWN_BUCKET)
            .upload(fileName, file);

        if (uploadError) throw new Error(uploadError.message);

        showToast('✅ Lesson uploaded successfully!', 'success');
        showStatus('uploadStatus', `Uploaded: ${file.name}`, 'success');
        fileInput.value = '';
        document.querySelector('label[for="markdownFileInput"]').textContent = '📄 Upload Lesson (MD)';

    } catch (err) {
        console.error('Error uploading markdown:', err);
        showToast('❌ Failed to upload markdown', 'error');
        showStatus('uploadStatus', `Error: ${err.message}`, 'error');
    }
}

// ==================== TAB 2: LOAD SUBMITTED MARKDOWN ====================
async function loadSubmittedMarkdown() {
    try {
        // Try to fetch submission from submissions table
        const { data: submissions, error } = await supabaseClient
            .from(SUBMISSIONS_TABLE)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error && error.code !== 'PGRST116') {
            // PGRST116 means table doesn't exist or no data
            throw new Error(error.message);
        }

        const markdownDisplay = document.getElementById('markdownDisplay');

        if (!submissions || submissions.length === 0) {
            markdownDisplay.innerHTML =
                '<p class="placeholder">No submission yet. Users can submit markdown files in the "Resources & Progress" tab.</p>';
            return;
        }

        const submission = submissions[0];
        if (submission.content) {
            markdownDisplay.innerHTML = `<div class="markdown-view">${renderMarkdown(submission.content)}</div>`;
        }
    } catch (err) {
        console.error('Error loading markdown submission:', err);
        // If table doesn't exist, show placeholder
        document.getElementById('markdownDisplay').innerHTML =
            '<p class="placeholder">No submission yet. Users can submit markdown files in the "Resources & Progress" tab.</p>';
    }
}

// ==================== TAB 3: SUBMIT MARKDOWN ====================
async function submitMarkdown() {
    const textarea = document.getElementById('submissionMarkdownInput');
    const content = textarea.value.trim();

    if (!content) {
        showStatus('submissionStatus', 'Please enter some markdown content', 'error');
        return;
    }

    try {
        const { error: insertError } = await supabaseClient
            .from(SUBMISSIONS_TABLE)
            .insert([{ content }]);

        if (insertError) throw new Error(insertError.message);

        currentSubmittedMarkdown = content;
        showToast('✅ Markdown submitted successfully!', 'success');
        showStatus('submissionStatus', 'Your submission has been saved', 'success');
        textarea.value = '';

        // Refresh submissions list and markdown display
        loadSubmissions();
        setTimeout(() => loadSubmittedMarkdown(), 500);
    } catch (err) {
        console.error('Error submitting markdown:', err);
        showToast('❌ Failed to submit markdown', 'error');
        showStatus('submissionStatus', `Error: ${err.message}`, 'error');
    }
}

// ==================== TAB 3: LOAD & MANAGE SUBMISSIONS ====================
async function loadSubmissions() {
    try {
        const { data: submissions, error } = await supabaseClient
            .from(SUBMISSIONS_TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const submissionsList = document.getElementById('submissionsList');

        if (!submissions || submissions.length === 0) {
            submissionsList.innerHTML = '<p class="placeholder">No submissions yet.</p>';
            return;
        }

        submissionsList.innerHTML = submissions
            .map(sub => createSubmissionItem(sub))
            .join('');
    } catch (err) {
        console.error('Error loading submissions:', err);
        document.getElementById('submissionsList').innerHTML =
            '<p class="placeholder">Error loading submissions. Please try again.</p>';
    }
}

function createSubmissionItem(submission) {
    const timestamp = formatDate(submission.created_at);
    const preview = submission.content.length > 100
        ? submission.content.substring(0, 100) + '...'
        : submission.content;

    return `
        <div class="note-item">
            <div class="note-info">
                <div class="file-name">📄 Markdown Submission</div>
                <div style="margin: 8px 0; color: var(--text-main); font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtml(preview)}</div>
                <div class="file-size">${timestamp}</div>
            </div>
            <div class="note-actions">
                <button class="btn btn-danger" onclick="deleteSubmission('${submission.id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

async function deleteSubmission(submissionId) {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
        const { error } = await supabaseClient
            .from(SUBMISSIONS_TABLE)
            .delete()
            .eq('id', submissionId);

        if (error) throw new Error(error.message);

        showToast('✅ Submission deleted successfully', 'success');
        loadSubmissions();
    } catch (err) {
        console.error('Error deleting submission:', err);
        showToast('❌ Failed to delete submission', 'error');
    }
}

// ==================== TAB 3: LOAD CSV FILES ====================
async function loadCsvFiles() {
    try {
        const { data: files, error } = await supabaseClient.storage
            .from(CSV_BUCKET)
            .list();

        if (error) throw new Error(error.message);

        const csvFilesList = document.getElementById('csvFilesList');

        if (!files || files.length === 0) {
            csvFilesList.innerHTML = '<p class="placeholder">No CSV files uploaded yet.</p>';
            return;
        }

        csvFilesList.innerHTML = files
            .filter(file => !file.name.startsWith('.'))
            .map(file => createFileItem(file))
            .join('');
    } catch (err) {
        console.error('Error loading CSV files:', err);
        document.getElementById('csvFilesList').innerHTML =
            '<p class="placeholder">Error loading files. Please try again.</p>';
    }
}

function createFileItem(file) {
    const { data: { publicUrl } } = supabaseClient.storage
        .from(CSV_BUCKET)
        .getPublicUrl(file.name);

    const sizeKB = (file.metadata.size / 1024).toFixed(2);

    return `
        <div class="file-item">
            <div class="file-info">
                <div class="file-name">📊 ${file.name}</div>
                <div class="file-size">${sizeKB} KB</div>
            </div>
            <div class="file-actions">
                <a href="${publicUrl}" target="_blank" class="btn btn-secondary" style="text-decoration: none;">👁️ View</a>
                <a href="${publicUrl}" download="${file.name}" class="btn btn-secondary" style="text-decoration: none;">⬇️ Download</a>
                <button class="btn btn-danger" onclick="deleteCsvFile('${file.name}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

// ==================== TAB 3: DELETE CSV FILE ====================
async function deleteCsvFile(fileName) {
    if (!confirm(`Are you sure you want to delete the dataset "${fileName}"?`)) return;

    try {
        const { error } = await supabaseClient.storage
            .from(CSV_BUCKET)
            .remove([fileName]);

        if (error) throw new Error(error.message);

        showToast('✅ Dataset deleted successfully', 'success');
        loadCsvFiles();
    } catch (err) {
        console.error('Error deleting CSV file:', err);
        showToast('❌ Failed to delete dataset', 'error');
    }
}

// ==================== TAB 3: LOAD & MANAGE NOTES ====================
async function loadNotes() {
    try {
        const { data: notes, error } = await supabaseClient
            .from(NOTES_TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const notesList = document.getElementById('notesList');

        if (!notes || notes.length === 0) {
            notesList.innerHTML = '<p class="placeholder">No notes saved yet.</p>';
            return;
        }

        notesList.innerHTML = notes
            .map(note => createNoteItem(note))
            .join('');
    } catch (err) {
        console.error('Error loading notes:', err);
        document.getElementById('notesList').innerHTML =
            '<p class="placeholder">Error loading notes. Please try again.</p>';
    }
}

function createNoteItem(note) {
    const timestamp = formatDate(note.created_at || note.timestamp);

    return `
        <div class="note-item">
            <div class="note-info">
                <div class="file-name">📝 ${escapeHtml(note.content.substring(0, 30))}...</div>
                <div style="margin: 8px 0; color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(note.content)}</div>
                <div class="file-size">${timestamp}</div>
            </div>
            <div class="note-actions">
                <button class="btn btn-danger" onclick="deleteNote('${note.id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const { error } = await supabaseClient
            .from(NOTES_TABLE)
            .delete()
            .eq('id', noteId);

        if (error) throw new Error(error.message);

        showToast('✅ Note deleted successfully', 'success');
        loadNotes();
    } catch (err) {
        console.error('Error deleting note:', err);
        showToast('❌ Failed to delete note', 'error');
    }
}

// ==================== MARKDOWN RENDERING ====================
function renderMarkdown(markdownText) {
    // Simple markdown to HTML converter
    let html = escapeHtml(markdownText);

    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Blockquotes
    html = html.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Lists
    html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');

    return `<p>${html}</p>`;
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown date';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (err) {
        return 'Invalid date';
    }
}

async function loadInitialData() {
    // Load notes on initial page load
    try {
        const { data: notes, error } = await supabaseClient
            .from(NOTES_TABLE)
            .select('*')
            .limit(1);

        if (!error && notes) {
            console.log('✅ Connected to Supabase successfully');
        }
    } catch (err) {
        console.warn('Could not load initial data:', err);
    }
}

console.log('App initialized successfully');

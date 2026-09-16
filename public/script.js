const API_URL = '/api';

// --- REGISTER SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// --- DOM ELEMENTS ---
const form = document.getElementById('stoplog-form');
const formTitle = document.getElementById('form-title');
const entryIdInput = document.getElementById('entry-id');
const canalSelect = document.getElementById('canal_id');
const locationInput = document.getElementById('location');
const lInput = document.getElementById('L');
const hInput = document.getElementById('H');
const tInput = document.getElementById('T');
const noInput = document.getElementById('No');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tableBody = document.getElementById('table-body');

const calcTotalHeight = document.getElementById('calc-total-height');
const calcSqm = document.getElementById('calc-sqm');
const calcCum = document.getElementById('calc-cum');

const canalModal = document.getElementById('canal-modal');
const canalModalTitle = document.getElementById('canal-modal-title');
const addCanalBtn = document.getElementById('add-canal-btn');
const editCanalBtn = document.getElementById('edit-canal-btn');
const deleteCanalBtn = document.getElementById('delete-canal-btn');
const newCanalName = document.getElementById('new-canal-name');
const saveCanalBtn = document.getElementById('save-canal-btn');
const cancelCanalBtn = document.getElementById('cancel-canal-btn');

const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('password-input');
const savePasswordBtn = document.getElementById('save-password-btn');
const cancelPasswordBtn = document.getElementById('cancel-password-btn');

let editingCanalId = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadCanals();
    loadStoplogs();
    setupEventListeners();
});

function setupEventListeners() {
    // Live calculation
    [lInput, hInput, tInput, noInput].forEach(input => {
        input.addEventListener('input', calculateValues);
    });

    // Form submit
    form.addEventListener('submit', handleFormSubmit);

    // Cancel edit
    cancelBtn.addEventListener('click', resetForm);

    // Export Excel
    document.getElementById('export-btn').addEventListener('click', () => {
        window.location.href = `${API_URL}/export`;
    });

    // --- CANAL MODAL: ADD ---
    addCanalBtn.addEventListener('click', () => {
        editingCanalId = null;
        canalModalTitle.textContent = 'Add New Canal';
        newCanalName.value = '';
        canalModal.style.display = 'flex';
        setTimeout(() => newCanalName.focus(), 100);
    });

    // --- CANAL MODAL: EDIT ---
    editCanalBtn.addEventListener('click', () => {
        if (!canalSelect.value) {
            alert('Please select a canal from the dropdown to edit.');
            return;
        }
        editingCanalId = canalSelect.value;
        newCanalName.value = canalSelect.options[canalSelect.selectedIndex].text;
        canalModalTitle.textContent = 'Edit Canal';
        canalModal.style.display = 'flex';
        setTimeout(() => newCanalName.focus(), 100);
    });

    // --- CANAL: DELETE ---
deleteCanalBtn.addEventListener('click', async () => {
    if (!canalSelect.value) {
        alert('Please select a canal from the dropdown to delete.');
        return;
    }
    const canalName = canalSelect.options[canalSelect.selectedIndex].text;
    if (!confirm(`Delete canal "${canalName}"?\n\nThis cannot be undone.`)) {
        return;
    }

    try {
        const res = await authedFetch(`${API_URL}/canals/${canalSelect.value}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            await loadCanals();
            loadStoplogs();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.error || 'Error deleting canal.');
        }
    } catch (err) {
        console.error('Error deleting canal:', err);
        alert('Network error. Check your connection.');
    }
});

    // --- CANAL MODAL: SAVE / CANCEL ---
    saveCanalBtn.addEventListener('click', saveCanal);
    cancelCanalBtn.addEventListener('click', closeCanalModal);

    // Close modal when clicking outside the box
    canalModal.addEventListener('click', (e) => {
        if (e.target === canalModal) closeCanalModal();
    });

    // Save with Enter key
    newCanalName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCanal();
        }
    });
}

function closeCanalModal() {
    canalModal.style.display = 'none';
    editingCanalId = null;
}

// --- CALCULATIONS ---
function calculateValues() {
    const L = parseFloat(lInput.value) || 0;
    const H = parseFloat(hInput.value) || 0;
    const T = parseFloat(tInput.value) || 0;
    const No = parseInt(noInput.value) || 0;

    const totalHeight = H * No;
    const sqm = (L * totalHeight) / 1000000;
    const cum = (L * T * totalHeight) / 1000000000;

    calcTotalHeight.textContent = totalHeight.toFixed(2);
    calcSqm.textContent = sqm.toFixed(2);
    calcCum.textContent = cum.toFixed(4);
}

// --- API: CANALS ---
async function loadCanals(selectId = null) {
    try {
        const res = await fetch(`${API_URL}/canals`);
        const canals = await res.json();
        canalSelect.innerHTML = '<option value="">Select Canal</option>';
        canals.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            canalSelect.appendChild(opt);
        });
        if (selectId) canalSelect.value = selectId;
    } catch (err) {
        console.error('Error loading canals:', err);
    }
}

async function saveCanal() {
    const name = newCanalName.value.trim();
    if (!name) {
        alert('Please enter a canal name.');
        return;
    }

    const url = editingCanalId ? `${API_URL}/canals/${editingCanalId}` : `${API_URL}/canals`;
    const method = editingCanalId ? 'PUT' : 'POST';

    try {
        const res = await authedFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (res.ok) {
            const data = await res.json();
            const targetId = editingCanalId || data.id;
            closeCanalModal();
            await loadCanals(targetId);
            loadStoplogs(); // refresh table so renamed canal appears
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.error || 'Error saving canal.');
        }
    } catch (err) {
        console.error('Error saving canal:', err);
        alert('Network error. Check your connection.');
    }
}

// --- API: STOPLOGS ---
async function loadStoplogs() {
    try {
        const res = await fetch(`${API_URL}/stoplogs`);
        const data = await res.json();
        renderTable(data);
    } catch (err) {
        console.error('Error loading stoplogs:', err);
    }
}

function renderTable(data) {
    tableBody.innerHTML = '';
    let currentCanal = '';
    let totalSqm = 0;
    let totalCum = 0;

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9">No entries found. Add one above.</td></tr>';
        return;
    }

    data.forEach(row => {
        if (row.canal_name !== currentCanal) {
            currentCanal = row.canal_name;
            const headerRow = document.createElement('tr');
            headerRow.className = 'canal-header-row';
            headerRow.innerHTML = `<td colspan="9">${currentCanal}</td>`;
            tableBody.appendChild(headerRow);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.location}</td>
            <td>${row.L}</td>
            <td>${row.H}</td>
            <td>${row.T}</td>
            <td>${row.No}</td>
            <td>${Number(row.total_height).toFixed(2)}</td>
            <td>${Number(row.qty_sqm).toFixed(2)}</td>
            <td>${Number(row.qty_cum).toFixed(4)}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editEntry(${row.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteEntry(${row.id})">Delete</button>
            </td>
        `;
        tableBody.appendChild(tr);

        totalSqm += row.qty_sqm;
        totalCum += row.qty_cum;
    });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = 'rgba(0, 243, 255, 0.08)';
    totalRow.innerHTML = `
        <td colspan="6" style="text-align: right;">Total Quantity:</td>
        <td>${totalSqm.toFixed(2)}</td>
        <td>${totalCum.toFixed(4)}</td>
        <td></td>
    `;
    tableBody.appendChild(totalRow);
}

// --- FORM SUBMIT ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = entryIdInput.value;
    const payload = {
        canal_id: parseInt(canalSelect.value),
        location: locationInput.value,
        L: parseFloat(lInput.value),
        H: parseFloat(hInput.value),
        T: parseFloat(tInput.value),
        No: parseInt(noInput.value)
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/stoplogs/${id}` : `${API_URL}/stoplogs`;

    try {
        const res = await authedFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            resetForm();
            loadStoplogs();
        } else {
            alert('Error saving entry.');
        }
    } catch (err) {
        console.error('Error saving entry:', err);
    }
}

function resetForm() {
    form.reset();
    entryIdInput.value = '';
    formTitle.textContent = 'Add New Entry';
    submitBtn.textContent = 'Save Entry';
    cancelBtn.style.display = 'none';
    calculateValues();
}

// --- EDIT / DELETE ---
async function editEntry(id) {
    try {
        const res = await authedFetch(`${API_URL}/stoplogs`);
        const data = await res.json();
        const entry = data.find(row => row.id === id);
        if (!entry) return;

        entryIdInput.value = entry.id;
        canalSelect.value = entry.canal_id;
        locationInput.value = entry.location;
        lInput.value = entry.L;
        hInput.value = entry.H;
        tInput.value = entry.T;
        noInput.value = entry.No;
        calculateValues();

        formTitle.textContent = 'Edit Entry';
        submitBtn.textContent = 'Update Entry';
        cancelBtn.style.display = 'block';
        document.getElementById('form-container').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Error fetching entry for edit:', err);
    }
}

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
        const res = await authedFetch(`${API_URL}/stoplogs/${id}`, { method: 'DELETE' });
        if (res.ok) loadStoplogs();
    } catch (err) {
        console.error('Error deleting entry:', err);
    }
}

// --- PASSWORD HELPERS ---
function getStoredPassword() {
    return localStorage.getItem('editPassword') || '';
}

function setStoredPassword(pwd) {
    localStorage.setItem('editPassword', pwd);
}

// Wraps fetch so all write requests automatically include the password header
async function authedFetch(url, options = {}) {
    const pwd = getStoredPassword();
    options.headers = {
        ...(options.headers || {}),
        'X-Edit-Password': pwd
    };
    const res = await fetch(url, options);

    // If unauthorized, prompt for password and retry once
    if (res.status === 401) {
        const entered = prompt('Editor password required:');
        if (entered) {
            setStoredPassword(entered);
            options.headers['X-Edit-Password'] = entered;
            return fetch(url, options);
        }
    }
    return res;
}
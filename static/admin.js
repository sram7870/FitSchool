// Initialize icons
lucide.createIcons();



// Short helper
const q = s => document.querySelector(s);
const qa = s => Array.from(document.querySelectorAll(s));
const animate = (el, props, opts = {}) => window.motion?.animate(el, props, opts); // motion one wrapper

// backendAPI helpers
async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) return res.json();
    return {};
}



/* ================= MODAL HELPERS ================= */
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    // pop anim using GSAP
    const content = el.querySelector('.card, .relative');
    if (content) gsap.fromTo(content, {
        y: 18,
        scale: 0.99,
        opacity: 0
    }, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out'
    });
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
}

/* ================= MESSENGER PANEL ================= */
console.log("Messenger JS loaded");  // should appear in the console

// Mini helper if missing
if (typeof q !== 'function') {
    window.q = sel => document.querySelector(sel);
}

// Safe DOM getters
function getOpenButtons() {
    return Array.from(document.querySelectorAll('.openMessages'));
}

function getCloseButton() {
    return document.querySelector('#closeMessenger');
}

// --- OPEN MESSENGER (modal wrapper) ---
function openMessenger() {
    openModal('messengerModal');
}

// --- CLOSE MESSENGER ---
function closeMessenger() {
    closeModal('messengerModal');
}

// --- ATTACH EVENT LISTENERS ---
getOpenButtons().forEach(btn =>
    btn.addEventListener('click', openMessenger)
);

const closeBtn = getCloseButton();
if (closeBtn) closeBtn.addEventListener('click', closeMessenger);


// ================== MESSAGING LOGIC ==================
let activeThread = null;

function openThread(threadId) {
    activeThread = threadId;

    const msgTo = q('#msgTo');
    const chatWindow = q('#chatWindow');

    if (!msgTo || !chatWindow) return;

    msgTo.value = threadId;
    chatWindow.innerHTML = ''; // Clear chat

    // Mock messages (replace with backend later)
    const messages = [
        { from: 'them', text: 'Hey — can you review the new form?', ts: '11:12' },
        { from: 'me', text: 'Sure — I will review this afternoon.', ts: '11:14' }
    ];

    messages.forEach(m => {
        const div = document.createElement('div');
        div.className = `max-w-[80%] mb-2 ${m.from === 'me' ? 'ml-auto text-right' : ''}`;
        div.innerHTML = `
            <div class="inline-block p-3 rounded-xl ${
            m.from === 'me'
                ? 'bg-[linear-gradient(180deg,#0d1b17,#0a1512)] text-white'
                : 'bg-gray-100 text-black'
        }">${m.text}</div>
            <div class="text-xs opacity-60 mt-1">${m.ts}</div>
        `;
        chatWindow.appendChild(div);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- SEND MESSAGE ---
async function sendMessage() {
    const msgTo = q('#msgTo');
    const msgInput = q('#msgInput');
    const chatWindow = q('#chatWindow');

    if (!msgTo || !msgInput || !chatWindow) return;

    const to = msgTo.value.trim();
    const text = msgInput.value.trim();

    if (!to || !text) {
        alert('Select a thread and type a message.');
        return;
    }

    // local append
    const div = document.createElement('div');
    div.className = 'ml-auto text-right mb-2';
    div.innerHTML = `
        <div class="inline-block p-3 rounded-xl bg-[linear-gradient(180deg,#0d1b17,#0a1512)] text-white">${text}</div>
        <div class="text-xs opacity-60 mt-1">Now</div>
    `;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    msgInput.value = '';

    // server send
    try {
        await apiFetch('/admin/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, text })
        });
    } catch (e) {
        console.warn('Message send failed (offline or placeholder).', e);
    }
}


/* ================= SEARCH AUTOCOMPLETE ================= */
const searchBox = q('#searchBox');
const autocomplete = q('#autocomplete');
const autoResults = q('#autoResults');
let debounceTimer = null;
let selectedIndex = -1;
let currentResults = [];

searchBox.addEventListener('input', onSearchInput);
searchBox.addEventListener('keydown', (e) => {
    const items = qa('.auto-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        highlight(items);
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        highlight(items);
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && currentResults[selectedIndex]) goToResult(currentResults[selectedIndex]);
        else triggerSearch();
    }
    if (e.key === 'Escape') {
        hideAuto();
    }
});

function highlight(items) {
    items.forEach((it, i) => it.classList.toggle('bg-gray-50', i === selectedIndex));
    if (items[selectedIndex]) items[selectedIndex].scrollIntoView({
        block: 'nearest'
    });
}

function hideAuto() {
    autocomplete.classList.add('hidden');
    autoResults.innerHTML = '';
    selectedIndex = -1;
    currentResults = [];
}

function onSearchInput(e) {
    const qv = e.target.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!qv) {
        hideAuto();
        return;
    }
    debounceTimer = setTimeout(() => fetchSuggestions(qv), 280);
}

async function fetchSuggestions(query) {
    try {
        const res = await apiFetch(`/admin/search?q=${encodeURIComponent(query)}`);
        currentResults = data || [];
        renderAuto(data || []);
    } catch (e) {
        console.error('Autocomplete failed', e);
    }
}

function renderAuto(items) {
    autoResults.innerHTML = '';
    if (!items || items.length === 0) {
        autoResults.innerHTML = `<div class="p-3 small muted">No results</div>`;
        autocomplete.classList.remove('hidden');
        return;
    }
    items.slice(0, 8).forEach((it, idx) => {
        const div = document.createElement('button');
        div.className = 'w-full text-left p-3 auto-item hover:bg-gray-50 rounded-md';
        div.innerHTML = `<div class="flex items-center justify-between"><div><div class="font-medium">${it.name}</div><div class="small muted">${it.role}</div></div><div class="small muted">ID:${it.id}</div></div>`;
        div.addEventListener('click', () => goToResult(it));
        autoResults.appendChild(div);
    });
    autocomplete.classList.remove('hidden');
    selectedIndex = -1;
}

function goToResult(item) {
    hideAuto();
    if (item.role === 'student') window.location.href = `/student/profile/${item.id}`;
    else if (item.role === 'teacher') window.location.href = `/teacher/${item.id}/classes`;
    else window.location.href = `/user/${item.id}`;
}

function triggerSearch() {
    const qv = searchBox.value.trim();
    if (!qv) return alert('Please enter a search query.');
    apiFetch(`/admin/search?q=${encodeURIComponent(qv)}`)
        .then(r => r.json())
        .then(data => {
            if (!data || data.length === 0) return alert('No results found.');
            const pick = data[0];
            goToResult(pick);
        }).catch(() => alert('Search failed.'));
}

document.getElementById('searchBtn')?.addEventListener('click', triggerSearch);

/* ================= STATS ANIMATION (rings) ================= */
function setArc(pathEl, percent) {
    // percent: 0..100
    const circumference = 2 * Math.PI * 15.91549430918954;
    const length = circumference * (percent / 100);
    const strokeDasharray = `${length} ${circumference - length}`;
    pathEl.setAttribute('d', describeArc(18, 18, 15.91549430918954, 0, (percent / 100) * 360));
}

// arc helper - returns SVG path for arc (approx) — we will use simple circle arc path creation
// convert polar to Cartesian
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeArc(x, y, radius, startAngle, endAngle) {
    var start = polarToCartesian(x, y, radius, endAngle);
    var end = polarToCartesian(x, y, radius, startAngle);
    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    var d = [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
    return d;
}

function animateRings(stats) {
    const mappings = [
        { selector: '#activeArc',       value: stats.activePct,      label: '#activeCount' },
        { selector: '#completionArc',   value: stats.completionPct,  label: '#completionPercent' },
        { selector: '#participationArc', value: stats.weeklyPct,     label: '#weeklyParticipation' },
        { selector: '#teacherArc',      value: stats.teacherPct,     label: '#teacherEng' }
    ];

    mappings.forEach(m => {
        const path = document.querySelector(m.selector);
        if (!path) return;

        // target object for tweening
        const tweenObj = { v: 0 };

        gsap.fromTo(
            tweenObj,
            { v: 0 },
            {
                v: m.value,
                duration: 1.1,
                ease: 'power3.out',
                onUpdate: () => {
                    const pct = tweenObj.v || 0;
                    path.setAttribute(
                        'd',
                        describeArc(18, 18, 15.91549430918954, 0, (pct / 100) * 360)
                    );

                    if (m.label) {
                        const el = document.querySelector(m.label);
                        if (el) {
                            el.innerText =
                                Math.round(pct) +
                                (m.selector === '#completionArc' ? '%' : '');
                        }
                    }
                }
            }
        );
    });

    // goal bar
    const goal = Math.min(100, stats.goalPct || 0);
    gsap.to('#goalBar', {
        width: goal + '%',
        duration: 1.0,
        ease: 'power3.out'
    });

    if (typeof q === 'function' && q('#statsUpdated')) {
        q('#statsUpdated').innerText = new Date().toLocaleString();
    }
}


// initial demo stats — in real case fetch from server
const demoStats = {
    activePct: 68,
    completionPct: 72,
    weeklyPct: 54,
    teacherPct: 81,
    goalPct: 68
};
setTimeout(() => animateRings(demoStats), 420);

document.getElementById('refreshStats').addEventListener('click', () => {
    // fetch /admin/stats — placeholder
    // simulate small change
    const fluct = () => Math.max(10, Math.min(95, demoStats.activePct + (Math.random() * 6 - 3)));
    demoStats.activePct = Math.round(fluct());
    demoStats.completionPct = Math.round(Math.max(10, Math.min(95, demoStats.completionPct + (Math.random() * 6 - 3))));
    demoStats.weeklyPct = Math.round(Math.max(5, Math.min(95, demoStats.weeklyPct + (Math.random() * 6 - 3))));
    animateRings(demoStats);
});

/* ================= PAGINATION FOR CLASSES ================= */
const classesGrid = document.getElementById('classesGrid');
const classCards = classesGrid ? Array.from(classesGrid.querySelectorAll('article.card')) : [];
let perPage = 12;
let currentPage = 1;
const total = classCards.length;
const totalPages = Math.max(1, Math.ceil(total / perPage));

const elPrev = document.getElementById('prevPage');
const elNext = document.getElementById('nextPage');
const elCurrent = document.getElementById('currentPage');
const elRange = document.getElementById('classesRange');
const elTotal = document.getElementById('classesTotal');

if (elTotal) elTotal.innerText = total;

function renderPage(page) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    classCards.forEach(c => c.style.display = 'none');
    const start = (currentPage - 1) * perPage;
    const end = Math.min(total, start + perPage);
    classCards.slice(start, end).forEach(c => c.style.display = '');
    if (elCurrent) elCurrent.innerText = currentPage;
    if (elRange) elRange.innerText = `${start+1}–${end}`;
    if (elPrev) elPrev.disabled = currentPage === 1;
    if (elNext) elNext.disabled = currentPage === totalPages;
    // animate visible cards
    gsap.fromTo(classCards.slice(start, end), {
        y: 8,
        opacity: 0,
        scale: .995
    }, {
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.04,
        duration: 0.48,
        ease: 'power3.out'
    });
}

elPrev?.addEventListener('click', () => renderPage(currentPage - 1));
elNext?.addEventListener('click', () => renderPage(currentPage + 1));
if (total > 0) renderPage(1);

/* ================= USER MGMT (Unified) ================= */
function switchUserTab(tab) {
    ['add', 'role', 'assign'].forEach(t => {
        const el = q('#tab-' + t);
        if (el) el.classList.toggle('hidden', t !== tab);
    });
}
// default tab
switchUserTab('add');

async function addUserUnified() {
    const name = q('#u_name').value.trim();
    const email = q('#u_email').value.trim().toLowerCase();
    const role = q('#u_role').value.trim().toLowerCase();
    const password = q('#u_password').value.trim(); // optional

    if (!name || !email || !role) return alert('Name, email, and role are required.');

    const payload = {
        name,
        email,
        role
    };
    if (password) payload.password = password; // send if admin set it

    try {
        const res = await apiFetch('/admin/add_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) return alert(data.error);
        alert(data.message || 'User added successfully');
        closeModal('userMgmtModal');
        location.reload();
    } catch (e) {
        console.error(e);
        alert('Add user failed');
    }
}

async function changeRoleUnified() {
    const email = q('#role_email').value.trim().toLowerCase();
    const role = q('#role_new').value.trim().toLowerCase();
    if (!email) return alert('Email required.');

    try {
        const res = await apiFetch('/admin/change_role', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                role
            })
        });
        const data = await res.json();
        if (data.error) return alert(data.error);
        alert(data.message || 'Role updated');
        closeModal('userMgmtModal');
    } catch (e) {
        console.error(e);
        alert('Update failed');
    }
}


async function assignUnified() {
    const teacher = q('#assign_teacher').value.trim();
    const student = q('#assign_student').value.trim();
    const cls = q('#assign_class').value.trim() || null;

    if (!teacher || !student) return alert('Teacher and student required.');

    // Determine if input is email or numeric ID
    const payload = {
        class_id: cls
    };
    payload.teacher_email = teacher.includes('@') ? teacher.toLowerCase() : undefined;
    payload.teacher_id = !teacher.includes('@') ? parseInt(teacher) : undefined;
    payload.student_email = student.includes('@') ? student.toLowerCase() : undefined;
    payload.student_id = !student.includes('@') ? parseInt(student) : undefined;

    try {
        const res = await apiFetch('/admin/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) return alert(data.error);
        alert(data.message || 'Assigned');
        closeModal('userMgmtModal');
    } catch (e) {
        console.error(e);
        alert('Assign failed');
    }
}


/* ================= BULK UPLOAD ================= */
async function bulkUpload() {
    const type = q('#bulkType').value;
    const file = q('#bulkFile').files[0];
    if (!file) return alert('Select a CSV file.');
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    q('#bulkOutput').innerText = 'Uploading...';
    try {
        const res = await apiFetch('/admin/bulk_upload', {
            method: 'POST',
            body: form
        });
        const data = await res.json();
        q('#bulkOutput').innerText = data.message || 'Upload complete';
        if (data.errors) q('#bulkOutput').innerText += ` — ${data.errors.length} errors`;
    } catch (e) {
        console.error(e);
        q('#bulkOutput').innerText = 'Upload failed';
    }
}

/* ================= ACTIVITY & NOTIFICATIONS ================= */
async function sendNotification() {
    const title = q('#notifTitle').value.trim();
    const message = q('#notifMessage').value.trim();
    if (!title || !message) return alert('Title and message are required.');
    try {
        const res = await apiFetch('/admin/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                message
            })
        });
        const data = await res.json();
        alert(data.message || 'Notification sent');
        closeModal('notificationsModal');
    } catch (e) {
        console.error(e);
        alert('Send failed');
    }
}

/* ================= CLASS MANAGEMENT ================= */
async function createClass() {
    const name = q('#className').value.trim();
    const desc = q('#classDesc').value.trim();
    const teacher = q('#classTeacher').value.trim();
    if (!name) return alert('Class name required.');
    try {
        const res = await apiFetch('/admin/class/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                description: desc,
                teacher
            })
        });
        const data = await res.json();
        if (data.error) return alert(data.error);
        alert(data.message || 'Class created');
        closeModal('classManageModal');
        location.reload();
    } catch (e) {
        console.error(e);
        alert('Create failed');
    }
}

/* ================= SMALL UIs & KEYBINDINGS ================= */
// keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
        openMessenger();
    }
    if (e.key === '/') {
        e.preventDefault();
        q('#searchBox').focus();
    }
});

// simple tooltips / hover animations
gsap.fromTo('main .card', {
    y: 12,
    opacity: 0
}, {
    y: 0,
    opacity: 1,
    duration: 0.6,
    stagger: 0.04,
    ease: 'power3.out'
});

// close autocomplete when clicking away
document.addEventListener('click', (e) => {
    const ac = q('#autocomplete');
    if (ac && !ac.contains(e.target) && !q('#searchBox')?.contains(e.target)) hideAuto();
});

// small accessibility focus outlines when tabbing
document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') {
        document.body.classList.add('show-focus');
    }
});

// Expose functions for inline HTML handlers
Object.assign(window, {
    openModal, closeModal, openMessenger, closeMessenger, openThread, sendMessage,
    triggerSearch, goToResult, switchUserTab, addUserUnified, changeRoleUnified,
    assignUnified, bulkUpload, sendNotification, createClass
});


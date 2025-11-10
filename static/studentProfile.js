// === Seven mock payloads for each ML model ===
const MOCK_MODEL_INPUTS = {
    "trend-ensemble": {
        timeseries: Array.from({ length: 90 }, (_, i) => ({ t: i, v: 40 + Math.sin(i / 3) * 3 })),
        seasonal: true,
        contextual: { sleep: 7.2, stress: 0.31, workload: 0.78 }
    },
    "injury-risk": {
        pastInjuries: ["ankle_sprain_2024", "quad_tweak_2023"],
        workload7d: [4.1, 3.9, 4.8, 5.2, 3.7, 4.6, 4.9],
        biomech: { asymmetry: 0.12, strideVar: 0.07, forceLeft: 910, forceRight: 860 }
    },
    "technique-analysis": {
        joints: Array.from({ length: 400 }, () => ({
            hip: [Math.random(), Math.random()],
            knee: [Math.random(), Math.random()],
            ankle: [Math.random(), Math.random()]
        })),
        fps: 30,
        action: "sprint_start"
    },
    "workload-optimizer": {
        schedule: {
            mon: { intensity: 0.7, volume: 0.6 },
            tue: { intensity: 0.4, volume: 0.8 },
            wed: { intensity: 0.8, volume: 0.4 },
            thu: { intensity: 0.6, volume: 0.9 },
            fri: { intensity: 0.9, volume: 0.7 }
        },
        goals: { speed: true, endurance: false, power: true }
    },
    "recovery-predictor": {
        hrv: [98, 102, 101, 104, 99, 97, 103],
        soreness: 0.21,
        sleep: [6.9, 7.5, 7.1, 6.7, 7.8]
    },
    "talent-scout": {
        metrics: {
            speed: 8.41,
            agility: 4.91,
            powerIndex: 91,
            durability: 0.82,
            tactical: 0.74
        },
        peerComparison: "regional"
    },
    "personalized-plan": {
        baseline: {
            vjump: 44,
            sprint: 8.4,
            strength: { bench: 90, clean: 82 }
        },
        constraints: { equipment: "full_gym", daysAvailable: 5 },
        preferences: { style: "explosive", hates: "long_runs" }
    }
};

// student_profile.js
// JavaScript for multi-page public profile (frontend). Designed to pair with student_profile.html
// Responsibilities:
//  - page/tab navigation
//  - rendering profile data (replace mock fetches with your backend endpoints)
//  - chart rendering (lazy-load Chart.js)
//  - modal controls
//  - model-run helpers (POST to backend endpoints which should call OpenRouter / model wrappers)
//  - file upload handling for technique-analysis

/* ========== Helpers ========== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
function setText(sel, text){ const el = $(sel); if(el) el.textContent = text; }
function show(el){ if(!el) return; el.classList.remove('hidden'); document.body.style.overflow='hidden'; }
function hide(el){ if(!el) return; el.classList.add('hidden'); document.body.style.overflow=''; }

/* ========== State & Mock Data (replace with fetches) ========== */
let PROFILE = null; // will be populated from backend

const MOCK_PROFILE = {
    id: 1234,
    displayName: 'Alex Parker',
    classYear: '2026',
    summary: 'Student-athlete passionate about track & field and strength training.',
    profilePic: '',
    sports: ['Track (Spring 2025)', 'Soccer (Fall 2024)'],
    achievements: [{id:1,title:'Player of the Week',date:'2025-10-20'},{id:2,title:'5-session streak',date:'2025-11-01'}],
    stats: { vjump:44, broad:195, hangclean:82, bench:90, maxsprint:8.4, consistency:86 },
    history: [ ['2025-05-01','vjump',40], ['2025-07-01','vjump',42], ['2025-09-01','vjump',44] ],
    badges: [{id:'b1',title:'Effort Badge'},{id:'b2',title:'Team Player'}],
    credits: 6,
    lastActive: '2025-11-08',
    followers: ['Jane Doe','Coach Matt'],
    following: ['Team A']
};

/* ========== UI Rendering ========== */
function renderBasicProfile(profile){
    PROFILE = profile;
    setText('#displayName', profile.displayName || '—');
    setText('#classYear', profile.classYear ? `Class of ${profile.classYear}` : '—');
    setText('#profileSummary', profile.summary || '—');
    if(profile.profilePic){ const img = $('#profilePic'); if(img) img.src = profile.profilePic; }
    setText('#badgeCredits', `${profile.credits || 0} credits`);
    setText('#badgeBadges', `${(profile.badges||[]).length} badges`);
    setText('#lastActive', profile.lastActive || '—');

    const sportsEl = $('#profileSportsList'); if(sportsEl) sportsEl.innerHTML = (profile.sports||[]).map(s=>`<div>${escapeHtml(s)}</div>`).join('');
    const achEl = $('#profileAchievementsList'); if(achEl) achEl.innerHTML = (profile.achievements||[]).map(a=>`<div class="font-medium">${escapeHtml(a.title)}</div><div class="small muted">${escapeHtml(a.date)}</div>`).join('');
    const followersEl = $('#followersList'); if(followersEl) followersEl.textContent = (profile.followers||[]).join(', ');
    const followingEl = $('#followingList'); if(followingEl) followingEl.textContent = (profile.following||[]).join(', ');
    const badgesGrid = $('#badgesGrid'); if(badgesGrid) badgesGrid.innerHTML = (profile.badges||[]).map(b=>`<div class="card p-2">${escapeHtml(b.title)}</div>`).join('');

    // perf table
    const tbody = $('#perfTable tbody'); if(tbody){ tbody.innerHTML = ''; for(const [k,v] of Object.entries(profile.stats||{})){ const row = document.createElement('tr'); row.innerHTML = `<td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td><td>${escapeHtml(profile.lastActive||'—')}</td>`; tbody.appendChild(row); } }

    // clear model outputs placeholder
    ['trend-ensemble','injury-risk','technique-analysis','workload-optimizer','recovery-predictor','talent-scout','personalized-plan'].forEach(k=>{ const el = $(`#out-${k}`); if(el) el.textContent = 'No run yet.'; });

    // activity
    const act = $('#activityFeed'); if(act) act.innerHTML = `<div class="card p-3">${escapeHtml(profile.lastActive || '—')} • Completed 5 sessions streak</div>`;
}

/* ========== Utilities ========== */
function escapeHtml(str){ if(typeof str !== 'string') return str; return str.replace(/[&<>"'`]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':"&#39;",'`':'&#96;' })[s]); }

/* ========== Tabs & Navigation ========== */
function initTabs(){
    const tabs = $$('.tab'); tabs.forEach(t=> t.addEventListener('click', ()=>{ tabs.forEach(x=> x.classList.remove('active')); t.classList.add('active'); const tgt = t.dataset.target; $$('.page').forEach(p=> p.classList.add('hidden')); const el = document.getElementById(tgt); if(el) el.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }));
}

/* ========== Charting ========== */
function loadChartLibrary(){ return new Promise((resolve,reject)=>{
    if(window.Chart) return resolve(window.Chart);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = ()=> resolve(window.Chart); s.onerror = reject; document.body.appendChild(s);
});
}

async function drawProgressChart(){
    try{
        await loadChartLibrary();
        const ctx = document.getElementById('profileProgressChart'); if(!ctx) return;
        const history = (PROFILE && PROFILE.history) || MOCK_PROFILE.history;
        const labels = history.map(h=> h[0]);
        const data = history.map(h=> h[2]);
        new Chart(ctx.getContext('2d'), {
            type:'line', data: { labels, datasets:[{ label:'Vertical Jump (cm)', data, tension:0.3, fill:true, backgroundColor:'rgba(6,46,30,0.06)', borderColor:'#0B8B5A', pointRadius:3 }] },
            options:{ plugins:{ legend:{ display:false } }, scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:'rgba(6,46,30,0.05)' } } }
            }});
    }catch(e){ console.warn('Chart failed to load', e); }
    }

    /* ========== CSV Export ========== */
    function downloadCSV(){ const profile = PROFILE || MOCK_PROFILE; const rows = [['metric','value'], ...Object.entries(profile.stats||{})]; const csv = rows.map(r=> r.join(',')).join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `profile-${profile.id||'unknown'}-stats.csv`; a.click(); URL.revokeObjectURL(url); }

    /* ========== Activity ========== */
    function postActivity(){ const text = $('#activityPost').value.trim(); if(!text){ alert('Add text'); return; } const item = document.createElement('div'); item.className='card p-3'; item.innerHTML = `<div class="font-medium">You</div><div class="small muted mt-1">${escapeHtml(text)}</div>`; $('#activityFeed').prepend(item); $('#activityPost').value = ''; }

    /* ========== Modals & Small Actions ========== */
    function initUIActions(){
        $('#shareProfile') && $('#shareProfile').addEventListener('click', ()=>{ navigator.clipboard.writeText(location.href).then(()=> alert('Profile link copied (mock)')).catch(()=> alert('Could not copy')); });
        $('#downloadProfileStats') && $('#downloadProfileStats').addEventListener('click', downloadCSV);
        $('#followBtn') && $('#followBtn').addEventListener('click', ()=> alert('Followed (mock)'));
        $('#messageBtn') && $('#messageBtn').addEventListener('click', ()=> alert('Open message composer (mock)'));
        $('#moreBtn') && $('#moreBtn').addEventListener('click', ()=> { $('#moreMenu').classList.toggle('hidden'); });
        $('#activityPost') && $('#activityPost').addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.ctrlKey || e.metaKey)) postActivity(); });
        const endorseBtn = $('#endorseModal') && $('#endorseModal').querySelector('button'); // not used, keep skeleton
    }

    /* ========== Fetch / Backend helpers (replace endpoints) ========== */
    async function fetchProfile(profileId){
        // Replace with: const res = await fetch(`/api/profile/${profileId}`)
        // if(res.ok) return await res.json(); else throw new Error('fetch failed')
        // For now return mock
        await new Promise(r=> setTimeout(r, 200));
        return JSON.parse(JSON.stringify(MOCK_PROFILE));
    }

/* ========== Model runner helpers ========== */
// runModel: calls backend endpoint that should handle OpenRouter + model wrappers
async function runModel(modelKey, opts = {}) {
    const panel = document.getElementById(`model-${modelKey}-result`);
    if (panel) {
        panel.innerHTML = `<p class='text-sm text-gray-600'>Running ${modelKey}...</p>`;
    }

    const profileId = window.CURRENT_PROFILE_ID;
    if (!profileId) {
        console.error("Missing profile ID");
        return;
    }

    // apply mock payload
    const mock = opts.mockOverride || MOCK_MODEL_INPUTS[modelKey] || {};

    try {
        const res = await fetch(`/api/profile/${profileId}/models/${modelKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                profileId,
                options: opts,
                mockInput: mock
            })
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = await res.json();
        renderModelResult(modelKey, data);
        return data;
    } catch (err) {
        console.error(err);
        if (panel) {
            panel.innerHTML =
                `<p class='text-red-600 text-sm'>Model failed.</p>`;
        }
    }
}

function formatModelOutput(data){
    const model = data.model || 'model';
    const summary = data.summary || data.explaination || '—';
    const conf = (data.confidence !== undefined) ? `${Math.round((data.confidence||0)*100)}%` : '—';
    const details = data.details ? `<pre class="mt-2 small muted">${escapeHtml(JSON.stringify(data.details, null, 2))}</pre>` : '';
    return `<div class="card p-3"><div class="font-medium">${escapeHtml(model)}</div><div class="small muted mt-1">${escapeHtml(summary)}</div><div class="small muted mt-2">Confidence: ${conf}</div>${details}<div class="mt-2"><button class="btn-outline" onclick="viewModelDetail('${escapeJs(model)}')">Open details</button></div></div>`;
}

/* ========== Model detail view ========== */
async function viewModelDetail(modelKey){
    show($('#modelDetailModal'));
    setText('#modelDetailTitle', modelKey);
    setText('#modelDetailBody', 'Loading details…');
    try{
        const res = await fetch(`/api/profile/${PROFILE.id}/models/${modelKey}/detail`);
        if(!res.ok){ setText('#modelDetailBody', 'No details available.'); return; }
        const data = await res.json();
        $('#modelDetailBody').innerHTML = `<div class="small muted">${escapeHtml(data.explaination || data.summary || '—')}</div><pre class="mt-2 small muted">${escapeHtml(JSON.stringify(data.details||data, null, 2))}</pre>`;
    }catch(e){ setText('#modelDetailBody', 'Failed to load details.'); console.error(e); }
}

/* ========== Technique analysis upload helper ========== */
async function uploadTechniqueVideo(file){
    if(!file) return alert('No file');
    const out = $('#out-technique-analysis'); if(out) out.textContent = 'Uploading...';
    const fd = new FormData(); fd.append('video', file); fd.append('profileId', PROFILE.id);
    try{
        const res = await fetch(`/api/profile/${PROFILE.id}/models/technique-analysis`, { method:'POST', body: fd });
        if(!res.ok){ out.textContent = 'Upload failed'; return; }
        const data = await res.json(); out.innerHTML = formatModelOutput(data);
    }catch(e){ out.textContent = 'Failed to upload'; console.error(e); }
}

/* ========== Misc: reporting, endorsements, badges ========== */
async function submitReport(){ const text = $('#reportText').value.trim(); if(!text) return alert('Please explain'); try{ const res = await fetch(`/api/profile/${PROFILE.id}/report`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) }); if(res.ok){ alert('Report sent'); hide($('#reportModal')); $('#reportText').value=''; } else { alert('Failed to send report'); }}catch(e){ alert('Network error'); }}
async function submitEndorse(){ const text = $('#endorseText').value.trim(); if(!text) return alert('Add endorsement'); try{ const res = await fetch(`/api/profile/${PROFILE.id}/endorse`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) }); if(res.ok){ alert('Endorsed'); hide($('#endorseModal')); $('#endorseText').value=''; } else alert('Failed'); }catch(e){ alert('Network error'); }}
async function submitEditRequest(){ const text = $('#editField').value.trim(); if(!text) return alert('Add suggestion'); try{ const res = await fetch(`/api/profile/${PROFILE.id}/edit-request`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) }); if(res.ok){ alert('Request sent'); hide($('#editProfileModal')); $('#editField').value=''; } else alert('Failed'); }catch(e){ alert('Network error'); }}
async function awardBadge(){ const title = $('#awardBadgeTitle').value.trim(); if(!title) return alert('Add a title'); try{ const res = await fetch(`/api/profile/${PROFILE.id}/badge`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ title }) }); if(res.ok){ alert('Badge awarded (mock)'); hide($('#awardBadgeModal')); $('#awardBadgeTitle').value=''; } else alert('Failed'); }catch(e){ alert('Network error'); }}

/* ========== Small helpers to escape in JS context ========== */
function escapeJs(str){ return String(str||'').replace(/'/g,"\\'").replace(/\n/g,'\\n'); }

/* ========== Init ========== */
async function init(profileId){
    initTabs(); initUIActions();
    try{
        const p = await fetchProfile(profileId); renderBasicProfile(p); await drawProgressChart();
        // attach file listener for technique video input
        document.addEventListener('change', (e)=>{ if(e.target && e.target.id === 'techVideo' && e.target.files && e.target.files[0]) uploadTechniqueVideo(e.target.files[0]); });

        // wire model run buttons (delegated)
        document.addEventListener('click', (e)=>{
            const btn = e.target.closest && e.target.closest('button'); if(!btn) return;
            if(btn.dataset && btn.dataset.modelKey) runModel(btn.dataset.modelKey);
        });

        // wire specific buttons for inline HTML that used onclick in markup
        window.runModel = runModel; window.viewModelDetail = viewModelDetail; window.uploadTechniqueVideo = uploadTechniqueVideo; // keep available globally for markup callbacks

    }catch(err){ console.error('Init failed', err); // fallback render mock
        renderBasicProfile(MOCK_PROFILE); await drawProgressChart(); }
}

// Auto-init using data-profile-id attribute on body or default
document.addEventListener('DOMContentLoaded', ()=>{
    const body = document.body; const pid = body.getAttribute('data-profile-id') || MOCK_PROFILE.id; init(pid);
});

/* ========== Exports for testing or module usage ========== */
if(typeof module !== 'undefined'){ module.exports = { renderBasicProfile, runModel, viewModelDetail, uploadTechniqueVideo }; }

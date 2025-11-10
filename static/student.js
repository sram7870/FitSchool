/* student.js — frontend logic for student_dashboard.html
   - Hooks tab navigation, modals, forms, charts, exports, and messenger stubs
   - Uses fetch to call backend endpoints (/api/student/...) when available
   - Includes mock state for local preview; replace with server data
*/

// Safe selectors
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from((ctx || document).querySelectorAll(sel));

// --- App state (mock) ---
const state = {
    stats: {
        vjump: 42, broad: 190, force: 1200, air: 0.42,
        f10: 1.62, interval: 14.5, consistency: 82, maxsprint: 8.2,
        hangclean: 80, bench: 85, backsquat: 120, frontsquat: 100,
        height: 178, weight: 72, bmi: 22.7, balance: 'L: 98%, R: 96%'
    },
    activeForms: [
        {id:401,title:'Weekly Reflection',prompt:'How did you feel this week?',due:'2025-11-12'},
        {id:402,title:'Recovery Check',prompt:'Describe your recovery since last session.',due:'2025-11-10'}
    ],
    pastSubmissions: [
        {id:501,formId:401,date:'2025-11-01',rating:3,response:'Felt steady.',teacherFeedback:'Good work — focus on recovery.'}
    ],
    sports: [
        {id:1,name:'Soccer',season:'Fall 2024',notes:'Work in progress'},
        {id:2,name:'Track',season:'Spring 2025',notes:'Work in progress'}
    ],
    achievements: [
        {id:1,title:'Completed 5 sessions streak',date:'2025-11-01'}
    ],
    news: [
        {id:1,title:'Player of the Week: Jane Doe',desc:'Outstanding performance in regional meet.'}
    ]
};

// --- Modal helpers ---
export function openModal(id){ const el=document.getElementById(id); if(!el) return; el.classList.remove('hidden'); document.body.style.overflow='hidden'; }
export function closeModal(id){ const el=document.getElementById(id); if(!el) return; el.classList.add('hidden'); document.body.style.overflow=''; }

// --- Populate UI sections ---
export function populateStats(){
    const s = state.stats;
    $('#stat_vjump').textContent = s.vjump;
    $('#stat_broad').textContent = s.broad;
    $('#stat_force').textContent = s.force;
    $('#stat_air').textContent = s.air;
    $('#stat_f10').textContent = s.f10;
    $('#stat_interval').textContent = s.interval;
    $('#stat_consistency').textContent = s.consistency;
    $('#stat_maxsprint').textContent = s.maxsprint;
    $('#stat_hangclean').textContent = s.hangclean;
    $('#stat_bench').textContent = s.bench;
    $('#stat_backsquat').textContent = s.backsquat;
    $('#stat_frontsquat').textContent = s.frontsquat;
    $('#stat_height').textContent = s.height;
    $('#stat_weight').textContent = s.weight;
    $('#stat_bmi').textContent = s.bmi;
    $('#stat_balance').textContent = s.balance;
    $('#statsUpdated').textContent = new Date().toLocaleString();
}

export function populateForms(){
    const active = $('#activeFormsList'); active.innerHTML='';
    for(const f of state.activeForms){
        const div = document.createElement('div'); div.className='p-3 card';
        div.innerHTML = `
      <div class="small muted">Form • ${f.title}</div>
      <div class="font-medium mt-1">${f.prompt}</div>
      <div class="small muted mt-1">Due ${f.due}</div>
      <div class="mt-3"><button class="btn-primary" data-fill-id="${f.id}">Fill Form</button></div>`;
        active.appendChild(div);
    }
    const past = $('#pastFormsList'); past.innerHTML='';
    for(const p of state.pastSubmissions){
        const div = document.createElement('div'); div.className='p-3 card';
        div.innerHTML = `
      <div class="small muted">${p.date} • Form ${p.formId}</div>
      <div class="mt-1">Your rating: <b>${p.rating}</b> — You wrote: "${escapeHtml(p.response)}"</div>
      <div class="mt-2 small muted">Teacher feedback: "${escapeHtml(p.teacherFeedback||'—')}"</div>`;
        past.appendChild(div);
    }
    $('#studentPending').textContent = state.activeForms.length;
}

export function populateSports(){
    const list = $('#sportsList'); list.innerHTML='';
    for(const s of state.sports){
        const item = document.createElement('div'); item.className='p-3 card flex items-center justify-between';
        item.innerHTML = `
      <div>
        <div class="font-medium">${escapeHtml(s.name)} • ${escapeHtml(s.season)}</div>
        <div class="small muted">Coach notes: ${escapeHtml(s.notes)}</div>
      </div>
      <div>
        <button class="btn-outline" data-sport-id="${s.id}">View</button>
      </div>`;
        list.appendChild(item);
    }
    const ach = $('#studentAchievementsList'); ach.innerHTML='';
    for(const a of state.achievements){
        const el = document.createElement('div'); el.className='p-3 card'; el.innerHTML = `<div class="font-medium">${escapeHtml(a.title)}</div><div class="small muted mt-1">${escapeHtml(a.date)}</div>`; ach.appendChild(el);
    }
    const nf = $('#newsFeed'); nf.innerHTML = ''; for(const n of state.news){ const d=document.createElement('div'); d.className='p-3 card'; d.innerHTML=`<div class="font-medium">${escapeHtml(n.title)}</div><div class="small muted mt-1">${escapeHtml(n.desc)}</div>`; nf.appendChild(d);}
    $('#sportCredits').textContent = state.sports.length; // simple
}

// --- Event handlers ---
function onFillFormClick(ev){
    const id = ev.target.dataset.fillId; if(!id) return;
    const f = state.activeForms.find(x=>String(x.id)===String(id));
    if(f) $('#fillFormPrompt').textContent = f.prompt;
    openModal('fillFormModal');
}

async function submitFormResponse(){
    const rating = $('#formRating').value; const text = $('#formResponse').value.trim();
    // optimistic UI: push to pastSubmissions
    state.pastSubmissions.unshift({id:Date.now(), formId: state.activeForms[0]?.id || null, date: new Date().toLocaleDateString(), rating:parseInt(rating,10), response:text, teacherFeedback:''});
    // remove the corresponding active form (simulate submission)
    // NOTE: in real app, POST to /api/forms/submit
    try{
        // await fetch('/api/student/forms/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating,text})});
    }catch(e){ console.warn('server unavailable, using mock'); }
    populateForms(); closeModal('fillFormModal');
}

function onSportViewClick(ev){
    const id = ev.target.closest('[data-sport-id]')?.dataset['sportId'];
    if(!id) return;
    const s = state.sports.find(x=> String(x.id)===String(id));
    if(!s) return;
    $('#sportModalTitle').textContent = s.name + (s.season ? ' • ' + s.season : '');
    $('#sportModalNotes').textContent = s.notes || 'Work in progress';
    openModal('sportModal');
}

function submitAddSport(){
    const name = $('#sport_name').value.trim(); const season = $('#sport_season').value.trim();
    if(!name) { alert('Provide a sport name'); return; }
    const obj = {id:Date.now(), name, season, notes:'Work in progress'}; state.sports.unshift(obj);
    populateSports(); closeModal('addSportModal');
}

function submitStudentAchievement(){
    const title = $('#sa_title').value.trim(); const desc = $('#sa_desc').value.trim();
    if(!title) return alert('Add a title');
    state.achievements.unshift({id:Date.now(), title, date:new Date().toLocaleDateString(), desc});
    populateSports(); $('#sa_title').value=''; $('#sa_desc').value='';
}

function submitUploadAchievement(){ alert('Uploaded (mock).'); closeModal('uploadAchievementModal'); }

// --- Utility: CSV export ---
function exportStatsCSV(){
    const s = state.stats;
    const rows = [['metric','value'],['vertical_jump',s.vjump],['broad_jump',s.broad],['jump_force',s.force],['air_time',s.air],['flying_10',s.f10],['hang_clean',s.hangclean]];
    const csv = rows.map(r=> r.map(cell=> '"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='stats_export.csv'; a.click(); URL.revokeObjectURL(url);
}

// --- Mini chart loader for progress overview ---
function drawProgressChart(){
    const ctx = document.getElementById('progressChart'); if(!ctx) return;
    if(window.Chart) { renderChart(ctx); return; }
    const s = document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/chart.js'; s.onload = ()=> renderChart(ctx); document.body.appendChild(s);
    function renderChart(ctx){ new Chart(ctx,
        {
            type: 'line',
            data: {
                labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
                datasets: [{
                    label: 'Performance',
                    data: [48, 52, 56, 62, 68, 72],
                    tension: 0.4,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: 'rgba(6,46,30,0.08)',
                    borderColor: '#0B8B5A',
                    pointRadius: 0
                }]
            },
            options: {
                plugins: {legend: {display: false}},
                scales: {x: {grid: {display: false}}, y: {grid: {color: 'rgba(6,46,30,0.05)'}}}
            }}
        ); }
    }

// --- Search (basic client-side mock) ---
    function initSearch(){
        $('#studentSearchBtn').addEventListener('click', ()=> alert('Search (mock): '+$('#studentSearch').value));
    }

// --- Small utilities ---
    function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]); }

// --- Initialization and bindings ---
    export function initStudentDashboard(){
        // populate
        populateStats(); populateForms(); populateSports(); drawProgressChart();

        // bind tab buttons
        $$('.tab-btn').forEach(btn=> btn.addEventListener('click', (ev)=>{
            $$('.tab-btn').forEach(b=> b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.target;
            ['statsPage','formsPage','sportsPage'].forEach(id=> document.getElementById(id).classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
            window.scrollTo({top:0,behavior:'smooth'});
        }));

        // event delegation
        document.body.addEventListener('click', (ev)=>{
            if(ev.target.matches('[data-fill-id]')) return onFillFormClick(ev);
            if(ev.target.matches('[data-sport-id]') || ev.target.closest('[data-sport-id]')) return onSportViewClick(ev);
        });

        // form handlers
        $('#fillForm').addEventListener('submit', (e)=>{ e.preventDefault(); submitFormResponse(); });
        $('#addSportForm').addEventListener('submit', (e)=>{ e.preventDefault(); submitAddSport(); });
        $('#studentAchievementForm').addEventListener('submit', (e)=>{ e.preventDefault(); submitStudentAchievement(); });
        $('#uploadAchievementForm')?.addEventListener('submit', (e)=>{ e.preventDefault(); submitUploadAchievement(); });

        // other bindings
        $('#exportStats')?.addEventListener('click', exportStatsCSV);
        $('#openAddStatsBtn')?.addEventListener('click', ()=> openModal('addSportModal'));
        $('#openAddSportBtn')?.addEventListener('click', ()=> openModal('addSportModal'));
        $('#uploadAchievementBtn')?.addEventListener('click', ()=> openModal('uploadAchievementModal'));
        initSearch();
    }

// Run on load if included as a script tag (non-module) for convenience
    if(typeof window !== 'undefined' && !window.studentDashboardInitialized){
        window.studentDashboardInitialized = true;
        try{ initStudentDashboard(); }catch(e){ console.error('Failed to init student dashboard', e); }
    }

// Expose for debugging
    window.studentApp = { state, initStudentDashboard, openModal, closeModal };

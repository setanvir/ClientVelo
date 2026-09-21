// ClientVelo Dashboard App (Phase 6B - Slate UI)

const API_BASE = '/api';

// Utilities
async function fetchAPI(endpoint, options = {}) {
  const token = window.CV_TOKEN;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'X-CV-Token': token,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const data = await res.json(); if (data.error) msg = data.error; } catch(e) {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function renderSidebar() {
  const hash = window.location.hash.substring(1).split('/')[0] || 'overview';
  const navClass = (name) => `block px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-3 ${hash === name ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`;
  
  return `
    <div class="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-800 shadow-xl z-20 relative">
      <div class="p-6 pb-2">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-cvteal flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 class="text-xl font-bold tracking-tight text-white">ClientVelo</h1>
        </div>
        <p class="text-[10px] text-slate-500 font-semibold uppercase tracking-widest pl-8 mb-6">Command Center</p>
      </div>
      <nav class="flex-1 px-4 space-y-1.5 overflow-y-auto">
        <a href="#overview" class="${navClass('overview')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Overview
        </a>
        <div class="pt-4 pb-2 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Engine</div>
        <a href="#discover" class="${navClass('discover')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Discover
        </a>
        <a href="#console" class="${navClass('console')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Live Console
        </a>
        <div class="pt-4 pb-2 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Workspace</div>
        <a href="#leads" class="${navClass('leads')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          All Leads
        </a>
        <a href="#review" class="${navClass('review')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Review Workspace
        </a>
        <a href="#manual" class="${navClass('manual')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          Manual Outreach
        </a>
        <a href="#logs" class="${navClass('logs')}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Dispatch Logs
        </a>
      </nav>
      <div class="p-4 border-t border-slate-800/50 text-[10px] text-slate-500 font-medium">
        ClientVelo Engine v1.0.0
      </div>
    </div>
  `;
}

function renderTopbar(title, subtitle = null) {
  return `
    <header class="bg-white/80 backdrop-blur-md border-b border-slate-200/60 h-16 flex items-center px-8 shrink-0 z-10 sticky top-0">
      <div>
        <h2 class="text-lg font-bold text-slate-800 tracking-tight">${escapeHTML(title)}</h2>
        ${subtitle ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHTML(subtitle)}</div>` : ''}
      </div>
    </header>
  `;
}

// ─── Views ──────────────────────────────────────────────────────────────────

async function renderOverview() {
  const [data, jobsData] = await Promise.all([
    fetchAPI('/overview'),
    fetchAPI('/jobs')
  ]);
  const { stats } = data;
  const jobs = jobsData.jobs.slice(0, 5); // top 5 recent jobs

  const actionCards = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white p-6 rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <h3 class="font-bold text-slate-800">Discover Leads</h3>
          <p class="text-sm text-slate-500 mt-1">Run the engine pipeline to find new local businesses.</p>
        </div>
        <button onclick="window.location.hash='#discover'" class="mt-4 w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition">Start Discovery</button>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
        ${stats.needsReview > 0 ? `<div class="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${stats.needsReview}</div>` : ''}
        <div>
          <div class="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center mb-4 text-yellow-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h3 class="font-bold text-slate-800">Review Drafts</h3>
          <p class="text-sm text-slate-500 mt-1">Approve generated email drafts and screenshots.</p>
        </div>
        <button onclick="window.location.hash='#review'" class="mt-4 w-full py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-bold hover:bg-yellow-200 transition">Go to Workspace</button>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
        <div>
          <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-4 text-green-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <h3 class="font-bold text-slate-800">Manual Outreach</h3>
          <p class="text-sm text-slate-500 mt-1">Follow up on leads with no website or via phone.</p>
        </div>
        <button onclick="window.location.hash='#manual'" class="mt-4 w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">View Manual Queue</button>
      </div>

      <div class="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col justify-between">
        <div>
          <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-4 text-white">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3 class="font-bold text-white">Live Console</h3>
          <p class="text-sm text-slate-300 mt-1">View active background jobs and engine logs.</p>
        </div>
        <button onclick="window.location.hash='#console'" class="mt-4 w-full py-2 bg-white/20 text-white backdrop-blur-sm rounded-lg text-sm font-medium hover:bg-white/30 transition border border-white/10">Open Console</button>
      </div>
    </div>
  `;

  const jobRows = jobs.length ? jobs.map(j => {
    let statusDot = 'bg-slate-300';
    if (j.status === 'running') statusDot = 'bg-green-500 animate-pulse';
    else if (j.status === 'error' || j.status === 'interrupted') statusDot = 'bg-red-500';
    else if (j.status === 'completed') statusDot = 'bg-cvteal';
    
    return `
      <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-2 -mx-2 cursor-pointer transition-colors" onclick="window.location.hash='#console/${j.id}'">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full ${statusDot}"></div>
          <div>
            <div class="text-sm font-bold text-slate-700 font-mono">cli ${j.command}</div>
            <div class="text-xs text-slate-400 mt-0.5">${new Date(j.startedAt).toLocaleString()}</div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide bg-slate-100 text-slate-500">${j.status}</span>
          <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    `;
  }).join('') : '<div class="text-sm text-slate-500 py-4">No recent jobs found.</div>';

  return `
    ${renderTopbar('Action Center', 'Manage your outreach pipeline')}
    <div class="p-8 overflow-y-auto flex-1 bg-slate-50/50">
      <div class="max-w-6xl mx-auto">
        ${actionCards}
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Pipeline Metrics</h3>
              <button onclick="openLiveSendModal()" class="px-5 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg shadow-md shadow-red-500/20 text-sm font-bold flex items-center gap-2 transition-all transform hover:scale-[1.02]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                LIVE SEND APPROVED
              </button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Total Leads</div>
                <div class="text-3xl font-black text-slate-800">${stats.totalLeads}</div>
              </div>
              <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs Review</div>
                <div class="text-3xl font-black text-yellow-500">${stats.needsReview}</div>
              </div>
              <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Drafted</div>
                <div class="text-3xl font-black text-blue-500">${stats.drafted}</div>
              </div>
              <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sent</div>
                <div class="text-3xl font-black text-cvteal">${stats.sent}</div>
              </div>
            </div>
          </div>
          
          <div class="lg:col-span-1">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Jobs</h3>
              <a href="#console" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View All</a>
            </div>
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              ${jobRows}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Discover View ──────────────────────────────────────────────────────────

async function renderDiscover() {
  return `
    ${renderTopbar('Discover Leads', 'Run the pipeline to find new prospects')}
    <div class="p-8 overflow-y-auto flex-1 bg-slate-50/50 flex justify-center">
      <div class="w-full max-w-xl bg-white rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-200 p-8 self-start">
        <h3 class="text-lg font-bold text-slate-800 mb-6">Discovery Configuration</h3>
        
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Niche</label>
            <select id="disc-niche" class="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700">
              <option value="dentist">Dentist</option>
              <option value="plumber">Plumber</option>
              <option value="electrician">Electrician</option>
              <option value="roofing">Roofing</option>
              <option value="hvac">HVAC</option>
              <option value="landscaping">Landscaping</option>
              <option value="restaurant">Restaurant</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">City</label>
            <input type="text" id="disc-city" placeholder="e.g., Austin, TX" class="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700">
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Limit</label>
            <input type="number" id="disc-limit" value="10" min="1" max="100" class="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700">
            <p class="text-xs text-slate-500 mt-1">Number of places to fetch from Google Maps.</p>
          </div>
        </div>

        <div id="disc-error" class="mt-4 text-sm font-semibold text-red-500 hidden bg-red-50 p-3 rounded-lg border border-red-100"></div>

        <div class="mt-8 flex gap-3 pt-6 border-t border-slate-100">
          <button onclick="startJob('discover')" class="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">
            Discover Only
          </button>
          <button onclick="startJob('pipeline')" class="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition shadow-sm shadow-slate-900/20">
            Run Full Pipeline
          </button>
        </div>
      </div>
    </div>
  `;
}

window.startJob = async function(command) {
  const niche = document.getElementById('disc-niche').value;
  const city = document.getElementById('disc-city').value.trim();
  const limit = document.getElementById('disc-limit').value;
  const errEl = document.getElementById('disc-error');
  
  if (!city) {
    errEl.textContent = 'City is required';
    errEl.classList.remove('hidden');
    return;
  }
  
  errEl.classList.add('hidden');
  const args = ['--niche', niche, '--city', city, '--limit', limit];
  
  try {
    const res = await fetchAPI('/jobs', {
      method: 'POST',
      body: JSON.stringify({ command, args })
    });
    window.location.hash = `#console/${res.job.id}`;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
};

// ─── Live Console ───────────────────────────────────────────────────────────

let consolePollInterval = null;
let currentConsoleJobId = null;

async function renderConsole(jobId) {
  currentConsoleJobId = jobId;
  return `
    ${renderTopbar('Live Console', 'Engine execution logs and history')}
    <div class="flex-1 flex overflow-hidden bg-slate-50/50">
      <div class="w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col" id="console-history">
        <!-- Job history will be loaded here -->
        <div class="p-6 text-center text-sm text-slate-500">Loading history...</div>
      </div>
      
      <div class="flex-1 flex flex-col p-6 overflow-hidden relative">
        <div class="bg-slate-900 rounded-xl flex-1 shadow-2xl flex flex-col border border-slate-800 overflow-hidden">
          <div class="h-12 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0">
            <div class="flex items-center gap-3" id="console-header">
              <div class="w-3 h-3 rounded-full bg-slate-600"></div>
              <span class="text-sm font-mono font-medium text-slate-300">Select a job</span>
            </div>
            <button id="console-stop-btn" onclick="stopCurrentJob()" class="hidden text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded transition">Stop Job</button>
          </div>
          <div id="console-output" class="flex-1 p-4 overflow-y-auto font-mono text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed selection:bg-indigo-500/30"></div>
        </div>
      </div>
    </div>
  `;
}

async function updateConsoleHistory() {
  const historyEl = document.getElementById('console-history');
  if (!historyEl) return;
  
  try {
    const data = await fetchAPI('/jobs');
    const jobs = data.jobs;
    
    if (jobs.length === 0) {
      historyEl.innerHTML = '<div class="p-6 text-center text-sm text-slate-500">No jobs found.</div>';
      return;
    }
    
    historyEl.innerHTML = `
      <div class="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Job History</h3>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        ${jobs.map(j => {
          const isActive = j.id === currentConsoleJobId;
          let dot = 'bg-slate-300';
          if (j.status === 'running') dot = 'bg-green-500 animate-pulse';
          else if (j.status === 'error' || j.status === 'interrupted') dot = 'bg-red-500';
          else if (j.status === 'completed') dot = 'bg-cvteal';
          
          return `
            <div onclick="window.location.hash='#console/${j.id}'" class="p-3 rounded-lg cursor-pointer transition-colors border ${isActive ? 'bg-indigo-50/50 border-indigo-100' : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'}">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${dot}"></div>
                  <span class="text-xs font-bold font-mono ${isActive ? 'text-indigo-700' : 'text-slate-700'}">cli ${j.command}</span>
                </div>
              </div>
              <div class="text-[10px] text-slate-400 pl-4 uppercase tracking-wide font-medium">${j.status} • ${new Date(j.startedAt).toLocaleTimeString()}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
  } catch(e) {}
}

async function pollConsoleOutput() {
  updateConsoleHistory();
  if (!currentConsoleJobId) return;
  
  const headerEl = document.getElementById('console-header');
  const outputEl = document.getElementById('console-output');
  const stopBtn = document.getElementById('console-stop-btn');
  if (!headerEl || !outputEl) return;
  
  try {
    const linesRendered = parseInt(outputEl.dataset.lines || '0', 10);
    const out = await fetchAPI(`/jobs/${currentConsoleJobId}/output?after=${linesRendered}`);
    
    const { job, lines } = out;
    
    // Update Header
    let dot = 'bg-slate-500';
    if (job.status === 'running') {
      dot = 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]';
      stopBtn.classList.remove('hidden');
    } else {
      stopBtn.classList.add('hidden');
      if (job.status === 'error' || job.status === 'interrupted') dot = 'bg-red-500';
      else if (job.status === 'completed') dot = 'bg-cvteal';
    }
    
    headerEl.innerHTML = `
      <div class="w-3 h-3 rounded-full ${dot}"></div>
      <span class="text-sm font-mono font-bold text-slate-200">cli ${job.command} <span class="text-slate-500 font-normal">${job.args.join(' ')}</span></span>
    `;
    
    if (lines.length > 0) {
      // Format lines
      const formatted = lines.map(l => {
        let str = escapeHTML(l);
        // Highlight INFO/WARN/ERROR for better visibility
        str = str.replace(/INFO/g, '<span class="text-blue-400 font-bold">INFO</span>');
        str = str.replace(/WARN/g, '<span class="text-yellow-400 font-bold">WARN</span>');
        str = str.replace(/ERROR/g, '<span class="text-red-400 font-bold">ERROR</span>');
        return str;
      }).join('\n') + (lines.length > 0 ? '\n' : '');
      
      outputEl.innerHTML += formatted;
      outputEl.dataset.lines = linesRendered + lines.length;
      outputEl.scrollTop = outputEl.scrollHeight; // auto-scroll
    }
    
    // Stop polling if done
    if (job.status !== 'running' && job.status !== 'queued') {
      // Keep polling to false if we implement a tighter loop, but 3s interval is fine to keep running for history updates
    }
    
  } catch(e) {
    if (linesRendered === 0) outputEl.innerHTML = `<span class="text-red-400">Failed to load output: ${e.message}</span>`;
  }
}

window.stopCurrentJob = async function() {
  if (!currentConsoleJobId) return;
  const btn = document.getElementById('console-stop-btn');
  if (btn) {
    btn.textContent = 'Stopping...';
    btn.disabled = true;
  }
  try {
    await fetchAPI(`/jobs/${currentConsoleJobId}/stop`, { method: 'POST' });
  } catch (err) {
    alert(err.message);
  }
};


// ─── Refined Sub-Views (Leads, Review, Manual, Logs) ───────────────────────

const leadsState = {
  page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc',
  search: '', status: '', contactChannel: '', emailClass: '', primaryIssue: '',
  selectedIds: new Set(), expandedId: null, total: 0, totalPages: 1, leadsData: []
};

let searchTimeout = null;
window.handleLeadsSearch = function(val) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    leadsState.search = val;
    leadsState.page = 1;
    loadLeadsData();
  }, 300);
};

window.setLeadsFilter = function(key, val) {
  leadsState[key] = val;
  leadsState.page = 1;
  loadLeadsData();
};

window.setLeadsView = function(view) {
  leadsState.status = '';
  leadsState.contactChannel = '';
  leadsState.emailClass = '';
  leadsState.primaryIssue = '';
  if (view === 'needs_review') leadsState.status = 'needs_review';
  else if (view === 'ready') leadsState.status = 'approved';
  else if (view === 'sendable') leadsState.status = 'drafted';
  else if (view === 'manual') leadsState.status = 'manual_outreach';
  leadsState.page = 1;
  loadLeadsData();
};

window.toggleLeadSort = function(field) {
  if (leadsState.sortField === field) {
    leadsState.sortOrder = leadsState.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    leadsState.sortField = field;
    leadsState.sortOrder = 'asc';
  }
  loadLeadsData();
};

window.toggleLeadSelect = function(id) {
  if (leadsState.selectedIds.has(id)) leadsState.selectedIds.delete(id);
  else leadsState.selectedIds.add(id);
  updateLeadsBulkActions();
  const cb = document.getElementById(`lead-cb-${id}`);
  if (cb) cb.checked = leadsState.selectedIds.has(id);
};

window.toggleLeadSelectAll = function(checked) {
  if (checked) {
    leadsState.leadsData.forEach(l => leadsState.selectedIds.add(l.id));
  } else {
    leadsState.selectedIds.clear();
  }
  updateLeadsBulkActions();
  loadLeadsData(true);
};

window.toggleLeadExpand = function(id) {
  leadsState.expandedId = leadsState.expandedId === id ? null : id;
  loadLeadsData(true);
};

window.changeLeadsPage = function(delta) {
  leadsState.page += delta;
  if (leadsState.page < 1) leadsState.page = 1;
  if (leadsState.page > leadsState.totalPages) leadsState.page = leadsState.totalPages;
  loadLeadsData();
};

function updateLeadsBulkActions() {
  const bar = document.getElementById('leads-bulk-bar');
  const count = document.getElementById('leads-bulk-count');
  if (!bar || !count) return;
  if (leadsState.selectedIds.size > 0) {
    bar.classList.remove('translate-y-full', 'opacity-0');
    count.textContent = `${leadsState.selectedIds.size}`;
  } else {
    bar.classList.add('translate-y-full', 'opacity-0');
  }
}

window.leadsBulkAction = async function(action) {
  if (leadsState.selectedIds.size === 0) return;
  const ids = Array.from(leadsState.selectedIds);
  
  if (action === 'export') {
    try {
      const res = await fetch('/api/leads/export', {
        method: 'POST',
        headers: {
          'X-CV-Token': window.CV_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    }
    return;
  }
  
  if (action === 'suppress') {
    if (!confirm(`Are you sure you want to mass opt-out ${ids.length} leads? This cannot be undone.`)) return;
  }
  
  try {
    const res = await fetchAPI('/leads/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, ids, reason: action === 'suppress' ? 'opt_out' : undefined })
    });
    leadsState.selectedIds.clear();
    updateLeadsBulkActions();
    loadLeadsData();
  } catch (err) {
    alert(err.message);
  }
};

window.leadSingleAction = async function(id, action) {
  try {
    if (['opt_out', 'bounce', 'invalid'].includes(action)) {
      const lead = leadsState.leadsData.find(l => l.id === id);
      if (!lead || !lead.email) throw new Error('No email to suppress');
      await fetchAPI(`/suppression/${action}`, { method: 'POST', body: JSON.stringify({ email: lead.email }) });
    }
    if (action === 'skip') {
      await fetchAPI('/leads/bulk', { method: 'POST', body: JSON.stringify({ action: 'skip', ids: [id] }) });
    }
    loadLeadsData();
  } catch (err) {
    alert(err.message);
  }
};

async function loadLeadsData(skipFetch = false) {
  const tbody = document.getElementById('leads-tbody');
  const pag = document.getElementById('leads-pagination');
  if (!tbody || !pag) return;
  
  if (!skipFetch) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading...</td></tr>`;
    try {
      const q = new URLSearchParams({
        page: leadsState.page, limit: leadsState.limit, sortField: leadsState.sortField, sortOrder: leadsState.sortOrder
      });
      if (leadsState.search) q.set('q', leadsState.search);
      if (leadsState.status) q.set('status', leadsState.status);
      if (leadsState.contactChannel) q.set('contactChannel', leadsState.contactChannel);
      if (leadsState.emailClass) q.set('emailClass', leadsState.emailClass);
      if (leadsState.primaryIssue) q.set('primaryIssue', leadsState.primaryIssue);

      const data = await fetchAPI(`/leads?${q.toString()}`);
      leadsState.leadsData = data.leads;
      leadsState.total = data.total;
      leadsState.totalPages = data.totalPages;
      leadsState.page = data.page;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500">Error: ${escapeHTML(e.message)}</td></tr>`;
      return;
    }
  }

  const allSelected = leadsState.leadsData.length > 0 && leadsState.leadsData.every(l => leadsState.selectedIds.has(l.id));
  const cbAll = document.getElementById('lead-cb-all');
  if (cbAll) cbAll.checked = allSelected;

  if (leadsState.leadsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-500">No leads match the current filters.</td></tr>`;
  } else {
    tbody.innerHTML = leadsState.leadsData.map(l => {
      const isSelected = leadsState.selectedIds.has(l.id);
      const isExpanded = leadsState.expandedId === l.id;
      
      let drawer = '';
      if (isExpanded) {
        let imgTag = '<div class="h-48 flex items-center justify-center text-slate-400 bg-slate-100 rounded-lg text-sm font-medium">No screenshot</div>';
        if (l.screenshotPath) {
          const fn = l.screenshotPath.split(/[/\\]/).pop();
          imgTag = `<img src="/api/screenshots/${fn}" class="w-full h-auto max-h-96 object-contain bg-slate-100 rounded-lg border border-slate-200">`;
        }
        
        drawer = `
          <tr class="bg-indigo-50/40 border-b border-slate-200 shadow-inner relative z-0">
            <td colspan="6" class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 space-y-6">
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Evidence & Audit</h4>
                    <p class="text-sm text-slate-700 leading-relaxed mb-4">${escapeHTML(l.evidenceText || 'No evidence recorded.')}</p>
                    ${l.audit ? `
                      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">Load Time</div>
                          <div class="text-sm font-mono text-slate-800">${l.audit.loadTimeMs || 'N/A'}ms</div>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">PSI Mobile</div>
                          <div class="text-sm font-mono text-slate-800">${l.audit.psiMobileScore || 'N/A'}</div>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">Booking CTA</div>
                          <div class="text-sm font-bold ${l.audit.bookingCtaAboveFold ? 'text-green-600' : 'text-slate-600'}">${l.audit.bookingCtaAboveFold ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">Mobile Friendly</div>
                          <div class="text-sm font-bold ${l.audit.viewportMeta && !l.audit.horizontalOverflow ? 'text-green-600' : 'text-red-500'}">${l.audit.viewportMeta && !l.audit.horizontalOverflow ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Contact Info & Emails</h4>
                    <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                      <table class="w-full text-left text-sm">
                        <tbody class="divide-y divide-slate-100">
                          ${(l.emailCandidates || []).map(ec => `
                            <tr>
                              <td class="p-3 font-medium ${ec.email === l.email ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700'}">${escapeHTML(ec.email)}</td>
                              <td class="p-3 text-slate-500 text-xs">${escapeHTML(ec.emailType)}</td>
                              <td class="p-3 text-slate-500 text-xs">${escapeHTML(ec.source)}</td>
                            </tr>
                          `).join('')}
                          ${!(l.emailCandidates && l.emailCandidates.length) ? '<tr><td colspan="3" class="p-3 text-slate-500 text-center">No emails found</td></tr>' : ''}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col gap-4">
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Screenshot</h4>
                    ${imgTag}
                  </div>
                  <div class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Actions</h4>
                    <div class="grid grid-cols-2 gap-2">
                      <button onclick="leadSingleAction('${l.id}', 'skip')" class="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded">Skip Lead</button>
                      <button onclick="leadSingleAction('${l.id}', 'opt_out')" class="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded border border-red-100">Opt-out</button>
                      <button onclick="leadSingleAction('${l.id}', 'bounce')" class="py-1.5 px-3 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold rounded border border-orange-100">Mark Bounce</button>
                      <button onclick="leadSingleAction('${l.id}', 'invalid')" class="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded border border-slate-200">Mark Invalid</button>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''} relative z-10">
          <td class="py-3 px-4 w-12 text-center">
            <input type="checkbox" id="lead-cb-${l.id}" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" ${isSelected ? 'checked' : ''} onchange="toggleLeadSelect('${l.id}')">
          </td>
          <td class="py-3 px-4 cursor-pointer" onclick="toggleLeadExpand('${l.id}')">
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              <div class="truncate max-w-[200px] lg:max-w-xs">
                <div class="font-bold text-slate-800 truncate" title="${escapeHTML(l.businessName)}">${escapeHTML(l.businessName)}</div>
                <a href="${escapeHTML(l.websiteUrl)}" target="_blank" onclick="event.stopPropagation()" class="text-xs text-indigo-600 hover:underline truncate block" title="${escapeHTML(l.websiteUrl)}">${escapeHTML(l.websiteUrl || 'No Website')}</a>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-sm text-slate-600">
            ${l.email ? `<div class="font-medium truncate max-w-[150px] lg:max-w-[200px]" title="${escapeHTML(l.email)}">${escapeHTML(l.email)}</div>` : ''}
            ${l.phone ? `<div class="text-xs text-slate-500">${escapeHTML(l.phone)}</div>` : '<div class="text-xs text-slate-400 italic">No Phone</div>'}
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-200">
              ${escapeHTML(l.workflowStatus)}
            </span>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-slate-700 text-sm">
            ${l.qualificationScore !== null ? l.qualificationScore : '-'}
          </td>
          <td class="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title="${escapeHTML(l.primaryIssue || '')}">
            ${escapeHTML(l.primaryIssue || 'None')}
          </td>
        </tr>
        ${drawer}
      `;
    }).join('');
  }

  pag.innerHTML = `
    <span class="text-sm text-slate-500">Showing page <span class="font-bold text-slate-700">${leadsState.page}</span> of <span class="font-bold text-slate-700">${leadsState.totalPages}</span> (${leadsState.total} leads)</span>
    <div class="flex gap-2">
      <button onclick="changeLeadsPage(-1)" class="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50" ${leadsState.page <= 1 ? 'disabled' : ''}>Previous</button>
      <button onclick="changeLeadsPage(1)" class="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50" ${leadsState.page >= leadsState.totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

async function renderLeads() {
  leadsState.selectedIds.clear();
  leadsState.expandedId = null;
  setTimeout(() => loadLeadsData(), 0);

  const thClass = "py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors select-none";

  return `
    ${renderTopbar('All Leads', 'Advanced Data Table')}
    
    <!-- Bulk Actions Bar -->
    <div id="leads-bulk-bar" class="fixed bottom-0 left-64 right-0 h-16 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transform translate-y-full opacity-0 transition-all duration-300 z-50 flex items-center justify-between px-8">
      <div class="flex items-center gap-4">
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm" id="leads-bulk-count">0</div>
        <span class="font-bold text-slate-700 text-sm">Leads Selected</span>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="leadsBulkAction('export')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">Export to CSV</button>
        <button onclick="leadsBulkAction('skip')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">Bulk Skip</button>
        <button onclick="leadsBulkAction('suppress')" class="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition shadow-sm">Bulk Suppress (Opt-out)</button>
      </div>
    </div>

    <div class="p-8 overflow-y-auto flex-1 bg-slate-50/50 flex flex-col relative z-0">
      <!-- Filters and Search -->
      <div class="mb-6 space-y-4">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="relative flex-1 min-w-[250px]">
            <input type="text" placeholder="Search by name, email, phone, domain..." onkeyup="handleLeadsSearch(this.value)" class="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700 shadow-sm">
            <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          
          <div class="flex gap-2">
            <button onclick="setLeadsView('needs_review')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${leadsState.status === 'needs_review' ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} shadow-sm transition-colors">Needs Review</button>
            <button onclick="setLeadsView('ready')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${leadsState.status === 'approved' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} shadow-sm transition-colors">Ready to Draft</button>
            <button onclick="setLeadsView('sendable')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${leadsState.status === 'drafted' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} shadow-sm transition-colors">Sendable</button>
            <button onclick="setLeadsView('manual')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${leadsState.status === 'manual_outreach' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} shadow-sm transition-colors">Manual Queue</button>
            <button onclick="setLeadsView('')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${!leadsState.status ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} shadow-sm transition-colors">All Leads</button>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <select onchange="setLeadsFilter('contactChannel', this.value)" class="text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-600 shadow-sm focus:border-indigo-500">
            <option value="">Any Contact Channel</option>
            <option value="direct_email">Direct Email</option>
            <option value="generic_email">Generic Email</option>
            <option value="contact_form">Contact Form</option>
            <option value="phone_only">Phone Only</option>
          </select>
          <select onchange="setLeadsFilter('primaryIssue', this.value)" class="text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-600 shadow-sm focus:border-indigo-500">
            <option value="">Any Primary Issue</option>
            <option value="slow_or_heavy_mobile_page">Slow Mobile Page</option>
            <option value="no_visible_booking_cta">No Booking CTA</option>
            <option value="contact_path_has_friction">Contact Friction</option>
            <option value="no_website">No Website</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm shadow-slate-200/50 border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-left border-collapse min-w-[800px]">
            <thead class="sticky top-0 bg-slate-50 z-20 shadow-sm">
              <tr class="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th class="py-3 px-4 w-12 text-center">
                  <input type="checkbox" id="lead-cb-all" onchange="toggleLeadSelectAll(this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer">
                </th>
                <th class="${thClass}" onclick="toggleLeadSort('businessName')">Business Name</th>
                <th class="${thClass}" onclick="toggleLeadSort('email')">Contact</th>
                <th class="${thClass}" onclick="toggleLeadSort('workflowStatus')">Status</th>
                <th class="${thClass}" onclick="toggleLeadSort('qualificationScore')">Score</th>
                <th class="${thClass}" onclick="toggleLeadSort('primaryIssue')">Primary Issue</th>
              </tr>
            </thead>
            <tbody id="leads-tbody" class="divide-y divide-slate-100 relative z-10">
              <!-- Rendered by loadLeadsData -->
            </tbody>
          </table>
        </div>
        <div id="leads-pagination" class="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 relative z-20">
          <!-- Rendered by loadLeadsData -->
        </div>
      </div>
    </div>
  `;
}

// ... existing review workspace logic adjusted slightly for slate ...
let currentDrafts = [];
let currentDraftIndex = 0;

async function renderReview() {
  const data = await fetchAPI('/drafts');
  currentDrafts = data.drafts || [];
  currentDraftIndex = 0;
  
  if (currentDrafts.length === 0) {
    return `
      ${renderTopbar('Review Workspace')}
      <div class="flex-1 flex items-center justify-center text-slate-500 bg-slate-50/50">No drafts to review.</div>
    `;
  }
  
  return `
    ${renderTopbar('Review Workspace', 'Use J/K to navigate, A to approve, S to skip, E to edit, X to suppress')}
    <div class="flex-1 flex overflow-hidden bg-slate-50/50">
      <div class="w-72 bg-white border-r border-slate-200 overflow-y-auto shadow-sm" id="review-queue"></div>
      <div class="flex-1 flex flex-col p-6 overflow-y-auto relative">
        <div id="review-center" class="flex-1 flex flex-col"></div>
      </div>
      <div class="w-96 bg-white border-l border-slate-200 p-6 overflow-y-auto flex flex-col items-center shadow-sm">
        <div id="review-right" class="w-full"></div>
      </div>
    </div>
  `;
}

function updateReviewUI() {
  const qContainer = document.getElementById('review-queue');
  const centerContainer = document.getElementById('review-center');
  const rightContainer = document.getElementById('review-right');
  
  if (!qContainer || !centerContainer || !rightContainer) return;
  if (currentDrafts.length === 0) {
    centerContainer.innerHTML = '<div class="text-slate-500 text-center p-8">No drafts remaining.</div>';
    qContainer.innerHTML = '';
    rightContainer.innerHTML = '';
    return;
  }
  
  qContainer.innerHTML = currentDrafts.map((d, i) => `
    <div class="p-4 border-b border-slate-100 cursor-pointer transition-colors ${i === currentDraftIndex ? 'bg-indigo-50/50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}" onclick="selectDraft(${i})">
      <div class="font-bold text-sm truncate ${d.approved ? 'text-green-600' : 'text-slate-700'}">${escapeHTML(d.businessName)}</div>
      <div class="text-xs text-slate-500 truncate mt-0.5">${escapeHTML(d.recipientEmail)}</div>
    </div>
  `).join('');
  
  const draft = currentDrafts[currentDraftIndex];
  
  const statusBadge = draft.approved 
    ? `<span class="bg-green-100 text-green-700 px-3 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider border border-green-200">Approved</span>`
    : `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider border border-yellow-200">Pending Review</span>`;

  centerContainer.innerHTML = `
    <div class="flex items-center justify-between mb-4 shrink-0">
      ${statusBadge}
      <div class="space-x-2">
        <button onclick="handleAction('suppress')" class="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition shadow-sm">Suppress (x)</button>
        ${draft.approved 
          ? `<button onclick="handleAction('revoke')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">Revoke (r)</button>`
          : `<button onclick="handleAction('approve')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20">Approve (a)</button>`
        }
      </div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm shadow-slate-200/50 border border-slate-200 p-6 flex-1 flex flex-col">
      <div class="mb-5 bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To</div>
        <div class="text-sm font-bold text-slate-700">${escapeHTML(draft.recipientName)} &lt;<span class="text-indigo-600 font-medium">${escapeHTML(draft.recipientEmail)}</span>&gt;</div>
      </div>
      <div class="mb-4">
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
        <input type="text" id="draft-subject" class="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all" value="${escapeHTML(draft.subject)}" ${draft.approved ? 'disabled' : ''}>
      </div>
      <div class="flex-1 flex flex-col">
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label>
        <textarea id="draft-body" class="w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm resize-none whitespace-pre-wrap text-slate-700 transition-all leading-relaxed" ${draft.approved ? 'disabled' : ''}>${escapeHTML(draft.body)}</textarea>
      </div>
      
      ${!draft.approved ? `
        <div class="mt-4 flex justify-end">
          <button onclick="saveDraftEdits()" class="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition">Save Edits</button>
        </div>
      ` : ''}
      <div id="draft-error" class="mt-4 text-sm font-semibold text-red-500 hidden bg-red-50 p-3 rounded-lg border border-red-100"></div>
    </div>
  `;
  
  let imgTag = '<div class="h-64 flex items-center justify-center text-slate-300 text-sm font-medium">No screenshot</div>';
  if (draft.screenshotPath) {
    const fn = draft.screenshotPath.split(/[/\\]/).pop();
    imgTag = `<img src="/api/screenshots/${fn}" class="w-full object-cover">`;
  }
  
  rightContainer.innerHTML = `
    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 w-full text-left">Evidence</h3>
    <p class="text-sm text-slate-600 mb-6 w-full text-left leading-relaxed">${escapeHTML(draft.evidenceText || 'No specific evidence recorded.')}</p>
    
    <div class="w-[300px] h-[650px] border-[8px] border-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative bg-white flex flex-col shrink-0 ring-1 ring-black/5">
      <div class="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-2xl mx-auto w-32 z-10 flex items-end justify-center pb-1"><div class="w-8 h-1 bg-slate-800 rounded-full"></div></div>
      <div class="flex-1 overflow-y-auto">
        ${imgTag}
      </div>
    </div>
    
    ${draft.audit ? `
      <div class="mt-6 w-full text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div class="font-bold uppercase tracking-wider mb-3 text-slate-700">Audit Data</div>
        <div class="flex justify-between py-1 border-b border-slate-200/50"><span>Load Time</span> <span class="font-mono text-slate-700">${draft.audit.loadTimeMs}ms</span></div>
        <div class="flex justify-between py-1 border-b border-slate-200/50"><span>Resources</span> <span class="font-mono text-slate-700">${draft.audit.resourcesCount}</span></div>
        <div class="flex justify-between py-1 border-b border-slate-200/50"><span>Mobile Friendly</span> <span class="font-mono ${draft.audit.mobileFriendly ? 'text-green-600' : 'text-red-500'} font-bold">${draft.audit.mobileFriendly ? 'Yes' : 'No'}</span></div>
        <div class="flex justify-between py-1 border-b border-slate-200/50"><span>Booking CTA</span> <span class="font-mono ${draft.audit.hasBookingCta ? 'text-green-600' : 'text-slate-700'} font-bold">${draft.audit.hasBookingCta ? 'Yes' : 'No'}</span></div>
        <div class="flex justify-between py-1"><span>Phone Link</span> <span class="font-mono ${draft.audit.hasPhoneLink ? 'text-green-600' : 'text-slate-700'} font-bold">${draft.audit.hasPhoneLink ? 'Yes' : 'No'}</span></div>
      </div>
    ` : ''}
  `;
}

window.selectDraft = function(idx) {
  if (idx >= 0 && idx < currentDrafts.length) {
    currentDraftIndex = idx;
    updateReviewUI();
  }
};
window.saveDraftEdits = async function() {
  const draft = currentDrafts[currentDraftIndex];
  if (!draft || draft.approved) return;
  const sub = document.getElementById('draft-subject').value.trim();
  const body = document.getElementById('draft-body').value.trim();
  const errEl = document.getElementById('draft-error');
  try {
    const fullText = (sub + ' ' + body).toLowerCase();
    const banned = ['losing customers', 'you are losing', 'guaranteed', 'revenue', 'redesign', 'verified'];
    for (const b of banned) if (fullText.includes(b)) throw new Error(`Banned phrase: "${b}"`);
    if (fullText.includes('undefined') || fullText.includes('null')) throw new Error('Missing token (null/undefined)');
    if (sub.toLowerCase().startsWith('re:') || sub.toLowerCase().startsWith('fwd:')) throw new Error('Banned subject prefix');
    errEl.classList.add('hidden');
    await fetchAPI(`/drafts/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ subject: sub, body }) });
    draft.subject = sub; draft.body = body; updateReviewUI();
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  }
};
window.handleAction = async function(action) {
  const draft = currentDrafts[currentDraftIndex];
  if (!draft) return;
  const errEl = document.getElementById('draft-error');
  if (errEl) errEl.classList.add('hidden');
  try {
    if (action === 'approve') {
      await fetchAPI(`/drafts/${draft.id}/approve`, { method: 'POST' });
      draft.approved = true;
      selectDraft(currentDraftIndex < currentDrafts.length - 1 ? currentDraftIndex + 1 : currentDraftIndex);
    } else if (action === 'revoke') {
      await fetchAPI(`/drafts/${draft.id}/revoke`, { method: 'POST' });
      draft.approved = false; updateReviewUI();
    } else if (action === 'suppress') {
      await fetchAPI(`/suppression/opt_out`, { method: 'POST', body: JSON.stringify({ email: draft.recipientEmail }) });
      currentDrafts.splice(currentDraftIndex, 1);
      if (currentDraftIndex >= currentDrafts.length) currentDraftIndex = Math.max(0, currentDrafts.length - 1);
      updateReviewUI();
    }
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); } else alert(`Error: ${err.message}`);
  }
};
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (window.location.hash.includes('review') && currentDrafts.length > 0) {
    if (e.key === 'j') selectDraft(currentDraftIndex + 1);
    else if (e.key === 'k') selectDraft(currentDraftIndex - 1);
    else if (e.key === 'a') handleAction('approve');
    else if (e.key === 'r') handleAction('revoke');
    else if (e.key === 'x') handleAction('suppress');
    else if (e.key === 's') selectDraft(currentDraftIndex + 1);
    else if (e.key === 'e') {
      const b = document.getElementById('draft-body');
      if (b && !b.disabled) { b.focus(); e.preventDefault(); }
    }
  }
});

async function renderManual() {
  const data = await fetchAPI('/manual/export');
  const leads = data.leads || [];
  if (leads.length === 0) return `${renderTopbar('Manual Outreach Queue')}
    <div class="flex-1 flex flex-col items-center justify-center bg-slate-50/50 text-slate-500">
      <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm">
        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h3 class="text-lg font-bold text-slate-800">All caught up!</h3>
        <p class="mt-2 text-sm">No leads currently require manual outreach.</p>
      </div>
    </div>`;

  const rows = leads.map(l => {
    const script = `Hi ${l.businessName} team, I noticed you might not have a mobile-friendly website setup. We help local businesses in ${l.city || 'your area'} upgrade their digital storefront. Interested in a quick chat?`;
    const encodedScript = encodeURIComponent(script);
    let actionBtn = `<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No phone available</span>`;
    if (l.phone) {
      const cleanPhone = l.phone.replace(/\D/g, '');
      actionBtn = `<a href="https://wa.me/${cleanPhone}?text=${encodedScript}" target="_blank" class="px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-bold hover:bg-[#1DA851] transition shadow-sm shadow-green-500/20">WhatsApp</a>`;
    }
    return `
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-4 transition hover:shadow-md">
        <div class="flex justify-between items-start mb-5">
          <div>
            <h3 class="font-bold text-slate-800 text-lg">${escapeHTML(l.businessName)}</h3>
            <div class="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              ${escapeHTML(l.phone || 'N/A')}
            </div>
            <div class="text-xs font-bold text-red-500 mt-2 bg-red-50 inline-block px-2 py-1 rounded border border-red-100 uppercase tracking-wide">Issue: ${escapeHTML(l.primaryIssue || 'No Website')}</div>
          </div>
          <div class="flex items-center gap-3">
            ${actionBtn}
            <button onclick="navigator.clipboard.writeText(this.dataset.script); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Script', 2000);" data-script="${escapeHTML(script)}" class="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">Copy Script</button>
          </div>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">${escapeHTML(script)}</div>
      </div>
    `;
  }).join('');

  return `${renderTopbar('Manual Outreach Queue', 'Follow up on leads without emails')}
    <div class="p-8 overflow-y-auto flex-1 bg-slate-50/50">
      <div class="max-w-4xl mx-auto">
        <div class="mb-6 flex justify-between items-end">
          <h2 class="text-xl font-bold text-slate-800">Needs Manual Contact (${leads.length})</h2>
        </div>
        ${rows}
      </div>
    </div>`;
}

async function renderLogs() {
  return `${renderTopbar('Dispatch Logs')}
    <div class="p-8 overflow-y-auto flex-1 bg-slate-50/50">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <th class="py-3 px-4">Timestamp</th>
              <th class="py-3 px-4">Recipient</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Subject</th>
            </tr>
          </thead>
          <tbody id="logs-tbody">
            <tr><td colspan="4" class="p-8 text-center text-sm text-slate-500">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

async function updateLogsUI() {
  if (window.location.hash !== '#logs') return;
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  try {
    const data = await fetchAPI('/dispatch_logs');
    const logs = data.logs || [];
    logs.reverse();
    if(logs.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-sm text-slate-500">No logs found</td></tr>`; return; }
    tbody.innerHTML = logs.map((log, i) => {
      const isSuccess = log.status === 'sent';
      const statusColor = isSuccess ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200';
      return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer" onclick="document.getElementById('log-detail-${i}').classList.toggle('hidden')">
          <td class="py-3 px-4 font-mono text-xs whitespace-nowrap text-slate-500">${new Date(log.timestamp).toLocaleString()}</td>
          <td class="py-3 px-4 truncate max-w-xs text-sm font-bold text-slate-700">${escapeHTML(log.recipientEmail)}</td>
          <td class="py-3 px-4 text-sm">
            <span class="px-2 py-1 rounded-md border text-[10px] font-bold tracking-wider uppercase ${statusColor}">${escapeHTML(log.status)}</span>
          </td>
          <td class="py-3 px-4 truncate max-w-sm text-sm text-slate-600">${escapeHTML(log.subject || '')}</td>
        </tr>
        <tr id="log-detail-${i}" class="hidden bg-slate-50/50">
          <td colspan="4" class="p-4 border-b border-slate-100">
            <div class="text-xs font-mono text-slate-600 whitespace-pre-wrap overflow-x-auto p-4 bg-white rounded-xl border border-slate-200 shadow-sm leading-relaxed">${escapeHTML(JSON.stringify(log, null, 2))}</div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {}
}

// ─── Router ─────────────────────────────────────────────────────────────────

const appContainer = document.getElementById('app');

async function navigate(hash) {
  try {
    if (consolePollInterval) { clearInterval(consolePollInterval); consolePollInterval = null; }
    
    const parts = hash.split('/');
    const view = parts[0];
    const param = parts[1];
    
    let content = '';
    
    if (view === 'overview') content = await renderOverview();
    else if (view === 'discover') content = await renderDiscover();
    else if (view === 'console') {
      content = await renderConsole(param);
      consolePollInterval = setInterval(pollConsoleOutput, 1000);
      setTimeout(pollConsoleOutput, 0); // immediate run
    }
    else if (view === 'leads') content = await renderLeads();
    else if (view === 'review') content = await renderReview();
    else if (view === 'manual') content = await renderManual();
    else if (view === 'logs') {
      content = await renderLogs();
      consolePollInterval = setInterval(updateLogsUI, 3000);
      setTimeout(updateLogsUI, 0);
    }
    else content = await renderOverview();
    
    appContainer.innerHTML = renderSidebar() + '<div class="flex flex-col flex-1 h-full min-w-0 bg-slate-100">' + content + '</div>';
    
    if (view === 'review') updateReviewUI();
  } catch (err) {
    appContainer.innerHTML = renderSidebar() + `
      <div class="flex-1 p-8 bg-slate-50/50">
        <div class="bg-red-50 p-6 rounded-xl border border-red-200 text-red-600 max-w-2xl mx-auto">
          <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Error loading view</h2>
          <pre class="text-sm font-mono whitespace-pre-wrap">${escapeHTML(err.message)}</pre>
        </div>
      </div>
    `;
  }
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1) || 'overview';
  navigate(hash);
});

const initialHash = window.location.hash.substring(1) || 'overview';
navigate(initialHash);

// ─── Live Sending Global Logic ──────────────────────────────────────────────

let globalSendPollInterval = null;

async function pollGlobalSendStatus() {
  try {
    const data = await fetchAPI('/jobs');
    const liveSendJob = data.jobs.find(j => j.command === 'send' && j.status === 'running');
    
    let banner = document.getElementById('live-send-banner');
    if (liveSendJob) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'live-send-banner';
        banner.className = 'fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white font-bold px-6 py-3 flex items-center justify-between shadow-xl border-b-4 border-red-800 transition-all';
        banner.innerHTML = \`
          <div class="flex items-center gap-3">
            <span class="animate-ping w-3 h-3 bg-white rounded-full"></span>
            <span class="text-sm tracking-widest uppercase">LIVE SENDING IN PROGRESS</span>
          </div>
          <button onclick="stopLiveSend()" class="bg-red-800 hover:bg-red-900 text-white px-5 py-1.5 rounded-lg text-sm transition font-black border border-red-900/50 shadow-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            HALT SENDING
          </button>
        \`;
        document.body.appendChild(banner);
        document.getElementById('app').style.paddingTop = '52px';
      }
    } else {
      if (banner) {
        banner.remove();
        document.getElementById('app').style.paddingTop = '0px';
      }
    }
  } catch (e) {}
}

async function stopLiveSend() {
  if (confirm("Are you sure you want to halt the live send? This will send a graceful stop signal to the engine.")) {
    try {
      await fetchAPI('/send/stop', { method: 'POST' });
      alert('Stop signal dispatched. The engine will halt after the current email.');
    } catch (e) {
      alert('Failed to stop: ' + e.message);
    }
  }
}

if (!globalSendPollInterval) {
  globalSendPollInterval = setInterval(pollGlobalSendStatus, 3000);
  pollGlobalSendStatus();
}

function openLiveSendModal() {
  if (!document.getElementById('live-send-modal')) {
    const m = document.createElement('div');
    m.id = 'live-send-modal';
    m.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center hidden';
    m.innerHTML = \`
      <div class="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Confirm Live Send
        </h3>
        <p class="text-sm text-slate-600 mb-4" id="live-send-preview-text">Loading preview...</p>
        
        <div class="mb-4">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Type <span class="font-mono text-red-600 font-black">SEND <span id="live-send-count">0</span></span> to confirm</label>
          <input type="text" id="live-send-confirm-input" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="SEND 0" onkeyup="checkLiveSendInput()">
        </div>

        <div class="flex justify-end gap-3">
          <button onclick="closeLiveSendModal()" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
          <button id="live-send-submit-btn" onclick="submitLiveSend()" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition opacity-50 cursor-not-allowed" disabled>Start Sending</button>
        </div>
      </div>
    \`;
    document.body.appendChild(m);
  }
  
  const m = document.getElementById('live-send-modal');
  m.classList.remove('hidden');
  document.getElementById('live-send-preview-text').innerText = 'Loading preview...';
  document.getElementById('live-send-confirm-input').value = '';
  document.getElementById('live-send-submit-btn').disabled = true;
  document.getElementById('live-send-submit-btn').classList.add('opacity-50', 'cursor-not-allowed');
  
  fetchAPI('/send/preview', { method: 'POST' }).then(res => {
    window.currentSendBatch = res;
    document.getElementById('live-send-preview-text').innerText = \`You are about to dispatch \${res.count} approved emails. This action is irreversible.\`;
    document.getElementById('live-send-count').innerText = res.count;
    document.getElementById('live-send-confirm-input').placeholder = \`SEND \${res.count}\`;
  }).catch(e => {
    document.getElementById('live-send-preview-text').innerText = 'Error loading preview: ' + e.message;
  });
}

function closeLiveSendModal() {
  document.getElementById('live-send-modal').classList.add('hidden');
}

function checkLiveSendInput() {
  const val = document.getElementById('live-send-confirm-input').value;
  const count = window.currentSendBatch ? window.currentSendBatch.count : 0;
  const btn = document.getElementById('live-send-submit-btn');
  if (val === \`SEND \${count}\` && count > 0) {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  } else {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

async function submitLiveSend() {
  const btn = document.getElementById('live-send-submit-btn');
  btn.disabled = true;
  btn.innerText = 'Starting...';
  try {
    await fetchAPI('/send/start', {
      method: 'POST',
      body: JSON.stringify({ fingerprint: window.currentSendBatch.fingerprint })
    });
    closeLiveSendModal();
    window.location.hash = '#console';
  } catch (e) {
    alert('Error starting live send: ' + e.message);
    btn.disabled = false;
    btn.innerText = 'Start Sending';
  }
}

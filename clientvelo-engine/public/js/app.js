// ClientVelo Dashboard App

const API_BASE = '/api';

// Utilities
async function fetchAPI(endpoint) {
  const token = window.CV_TOKEN;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'X-CV-Token': token,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.statusText}`);
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
  return `
    <div class="w-64 bg-cvnavy text-white flex flex-col h-full shrink-0">
      <div class="p-6">
        <h1 class="text-xl font-bold tracking-wider text-cvteal">ClientVelo</h1>
        <p class="text-xs text-gray-400 mt-1 uppercase tracking-widest">Engine Dashboard</p>
      </div>
      <nav class="flex-1 px-4 space-y-2">
        <a href="#overview" class="block px-4 py-2 rounded transition-colors hover:bg-slate-800" onclick="navigate('overview')">Overview</a>
        <a href="#leads" class="block px-4 py-2 rounded transition-colors hover:bg-slate-800" onclick="navigate('leads')">All Leads</a>
        <a href="#review" class="block px-4 py-2 rounded transition-colors hover:bg-slate-800" onclick="navigate('review')">Review Workspace</a>
        <a href="#manual" class="block px-4 py-2 rounded transition-colors hover:bg-slate-800" onclick="navigate('manual')">Manual Outreach</a>
        <a href="#logs" class="block px-4 py-2 rounded transition-colors hover:bg-slate-800" onclick="navigate('logs')">Dispatch Logs</a>
      </nav>
      <div class="p-4 border-t border-slate-800 text-xs text-slate-500">
        v1.0.0
      </div>
    </div>
  `;
}

function renderTopbar(title) {
  return `
    <header class="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0">
      <h2 class="text-xl font-semibold text-cvslate">${escapeHTML(title)}</h2>
    </header>
  `;
}

// ─── Views ──────────────────────────────────────────────────────────────────

async function renderOverview() {
  const data = await fetchAPI('/overview');
  const { stats } = data;

  return `
    ${renderTopbar('Overview')}
    <div class="p-8 overflow-y-auto flex-1 bg-gray-50">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div class="text-sm font-medium text-gray-500 mb-1">Total Leads</div>
          <div class="text-3xl font-bold text-cvnavy">${stats.totalLeads}</div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-yellow-400">
          <div class="text-sm font-medium text-gray-500 mb-1">Needs Review</div>
          <div class="text-3xl font-bold text-cvnavy">${stats.needsReview}</div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-blue-400">
          <div class="text-sm font-medium text-gray-500 mb-1">Drafted & Pending Approval</div>
          <div class="text-3xl font-bold text-cvnavy">${stats.drafted}</div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-cvteal">
          <div class="text-sm font-medium text-gray-500 mb-1">Sent</div>
          <div class="text-3xl font-bold text-cvnavy">${stats.sent}</div>
        </div>

      </div>
    </div>
  `;
}

async function renderLeads() {
  const data = await fetchAPI('/leads');
  const { leads } = data;

  const rows = leads.map(l => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td class="py-3 px-4 font-medium">${escapeHTML(l.businessName)}</td>
      <td class="py-3 px-4 text-gray-500">${escapeHTML(l.websiteUrl || 'No Website')}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-600">
          ${escapeHTML(l.workflowStatus)}
        </span>
      </td>
      <td class="py-3 px-4 text-gray-500">${escapeHTML(l.primaryIssue || 'None')}</td>
    </tr>
  `).join('');

  return `
    ${renderTopbar('All Leads')}
    <div class="p-8 overflow-y-auto flex-1 bg-gray-50">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
              <th class="py-3 px-4 font-medium">Business Name</th>
              <th class="py-3 px-4 font-medium">Website</th>
              <th class="py-3 px-4 font-medium">Status</th>
              <th class="py-3 px-4 font-medium">Primary Issue</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : `<tr><td colspan="4" class="py-8 text-center text-gray-500">No leads found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Review Workspace ───────────────────────────────────────────────────────

let currentDrafts = [];
let currentDraftIndex = 0;

async function renderReview() {
  const data = await fetchAPI('/drafts');
  currentDrafts = data.drafts || [];
  currentDraftIndex = 0;
  
  if (currentDrafts.length === 0) {
    return `
      ${renderTopbar('Review Workspace')}
      <div class="flex-1 flex items-center justify-center text-gray-500">No drafts to review.</div>
    `;
  }
  
  // Create shell
  return `
    ${renderTopbar('Review Workspace (Use J/K to navigate, A to approve, S to skip, E to edit, X to suppress)')}
    <div class="flex-1 flex overflow-hidden bg-gray-100">
      <!-- Left: Queue -->
      <div class="w-64 bg-white border-r border-gray-200 overflow-y-auto" id="review-queue"></div>
      
      <!-- Center: Draft Preview -->
      <div class="flex-1 flex flex-col p-6 overflow-y-auto relative">
        <div id="review-center"></div>
      </div>
      
      <!-- Right: Evidence -->
      <div class="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto flex flex-col items-center">
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
    centerContainer.innerHTML = '<div class="text-gray-500 text-center p-8">No drafts remaining.</div>';
    qContainer.innerHTML = '';
    rightContainer.innerHTML = '';
    return;
  }
  
  // Render Queue
  qContainer.innerHTML = currentDrafts.map((d, i) => `
    <div class="p-4 border-b border-gray-100 cursor-pointer ${i === currentDraftIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-50'}" onclick="selectDraft(${i})">
      <div class="font-medium text-sm truncate ${d.approved ? 'text-green-600' : 'text-cvslate'}">${escapeHTML(d.businessName)}</div>
      <div class="text-xs text-gray-500 truncate mt-1">${escapeHTML(d.recipientEmail)}</div>
    </div>
  `).join('');
  
  const draft = currentDrafts[currentDraftIndex];
  
  // Render Center
  const statusBadge = draft.approved 
    ? `<span class="bg-green-100 text-green-700 px-3 py-1 text-xs font-bold uppercase rounded tracking-wide">Approved</span>`
    : `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 text-xs font-bold uppercase rounded tracking-wide">Pending Review</span>`;

  centerContainer.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      ${statusBadge}
      <div class="space-x-2">
        <button onclick="handleAction('suppress')" class="px-4 py-2 bg-red-50 text-red-600 rounded text-sm font-medium hover:bg-red-100 transition">Suppress (x)</button>
        ${draft.approved 
          ? `<button onclick="handleAction('revoke')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition">Revoke (r)</button>`
          : `<button onclick="handleAction('approve')" class="px-4 py-2 bg-cvteal text-white rounded text-sm font-medium hover:bg-teal-700 transition">Approve (a)</button>`
        }
      </div>
    </div>
    
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
        <div class="text-sm font-medium text-cvslate">${escapeHTML(draft.recipientName)} &lt;${escapeHTML(draft.recipientEmail)}&gt;</div>
      </div>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</label>
        <input type="text" id="draft-subject" class="w-full text-sm p-2 border border-gray-200 rounded focus:border-cvteal focus:ring-1 focus:ring-cvteal outline-none font-medium" value="${escapeHTML(draft.subject)}" ${draft.approved ? 'disabled' : ''}>
      </div>
      <div class="flex-1 flex flex-col">
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Body</label>
        <textarea id="draft-body" class="w-full flex-1 p-3 border border-gray-200 rounded focus:border-cvteal focus:ring-1 focus:ring-cvteal outline-none font-mono text-sm resize-none whitespace-pre-wrap" ${draft.approved ? 'disabled' : ''}>${escapeHTML(draft.body)}</textarea>
      </div>
      
      ${!draft.approved ? `
        <div class="mt-4 flex justify-end">
          <button onclick="saveDraftEdits()" class="px-4 py-2 text-sm font-medium text-cvslate bg-gray-100 hover:bg-gray-200 rounded">Save Edits</button>
        </div>
      ` : ''}
      <div id="draft-error" class="mt-2 text-red-500 text-sm hidden font-medium"></div>
    </div>
  `;
  
  // Render Right (Evidence / Phone Frame)
  let imgTag = '<div class="h-64 flex items-center justify-center text-gray-400">No screenshot</div>';
  if (draft.screenshotPath) {
    const fn = draft.screenshotPath.split(/[/\\]/).pop();
    imgTag = `<img src="/api/screenshots/${fn}" class="w-full object-cover">`;
  }
  
  rightContainer.innerHTML = `
    <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Evidence</h3>
    <p class="text-sm text-cvslate mb-6">${escapeHTML(draft.evidenceText || 'No specific evidence recorded.')}</p>
    
    <div class="w-[300px] h-[650px] border-[8px] border-slate-800 rounded-[2rem] overflow-hidden shadow-xl relative bg-white flex flex-col">
      <div class="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-xl mx-auto w-32 z-10"></div>
      <div class="flex-1 overflow-y-auto">
        ${imgTag}
      </div>
    </div>
    
    ${draft.audit ? `
      <div class="mt-6 w-full text-xs text-gray-500">
        <div class="font-semibold uppercase tracking-wide mb-2">Audit Data</div>
        <div>Load Time: ${draft.audit.loadTimeMs}ms</div>
        <div>Resources: ${draft.audit.resourcesCount}</div>
        <div>Mobile Friendly: ${draft.audit.mobileFriendly ? 'Yes' : 'No'}</div>
        <div>Booking CTA: ${draft.audit.hasBookingCta ? 'Yes' : 'No'}</div>
        <div>Phone Link: ${draft.audit.hasPhoneLink ? 'Yes' : 'No'}</div>
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
  
  const subEl = document.getElementById('draft-subject');
  const bodyEl = document.getElementById('draft-body');
  const errEl = document.getElementById('draft-error');
  
  const sub = subEl.value.trim();
  const body = bodyEl.value.trim();
  
  try {
    const fullText = (sub + ' ' + body).toLowerCase();
    const banned = ['losing customers', 'you are losing', 'guaranteed', 'revenue', 'redesign', 'verified'];
    for (const b of banned) {
      if (fullText.includes(b)) throw new Error(`Banned phrase: "${b}"`);
    }
    if (fullText.includes('undefined') || fullText.includes('null')) throw new Error('Missing token (null/undefined)');
    if (sub.toLowerCase().startsWith('re:') || sub.toLowerCase().startsWith('fwd:')) throw new Error('Banned subject prefix');
    
    errEl.classList.add('hidden');
    
    await fetchAPI(`/drafts/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ subject: sub, body })
    });
    
    draft.subject = sub;
    draft.body = body;
    updateReviewUI();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
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
      draft.approved = false;
      updateReviewUI();
    } else if (action === 'suppress') {
      await fetchAPI(`/suppression/opt_out`, { 
        method: 'POST', 
        body: JSON.stringify({ email: draft.recipientEmail })
      });
      // Remove from queue
      currentDrafts.splice(currentDraftIndex, 1);
      if (currentDraftIndex >= currentDrafts.length) {
        currentDraftIndex = Math.max(0, currentDrafts.length - 1);
      }
      updateReviewUI();
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } else {
      alert(`Error: ${err.message}`);
    }
  }
};

// Keyboard bindings
window.addEventListener('keydown', (e) => {
  // Ignore if user is typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  if (window.location.hash.includes('review') && currentDrafts.length > 0) {
    if (e.key === 'j') {
      selectDraft(currentDraftIndex + 1);
    } else if (e.key === 'k') {
      selectDraft(currentDraftIndex - 1);
    } else if (e.key === 'a') {
      handleAction('approve');
    } else if (e.key === 'r') {
      handleAction('revoke');
    } else if (e.key === 'x') {
      handleAction('suppress');
    } else if (e.key === 's') {
      selectDraft(currentDraftIndex + 1); // skip
    } else if (e.key === 'e') {
      const bodyEl = document.getElementById('draft-body');
      if (bodyEl && !bodyEl.disabled) {
        bodyEl.focus();
        e.preventDefault();
      }
    }
  }
});

// ─── Manual Outreach ────────────────────────────────────────────────────────

async function renderManual() {
  const data = await fetchAPI('/manual/export');
  const leads = data.leads || [];
  
  if (leads.length === 0) {
    return `
      ${renderTopbar('Manual Outreach Queue')}
      <div class="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div class="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <svg class="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <h3 class="text-lg font-medium text-gray-900">All caught up!</h3>
          <p class="mt-1">No leads currently require manual outreach.</p>
        </div>
      </div>
    `;
  }

  const rows = leads.map(l => {
    // Basic script
    const script = `Hi ${l.businessName} team, I noticed you might not have a mobile-friendly website setup. We help local businesses in ${l.city || 'your area'} upgrade their digital storefront. Interested in a quick chat?`;
    const encodedScript = encodeURIComponent(script);
    
    // Generate wa.me link if phone exists
    let actionBtn = `<span class="text-xs text-gray-400 italic">No phone available</span>`;
    if (l.phone) {
      // clean phone (remove non-digits, perhaps add country code if missing, but we'll just strip for now)
      const cleanPhone = l.phone.replace(/\D/g, '');
      actionBtn = `<a href="https://wa.me/${cleanPhone}?text=${encodedScript}" target="_blank" class="px-3 py-1.5 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition">WhatsApp (wa.me)</a>`;
    }
    
    return `
      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-bold text-cvslate">${escapeHTML(l.businessName)}</h3>
            <div class="text-sm text-gray-500 mt-1">Phone: ${escapeHTML(l.phone || 'N/A')}</div>
            <div class="text-xs text-red-500 mt-1">Issue: ${escapeHTML(l.primaryIssue || 'No Website')}</div>
          </div>
          <div class="space-x-2">
            ${actionBtn}
            <button onclick="navigator.clipboard.writeText(this.dataset.script); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Script', 2000);" data-script="${escapeHTML(script)}" class="px-3 py-1.5 bg-gray-100 text-cvslate rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300">Copy Script</button>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded border border-gray-100 text-sm font-mono text-gray-700 whitespace-pre-wrap">${escapeHTML(script)}</div>
      </div>
    `;
  }).join('');

  return `
    ${renderTopbar('Manual Outreach Queue')}
    <div class="p-8 overflow-y-auto flex-1 bg-gray-50">
      <div class="max-w-4xl mx-auto">
        <div class="mb-6 flex justify-between items-end">
          <h2 class="text-lg font-semibold text-gray-700">Needs Manual Contact (${leads.length})</h2>
          <p class="text-sm text-gray-500">Leads with no website or phone-only presence.</p>
        </div>
        ${rows}
      </div>
    </div>
  `;
}

// ─── Dispatch Logs ──────────────────────────────────────────────────────────

let logsPollInterval = null;

async function renderLogs() {
  const data = await fetchAPI('/dispatch_logs');
  const logs = data.logs || [];
  logs.reverse(); // Newest first
  
  if (logs.length === 0) {
    return `
      ${renderTopbar('Dispatch Logs')}
      <div class="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div class="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <h3 class="text-lg font-medium text-gray-900">No dispatch logs found</h3>
          <p class="mt-1">Run <code>npm run cli queue --send</code> to dispatch emails.</p>
        </div>
      </div>
    `;
  }
  
  const rows = logs.map((log, i) => {
    const isSuccess = log.status === 'sent';
    const statusColor = isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    
    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer" onclick="document.getElementById('log-detail-${i}').classList.toggle('hidden')">
        <td class="py-3 px-4 font-mono text-xs whitespace-nowrap text-gray-500">${new Date(log.timestamp).toLocaleString()}</td>
        <td class="py-3 px-4 truncate max-w-xs text-sm font-medium text-cvslate">${escapeHTML(log.recipientEmail)}</td>
        <td class="py-3 px-4 text-sm">
          <span class="px-2 py-1 rounded text-xs font-bold tracking-wide uppercase ${statusColor}">${escapeHTML(log.status)}</span>
        </td>
        <td class="py-3 px-4 truncate max-w-sm text-sm text-gray-600">${escapeHTML(log.subject || '')}</td>
      </tr>
      <tr id="log-detail-${i}" class="hidden bg-slate-50">
        <td colspan="4" class="p-4 border-b border-gray-200">
          <div class="text-xs font-mono text-gray-600 whitespace-pre-wrap overflow-x-auto p-4 bg-white rounded border border-gray-200">${escapeHTML(JSON.stringify(log, null, 2))}</div>
        </td>
      </tr>
    `;
  }).join('');
  
  return `
    ${renderTopbar('Dispatch Logs (Auto-refreshing)')}
    <div class="p-8 overflow-y-auto flex-1 bg-gray-50">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <th class="py-3 px-4 font-medium">Timestamp</th>
              <th class="py-3 px-4 font-medium">Recipient</th>
              <th class="py-3 px-4 font-medium">Status</th>
              <th class="py-3 px-4 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody id="logs-tbody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function updateLogsUI() {
  if (window.location.hash !== '#logs') return;
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  
  try {
    const data = await fetchAPI('/dispatch_logs');
    const logs = data.logs || [];
    logs.reverse();
    
    tbody.innerHTML = logs.map((log, i) => {
      const isSuccess = log.status === 'sent';
      const statusColor = isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
      return `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer" onclick="document.getElementById('log-detail-${i}').classList.toggle('hidden')">
          <td class="py-3 px-4 font-mono text-xs whitespace-nowrap text-gray-500">${new Date(log.timestamp).toLocaleString()}</td>
          <td class="py-3 px-4 truncate max-w-xs text-sm font-medium text-cvslate">${escapeHTML(log.recipientEmail)}</td>
          <td class="py-3 px-4 text-sm">
            <span class="px-2 py-1 rounded text-xs font-bold tracking-wide uppercase ${statusColor}">${escapeHTML(log.status)}</span>
          </td>
          <td class="py-3 px-4 truncate max-w-sm text-sm text-gray-600">${escapeHTML(log.subject || '')}</td>
        </tr>
        <tr id="log-detail-${i}" class="hidden bg-slate-50">
          <td colspan="4" class="p-4 border-b border-gray-200">
            <div class="text-xs font-mono text-gray-600 whitespace-pre-wrap overflow-x-auto p-4 bg-white rounded border border-gray-200">${escapeHTML(JSON.stringify(log, null, 2))}</div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to poll logs', err);
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

const appContainer = document.getElementById('app');

async function navigate(view) {
  try {
    if (logsPollInterval) {
      clearInterval(logsPollInterval);
      logsPollInterval = null;
    }
    
    const sidebar = renderSidebar();
    let content = '';
    
    if (view === 'overview') {
      content = await renderOverview();
    } else if (view === 'leads') {
      content = await renderLeads();
    } else if (view === 'review') {
      content = await renderReview();
    } else if (view === 'manual') {
      content = await renderManual();
    } else if (view === 'logs') {
      content = await renderLogs();
      logsPollInterval = setInterval(updateLogsUI, 3000);
    } else {
      content = await renderOverview();
    }
    
    appContainer.innerHTML = sidebar + '<div class="flex flex-col flex-1 h-full min-w-0">' + content + '</div>';
    
    if (view === 'review') {
      updateReviewUI();
    }
    
    // Update active nav state
    document.querySelectorAll('nav a').forEach(el => {
      el.classList.remove('bg-slate-800');
      if (el.getAttribute('href') === '#' + view) {
        el.classList.add('bg-slate-800');
      }
    });
  } catch (err) {
    appContainer.innerHTML = sidebar + `
      <div class="flex-1 p-8 text-red-500">
        <h2 class="text-xl font-bold mb-4">Error loading ${view}</h2>
        <pre class="text-sm bg-red-50 p-4 rounded">${escapeHTML(err.message)}</pre>
      </div>
    `;
  }
}

// Handle initial load and hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1) || 'overview';
  navigate(hash);
});

// Boot
const initialHash = window.location.hash.substring(1) || 'overview';
navigate(initialHash);

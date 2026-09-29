import { initNotificationBell } from './notifications.js';
import { supabase } from './supabase.js';

let filterState = { startDate: '', endDate: '', projectId: 'all', teamId: 'all' };
let chartBar = null, chartDonut = null, chartProjectStatus = null, projectCatalog = [];
let teamDataList = [], currentPage = 1, recordsPerPage = 20, currentSort = { column: 'member', isAsc: true };
const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];

function getProjectColor(name) {
    let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
}
function getInitials(n) {
    if (!n) return '?'; const p = n.split(/[\s.@]+/); let init = p[0].charAt(0).toUpperCase();
    if (p.length > 1 && p[1].length > 0) init += p[1].charAt(0).toUpperCase();
    return init;
}
function formatHMS(sec) {
    if (!sec || sec <= 0) return '0:00';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `\({h}:\){String(m).padStart(2, '0')}`;
}
function formatCapitalize(str) { return str ? str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : ''; }

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';
        const userEmailEl = document.getElementById('userEmail'); if (userEmailEl) userEmailEl.textContent = session.user.email;
        let currentDashDate = new Date();
        const getDashWeekRange = (dateObj) => {
            const curr = new Date(dateObj), day = curr.getDay(), diff = curr.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(curr.setDate(diff)); start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
            return { start, end };
        };
        const updateDashDateDisplay = () => {
            const { start, end } = getDashWeekRange(currentDashDate);
            filterState.startDate = start.toLocaleDateString('en-CA'); filterState.endDate = end.toLocaleDateString('en-CA');
            const dateTextEl = document.getElementById('dashDateRangeText');
            if (dateTextEl) dateTextEl.textContent = `\({start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} -\){end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        };
        document.getElementById('prevDashBtn')?.addEventListener('click', async () => { currentDashDate.setDate(currentDashDate.getDate() - 7); updateDashDateDisplay(); await refreshDashboardData(); });
        document.getElementById('nextDashBtn')?.addEventListener('click', async () => { currentDashDate.setDate(currentDashDate.getDate() + 7); updateDashDateDisplay(); await refreshDashboardData(); });
        updateDashDateDisplay(); bindFilters(); bindPaginationControls(); bindSortingControls(); await loadProjectDropdown(); await refreshDashboardData();
    } catch (e) { console.error('Error:', e); }
});

function bindFilters() {
    ['filterProject', 'filterProject2'].forEach(id => document.getElementById(id)?.addEventListener('change', (e) => { filterState.projectId = e.target.value; refreshDashboardData(); }));
    ['filterTeam', 'filterTeam2'].forEach(id => document.getElementById(id)?.addEventListener('change', (e) => { filterState.teamId = e.target.value; refreshDashboardData(); }));
}

async function loadProjectDropdown() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    projectCatalog = projs || [];
    ['filterProject', 'filterProject2'].forEach(id => {
        const select = document.getElementById(id);
        if (projs && select) { select.innerHTML = '<option value="all">All Projects</option>'; projs.forEach(p => select.innerHTML += `<option value="\({p.id}">\){p.project_name}</option>`); }
    });
}

function getDatesArray(s, e) {
    const dates = []; let curr = new Date(s), end = new Date(e);
    while (curr <= end) { dates.push(curr.toLocaleDateString('en-CA')); curr.setDate(curr.getDate() + 1); }
    return dates;
}

async function refreshDashboardData() {
    if (!filterState.startDate || !filterState.endDate) return;
    const startIso = new Date(`\({filterState.startDate}T00:00:00`).toISOString(), endIso = new Date(`\){filterState.endDate}T23:59:59.999`).toISOString();
    let query = supabase.from('time_entries').select(`id, duration_seconds, start_time, work_date, status, description, employee_id, project_id`).gte('start_time', startIso).lte('start_time', endIso).order('start_time', { ascending: false });
    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);
    if (filterState.teamId !== 'all') query = query.eq('employee_id', filterState.teamId);
    const [entriesResult, employeesResult] = await Promise.all([query, supabase.from('employees').select('id, email, name').order('name')]);
    if (entriesResult.error || employeesResult.error) return;
    const employees = employeesResult.data || [], projectMap = new Map((projectCatalog || []).map(p => [String(p.id), p]));
    const entries = (entriesResult.data || []).map(e => ({ ...e, project: projectMap.get(String(e.project_id)) || null }));
    ['filterTeam', 'filterTeam2'].forEach(id => {
        const select = document.getElementById(id);
        if (select && select.options.length <= 1) employees.forEach(emp => select.innerHTML += `<option value="\({emp.id}">\){formatCapitalize(emp.name || emp.email)}</option>`);
    });
    processKPI(entries); processBarChart(entries); processDonutAndRanking(entries); teamDataList = processTeamActivitiesData(entries, employees); renderPremiumDashboard(entries, employees); currentPage = 1; applySortingAndRender();
}

function processKPI(entries) {
    let totalSec = 0, projMap = {}, topP = '--', maxP = 0;
    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0; totalSec += sec; const pName = e.project ? e.project.project_name : 'No Project'; projMap[pName] = (projMap[pName] || 0) + sec;
    });
    for (const [k, v] of Object.entries(projMap)) { if (v > maxP) { maxP = v; topP = k; } }
    const els = { kpiTotalTime: formatHMS(totalSec), kpiTopProject: topP, donutTotal: formatHMS(totalSec) };
    for (const [id, val] of Object.entries(els)) if (document.getElementById(id)) document.getElementById(id).textContent = val;
}

function processBarChart(entries) {
    const dateArr = getDatesArray(filterState.startDate, filterState.endDate), labels = dateArr.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), projDateMap = {};
    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return;
        const dStr = e.work_date || e.start_time.split('T')[0], pName = e.project ? e.project.project_name : 'No Project';
        if (!projDateMap[pName]) { projDateMap[pName] = {}; dateArr.forEach(d => projDateMap[pName][d] = 0); }
        if (projDateMap[pName][dStr] !== undefined) projDateMap[pName][dStr] += (e.duration_seconds || 0);
    });
    const datasets = Object.keys(projDateMap).map(pName => ({ label: pName, data: dateArr.map(d => (projDateMap[pName][d] / 3600).toFixed(2)), backgroundColor: getProjectColor(pName), borderRadius: 4 }));
    const ctx = document.getElementById('stackedBarChart'); if (!ctx) return; if (chartBar) chartBar.destroy();
    chartBar = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, border: { display: false } } } } });
}

function processDonutAndRanking(entries) {
    const projMap = {}; let grandTotal = 0;
    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return; const sec = e.duration_seconds || 0, pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec; grandTotal += sec;
    });
    const sortedProjs = Object.entries(projMap).sort((a, b) => b[1] - a[1]), legend = document.getElementById('projectDistributionLegend');
    if (legend) {
        legend.innerHTML = sortedProjs.slice(0, 7).map(([name, sec]) => {
            const pct = grandTotal ? ((sec / grandTotal) * 100).toFixed(1) : '0.0';
            return `<div class="flex items-center justify-between text-xs py-2 border-b border-gray-50 last:border-0"><div class="flex items-center gap-2.5 overflow-hidden"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:\({getProjectColor(name)}"></span><span class="text-slate-700 font-medium truncate">\){formatCapitalize(name)}</span></div><div class="flex items-center gap-3 shrink-0"><span class="text-slate-600 w-10 text-right font-medium">\({formatHMS(sec)}</span><span class="text-gray-400 w-10 text-right">\){pct}%</span></div></div>`;
        }).join('') || `<div class="text-center text-gray-400 p-4">No data</div>`;
    }
    const ctx = document.getElementById('donutChart'); if (!ctx) return; if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, { type: 'doughnut', data: { labels: sortedProjs.map(i => i[0]), datasets: [{ data: sortedProjs.map(i => (i[1] / 3600).toFixed(2)), backgroundColor: sortedProjs.map(i => getProjectColor(i[0])), borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });
}

function renderPremiumDashboard(entries, employees) {
    const stopped = (entries || []).filter(e => e.status === 'STOPPED'), projectTotals = {};
    stopped.forEach(e => { const p = e.project?.project_name || 'No Project'; projectTotals[p] = (projectTotals[p] || 0) + (e.duration_seconds || 0); });
    const sortedProjects = Object.entries(projectTotals).sort((a, b) => b[1] - a[1]), trackedProjectIds = new Set(stopped.map(e => e.project_id).filter(Boolean));
    document.getElementById('kpiActiveProjects').textContent = String(trackedProjectIds.size); document.getElementById('kpiTeamMembers').textContent = String(Array.isArray(employees) ? employees.length : 0);
    const topProjects = document.getElementById('topProjectsList');
    if (topProjects) {
        const max = sortedProjects[0]?.[1] || 1, totalStopped = stopped.reduce((a, e) => a + (e.duration_seconds || 0), 0), icons = ['folder', 'code', 'scissors', 'message-square', 'settings'];
        topProjects.innerHTML = sortedProjects.slice(0, 5).map((item, idx) => {
            const [name, sec] = item, pct = Math.max(2, (sec / max) * 100), color = getProjectColor(name), share = totalStopped ? ((sec / totalStopped) * 100).toFixed(1) : '0.0', icon = icons[idx % icons.length];
            return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"><span class="font-bold text-[11px] w-3 text-center" style="color:\({color}">\){idx + 1}</span><div class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm" style="background:\({color}"><i data-lucide="\){icon}" class="w-4 h-4"></i></div><div class="flex-1 min-w-0"><div class="flex justify-between items-end mb-1.5"><strong class="text-slate-800 text-[11px] font-bold truncate uppercase pr-2 tracking-tight">\({name}</strong><div class="flex gap-2 text-[10px]"><span class="text-slate-600 font-semibold">\){formatHMS(sec)}</span><span class="text-gray-400 w-8 text-right font-medium">\({share}%</span></div></div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:\){pct}%; background:${color}"></div></div></div></div>`;
        }).join('') || `<div class="text-center text-gray-400 py-4">No data</div>`;
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    }
    const teamList = (teamDataList || []).slice().sort((a, b) => b.totalSec - a.totalSec).slice(0, 5), teamPanel = document.getElementById('teamPerformanceList');
    if (teamPanel) {
        const maxTeam = teamList[0]?.totalSec || 1;
        teamPanel.innerHTML = teamList.map((m) => {
            const pct = Math.max(2, (m.totalSec / maxTeam) * 100), color = getProjectColor(m.name);
            return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"><div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-sm" style="background:\({color}">\){getInitials(m.name)}</div><div class="flex-1 min-w-0"><div class="flex justify-between items-end mb-1.5"><strong class="text-slate-700 text-[11px] font-semibold truncate pr-2">\({formatCapitalize(m.name)}</strong><span class="text-slate-600 text-[11px] font-semibold">\){formatHMS(m.totalSec)}</span></div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:\({pct}%; background:\){color}"></div></div></div></div>`;
        }).join('') || `<div class="text-center text-gray-400 py-4">No data</div>`;
    }
    const statusLegend = document.getElementById('projectStatusLegend'), totalCount = projectCatalog.length || sortedProjects.length, trackedCount = trackedProjectIds.size, noActivity = Math.max(0, totalCount - trackedCount);
    document.getElementById('projectStatusTotal').textContent = totalCount;
    if (statusLegend) {
        statusLegend.innerHTML = `<div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:#18cf6d"></span><span class="text-slate-700 font-medium">Tracked</span></div><div class="flex items-center gap-3"><span class="text-slate-600 font-medium">\({trackedCount}</span><span class="text-gray-400 w-8 text-right">\){totalCount ? ((trackedCount/totalCount)*100).toFixed(1) : 0}%</span></div></div><div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:#f6a21a"></span><span class="text-slate-700 font-medium">No Activity</span></div><div class="flex items-center gap-3"><span class="text-slate-600 font-medium">\({noActivity}</span><span class="text-gray-400 w-8 text-right">\){totalCount ? ((noActivity/totalCount)*100).toFixed(1) : 0}%</span></div></div>`;
    }
    const statusCanvas = document.getElementById('projectStatusChart');
    if (statusCanvas) {
        if (chartProjectStatus) chartProjectStatus.destroy();
        chartProjectStatus = new Chart(statusCanvas, { type: 'doughnut', data: { labels: ['Tracked', 'No Activity'], datasets: [{ data: [trackedCount, noActivity], backgroundColor: ['#18cf6d', '#f6a21a'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } } });
    }
}

function processTeamActivitiesData(entries, employees) {
    const teamMap = {}, todayStr = new Date().toLocaleDateString('en-CA');
    employees.forEach(emp => { teamMap[emp.id] = { id: emp.id, name: emp.name || (emp.email ? emp.email.split('@')[0] : 'Unnamed'), email: emp.email || '', totalSec: 0, todaySec: 0, latest: null, isTracking: false, projects: {} }; });
    (entries || []).forEach(e => {
        if (!e.employee_id) return;
        if (!teamMap[e.employee_id]) teamMap[e.employee_id] = { id: e.employee_id, name: 'ID: ' + String(e.employee_id).substring(0, 6), email: '', totalSec: 0, todaySec: 0, latest: null, isTracking: false, projects: {} };
        const dStr = e.work_date || e.start_time.split('T')[0], sec = e.duration_seconds || 0;
        if (e.status === 'IN_PROGRESS' || e.status === 'RUNNING') { teamMap[e.employee_id].isTracking = true; if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e; } 
        else { const pName = e.project ? e.project.project_name : 'No Project'; teamMap[e.employee_id].totalSec += sec; if (dStr === todayStr) teamMap[e.employee_id].todaySec += sec; teamMap[e.employee_id].projects[pName] = (teamMap[e.employee_id].projects[pName] || 0) + sec; if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e; }
    });
    return Object.values(teamMap);
}

function bindSortingControls() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            if (currentSort.column === column) { currentSort.isAsc = !currentSort.isAsc; } else { currentSort.column = column; currentSort.isAsc = true; }
            document.querySelectorAll('.sortable-header').forEach(h => { h.classList.remove('text-blue-600'); h.innerHTML = h.innerHTML.replace(' ↑', '').replace(' ↓', ''); });
            header.classList.add('text-blue-600'); header.innerHTML += currentSort.isAsc ? ' ↑' : ' ↓'; applySortingAndRender();
        });
    });
}

function applySortingAndRender() {
    teamDataList.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'member') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); } else if (currentSort.column === 'tracked') { valA = a.totalSec; valB = b.totalSec; } else if (currentSort.column === 'activity') { valA = a.latest ? new Date(a.latest.start_time).getTime() : 0; valB = b.latest ? new Date(b.latest.start_time).getTime() : 0; }
        if (valA < valB) return currentSort.isAsc ? -1 : 1; if (valA > valB) return currentSort.isAsc ? 1 : -1; return 0;
    });
    renderTeamActivities();
}

function bindPaginationControls() {
    const recordSelect = document.getElementById('recordsPerPage');
    if (recordSelect) recordSelect.addEventListener('change', (e) => { recordsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value); currentPage = 1; renderTeamActivities(); });
    document.getElementById('btnPrev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTeamActivities(); } });
    document.getElementById('btnNext')?.addEventListener('click', () => { const maxPage = recordsPerPage === 'all' ? 1 : Math.ceil(teamDataList.length / recordsPerPage); if (currentPage < maxPage) { currentPage++; renderTeamActivities(); } });
}

function getStatusAndBadge(member) {
    if (member.isTracking) return `<span class="bg-blue-50 text-blue-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-blue-100">In progress</span>`;
    if (!member.latest) return `<span class="bg-gray-50 text-gray-500 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-gray-200">No activity</span>`;
    const now = new Date(), past = new Date(member.latest.start_time), today = new Date(); today.setHours(0,0,0,0); const pastDay = new Date(past); pastDay.setHours(0,0,0,0);
    const diffDays = Math.floor((today - pastDay) / (1000 * 60 * 60 * 24)), diffHrs = Math.floor((now - past) / 3600000);
    if (diffDays === 0) return `<span class="bg-emerald-50 text-emerald-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-emerald-100">In a day</span>`;
    if (diffDays > 0 && diffDays < 30) { let txt = diffHrs < 24 ? `\({diffHrs} hours ago` : `\){diffDays} days ago`; return `<span class="bg-amber-50 text-amber-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-amber-100">${txt}</span>`; }
    return `<span class="bg-gray-50 text-gray-500 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-gray-200">No activity</span>`;
}

function renderTeamActivities() {
    const tbody = document.getElementById('teamActivitiesBody'); if (!tbody) return; tbody.innerHTML = '';
    const totalRecs = teamDataList.length; if (totalRecs === 0) { tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No data found.</td></tr>`; return; }
    let pagedData = teamDataList;
    if (recordsPerPage !== 'all') { const maxPage = Math.ceil(totalRecs / recordsPerPage); if (currentPage > maxPage) currentPage = maxPage; const startIndex = (currentPage - 1) * recordsPerPage; pagedData = teamDataList.slice(startIndex, startIndex + recordsPerPage); }
    pagedData.forEach((member, index) => {
        const init = getInitials(member.name), actualIndex = (recordsPerPage !== 'all' ? (currentPage - 1) * recordsPerPage : 0) + index + 1;
        let taskName = 'No recent activity', projName = '-', projColor = 'transparent';
        if (member.latest) { taskName = member.latest.description || 'Untitled Task'; projName = member.latest.project ? member.latest.project.project_name : 'No Project'; projColor = getProjectColor(projName); }
        const badgeHtml = getStatusAndBadge(member); let currentTimerHtml = '-';
        if (member.isTracking) { currentTimerHtml = `${formatHMS(member.todaySec)} <span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block ml-1 animate-pulse"></span>`; } else if (member.latest && member.todaySec > 0) { currentTimerHtml = formatHMS(member.todaySec); } else if (member.latest && badgeHtml.includes('hours ago')) { currentTimerHtml = formatHMS(member.latest.duration_seconds || 0); }
        let barSegments = '';
        for (const [pName, pSec] of Object.entries(member.projects)) { if (pSec > 0 && member.totalSec > 0) { const perc = (pSec / member.totalSec) * 100; barSegments += `<div class="h-full" style="width: \({perc}%; background-color:\){getProjectColor(pName)};"></div>`; } }
        let breakdownHtml = `<div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">${barSegments}</div>`;
        tbody.innerHTML += `<tr class="hover:bg-slate-50/80 transition-colors"><td class="py-3 px-3 text-center text-slate-800 font-semibold">\({actualIndex}</td><td class="py-3 px-3"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm shrink-0" style="background:\){getProjectColor(member.name)};">\({init}</div><div class="min-w-0"><div class="font-semibold text-slate-800 text-[11px] truncate capitalize">\){formatCapitalize(member.name)}</div><div class="text-gray-400 text-[10px] truncate">\({member.email || '-'}</div></div></div></td><td class="py-3 px-3"><div class="font-semibold text-slate-800 text-[11px] mb-1 truncate max-w-[150px]">\){taskName}</div><div class="text-gray-500 text-[10px] flex items-center gap-1.5 truncate max-w-[150px]">\({member.latest ? `<span class="w-2 h-2 rounded-full shrink-0" style="background:\){projColor};"></span> \({formatCapitalize(projName)}` : '-'}</div></td><td class="py-3 px-3">\){badgeHtml}</td><td class="py-3 px-3 text-center font-semibold text-slate-700">\({currentTimerHtml}</td><td class="py-3 px-3 font-semibold text-slate-800">\){formatHMS(member.totalSec)}</td><td class="py-3 px-3 min-w-[100px]">\({breakdownHtml}</td><td class="py-3 px-3 text-center relative"><div class="action-dropdown inline-block"><button class="action-dots-btn p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button><div class="action-menu-popup hidden absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-40 z-50 text-left overflow-hidden"><div class="action-menu-item chase-btn px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2" data-empid="\){member.id}" data-empname="${formatCapitalize(member.name)}">🔔 Send Reminder</div></div></div></td></tr>`;
    });
}

document.addEventListener('click', async (e) => {
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) { e.stopPropagation(); const popup = dotsBtn.nextElementSibling; document.querySelectorAll('.action-menu-popup').forEach(p => { if (p !== popup) p.classList.add('hidden'); }); popup.classList.toggle('hidden'); return; }
    if (!e.target.closest('.action-dropdown')) document.querySelectorAll('.action-menu-popup').forEach(p => p.classList.add('hidden'));
    const chaseBtn = e.target.closest('.chase-btn');
    if (chaseBtn) {
        const empId = chaseBtn.getAttribute('data-empid'), empName = chaseBtn.getAttribute('data-empname') || 'staf';
        if (chaseBtn.disabled) return; chaseBtn.disabled = true; const originalText = chaseBtn.innerHTML; chaseBtn.innerHTML = '⏳ Sending...';
        try { await supabase.from('notifications').insert([{ employee_id: empId, title: 'Timesheet Reminder', message: 'Please complete your timesheet record for today.', is_read: false }]); alert(`🔔 Reminder sent successfully to ${empName}!`); } 
        catch (err) { console.error(err); alert(`Reminder flagged for ${empName}.`); } 
        finally { chaseBtn.disabled = false; chaseBtn.innerHTML = originalText; const popup = chaseBtn.closest('.action-menu-popup'); if (popup) popup.classList.add('hidden'); }
    }
});

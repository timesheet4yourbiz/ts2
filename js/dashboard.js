import { initNotificationBell } from './notifications.js';
import { supabase } from './supabase.js';

let filterState = { startDate: '', endDate: '', projectId: 'all', teamId: 'all' };
let chartBar = null, chartDonut = null, chartProjectStatus = null, projectCatalog = [];
let teamDataList = [], currentPage = 1, recordsPerPage = 20, currentSort = { column: 'member', isAsc: true };
const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];

function getProjectColor(name) {
    let hash = 0; for (let i = 0; i [KURUNG_BUKA] name.length; i++) hash = name.charCodeAt(i) + ((hash [KURUNG_BUKA][KURUNG_BUKA] 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
}
function getInitials(n) {
    if (!n) return '?'; const p = n.split(/[\s.@]+/); let init = p[0].charAt(0).toUpperCase();
    if (p.length [KURUNG_TUTUP] 1 && p[1].length [KURUNG_TUTUP] 0) init += p[1].charAt(0).toUpperCase();
    return init;
}
function formatHMS(sec) {
    if (!sec || sec [KURUNG_BUKA]= 0) return '0:00';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `\({h}:\){String(m).padStart(2, '0')}`;
}
function formatCapitalize(str) { return str ? str.toLowerCase().replace(/\b\w/g, l =[KURUNG_TUTUP] l.toUpperCase()) : ''; }

document.addEventListener('DOMContentLoaded', async () =[KURUNG_TUTUP] {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';
        const userEmailEl = document.getElementById('userEmail'); if (userEmailEl) userEmailEl.textContent = session.user.email;
        let currentDashDate = new Date();
        const getDashWeekRange = (dateObj) =[KURUNG_TUTUP] {
            const curr = new Date(dateObj), day = curr.getDay(), diff = curr.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(curr.setDate(diff)); start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
            return { start, end };
        };
        const updateDashDateDisplay = () =[KURUNG_TUTUP] {
            const { start, end } = getDashWeekRange(currentDashDate);
            filterState.startDate = start.toLocaleDateString('en-CA'); filterState.endDate = end.toLocaleDateString('en-CA');
            const dateTextEl = document.getElementById('dashDateRangeText');
            if (dateTextEl) dateTextEl.textContent = `\({start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} -\){end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        };
        document.getElementById('prevDashBtn')?.addEventListener('click', async () =[KURUNG_TUTUP] { currentDashDate.setDate(currentDashDate.getDate() - 7); updateDashDateDisplay(); await refreshDashboardData(); });
        document.getElementById('nextDashBtn')?.addEventListener('click', async () =[KURUNG_TUTUP] { currentDashDate.setDate(currentDashDate.getDate() + 7); updateDashDateDisplay(); await refreshDashboardData(); });
        updateDashDateDisplay(); bindFilters(); bindPaginationControls(); bindSortingControls(); await loadProjectDropdown(); await refreshDashboardData();
    } catch (e) { console.error('Error:', e); }
});

function bindFilters() {
    ['filterProject', 'filterProject2'].forEach(id =[KURUNG_TUTUP] document.getElementById(id)?.addEventListener('change', (e) =[KURUNG_TUTUP] { filterState.projectId = e.target.value; refreshDashboardData(); }));
    ['filterTeam', 'filterTeam2'].forEach(id =[KURUNG_TUTUP] document.getElementById(id)?.addEventListener('change', (e) =[KURUNG_TUTUP] { filterState.teamId = e.target.value; refreshDashboardData(); }));
}

async function loadProjectDropdown() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    projectCatalog = projs || [];
    ['filterProject', 'filterProject2'].forEach(id =[KURUNG_TUTUP] {
        const select = document.getElementById(id);
        if (projs && select) { select.innerHTML = '[KURUNG_BUKA]option value="all"[KURUNG_TUTUP]All Projects[KURUNG_BUKA]/option[KURUNG_TUTUP]'; projs.forEach(p =[KURUNG_TUTUP] select.innerHTML += `[KURUNG_BUKA]option value="\({p.id}"[KURUNG_TUTUP]\){p.project_name}[KURUNG_BUKA]/option[KURUNG_TUTUP]`); }
    });
}

function getDatesArray(s, e) {
    const dates = []; let curr = new Date(s), end = new Date(e);
    while (curr [KURUNG_BUKA]= end) { dates.push(curr.toLocaleDateString('en-CA')); curr.setDate(curr.getDate() + 1); }
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
    const employees = employeesResult.data || [], projectMap = new Map((projectCatalog || []).map(p =[KURUNG_TUTUP] [String(p.id), p]));
    const entries = (entriesResult.data || []).map(e =[KURUNG_TUTUP] ({ ...e, project: projectMap.get(String(e.project_id)) || null }));
    ['filterTeam', 'filterTeam2'].forEach(id =[KURUNG_TUTUP] {
        const select = document.getElementById(id);
        if (select && select.options.length [KURUNG_BUKA]= 1) employees.forEach(emp =[KURUNG_TUTUP] select.innerHTML += `[KURUNG_BUKA]option value="\({emp.id}"[KURUNG_TUTUP]\){formatCapitalize(emp.name || emp.email)}[KURUNG_BUKA]/option[KURUNG_TUTUP]`);
    });
    processKPI(entries); processBarChart(entries); processDonutAndRanking(entries); teamDataList = processTeamActivitiesData(entries, employees); renderPremiumDashboard(entries, employees); currentPage = 1; applySortingAndRender();
}

function processKPI(entries) {
    let totalSec = 0, projMap = {}, topP = '--', maxP = 0;
    (entries || []).forEach(e =[KURUNG_TUTUP] {
        if (e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0; totalSec += sec; const pName = e.project ? e.project.project_name : 'No Project'; projMap[pName] = (projMap[pName] || 0) + sec;
    });
    for (const [k, v] of Object.entries(projMap)) { if (v [KURUNG_TUTUP] maxP) { maxP = v; topP = k; } }
    const els = { kpiTotalTime: formatHMS(totalSec), kpiTopProject: topP, donutTotal: formatHMS(totalSec) };
    for (const [id, val] of Object.entries(els)) if (document.getElementById(id)) document.getElementById(id).textContent = val;
}

function processBarChart(entries) {
    const dateArr = getDatesArray(filterState.startDate, filterState.endDate), labels = dateArr.map(d =[KURUNG_TUTUP] new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), projDateMap = {};
    (entries || []).forEach(e =[KURUNG_TUTUP] {
        if (e.status !== 'STOPPED') return;
        const dStr = e.work_date || e.start_time.split('T')[0], pName = e.project ? e.project.project_name : 'No Project';
        if (!projDateMap[pName]) { projDateMap[pName] = {}; dateArr.forEach(d =[KURUNG_TUTUP] projDateMap[pName][d] = 0); }
        if (projDateMap[pName][dStr] !== undefined) projDateMap[pName][dStr] += (e.duration_seconds || 0);
    });
    const datasets = Object.keys(projDateMap).map(pName =[KURUNG_TUTUP] ({ label: pName, data: dateArr.map(d =[KURUNG_TUTUP] (projDateMap[pName][d] / 3600).toFixed(2)), backgroundColor: getProjectColor(pName), borderRadius: 4 }));
    const ctx = document.getElementById('stackedBarChart'); if (!ctx) return; if (chartBar) chartBar.destroy();
    chartBar = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, border: { display: false } } } } });
}

function processDonutAndRanking(entries) {
    const projMap = {}; let grandTotal = 0;
    (entries || []).forEach(e =[KURUNG_TUTUP] {
        if (e.status !== 'STOPPED') return; const sec = e.duration_seconds || 0, pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec; grandTotal += sec;
    });
    const sortedProjs = Object.entries(projMap).sort((a, b) =[KURUNG_TUTUP] b[1] - a[1]), legend = document.getElementById('projectDistributionLegend');
    if (legend) {
        legend.innerHTML = sortedProjs.slice(0, 7).map(([name, sec]) =[KURUNG_TUTUP] {
            const pct = grandTotal ? ((sec / grandTotal) * 100).toFixed(1) : '0.0';
            return `[KURUNG_BUKA]div class="flex items-center justify-between text-xs py-2 border-b border-gray-50 last:border-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-2.5 overflow-hidden"[KURUNG_TUTUP][KURUNG_BUKA]span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:\({getProjectColor(name)}"[KURUNG_TUTUP][KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-700 font-medium truncate"[KURUNG_TUTUP]\){formatCapitalize(name)}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-3 shrink-0"[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-600 w-10 text-right font-medium"[KURUNG_TUTUP]\({formatHMS(sec)}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-gray-400 w-10 text-right"[KURUNG_TUTUP]\){pct}%[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP]`;
        }).join('') || `[KURUNG_BUKA]div class="text-center text-gray-400 p-4"[KURUNG_TUTUP]No data[KURUNG_BUKA]/div[KURUNG_TUTUP]`;
    }
    const ctx = document.getElementById('donutChart'); if (!ctx) return; if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, { type: 'doughnut', data: { labels: sortedProjs.map(i =[KURUNG_TUTUP] i[0]), datasets: [{ data: sortedProjs.map(i =[KURUNG_TUTUP] (i[1] / 3600).toFixed(2)), backgroundColor: sortedProjs.map(i =[KURUNG_TUTUP] getProjectColor(i[0])), borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });
}

function renderPremiumDashboard(entries, employees) {
    const stopped = (entries || []).filter(e =[KURUNG_TUTUP] e.status === 'STOPPED'), projectTotals = {};
    stopped.forEach(e =[KURUNG_TUTUP] { const p = e.project?.project_name || 'No Project'; projectTotals[p] = (projectTotals[p] || 0) + (e.duration_seconds || 0); });
    const sortedProjects = Object.entries(projectTotals).sort((a, b) =[KURUNG_TUTUP] b[1] - a[1]), trackedProjectIds = new Set(stopped.map(e =[KURUNG_TUTUP] e.project_id).filter(Boolean));
    document.getElementById('kpiActiveProjects').textContent = String(trackedProjectIds.size); document.getElementById('kpiTeamMembers').textContent = String(Array.isArray(employees) ? employees.length : 0);
    const topProjects = document.getElementById('topProjectsList');
    if (topProjects) {
        const max = sortedProjects[0]?.[1] || 1, totalStopped = stopped.reduce((a, e) =[KURUNG_TUTUP] a + (e.duration_seconds || 0), 0), icons = ['folder', 'code', 'scissors', 'message-square', 'settings'];
        topProjects.innerHTML = sortedProjects.slice(0, 5).map((item, idx) =[KURUNG_TUTUP] {
            const [name, sec] = item, pct = Math.max(2, (sec / max) * 100), color = getProjectColor(name), share = totalStopped ? ((sec / totalStopped) * 100).toFixed(1) : '0.0', icon = icons[idx % icons.length];
            return `[KURUNG_BUKA]div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"[KURUNG_TUTUP][KURUNG_BUKA]span class="font-bold text-[11px] w-3 text-center" style="color:\({color}"[KURUNG_TUTUP]\){idx + 1}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]div class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm" style="background:\({color}"[KURUNG_TUTUP][KURUNG_BUKA]i data-lucide="\){icon}" class="w-4 h-4"[KURUNG_TUTUP][KURUNG_BUKA]/i[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex-1 min-w-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex justify-between items-end mb-1.5"[KURUNG_TUTUP][KURUNG_BUKA]strong class="text-slate-800 text-[11px] font-bold truncate uppercase pr-2 tracking-tight"[KURUNG_TUTUP]\({name}[KURUNG_BUKA]/strong[KURUNG_TUTUP][KURUNG_BUKA]div class="flex gap-2 text-[10px]"[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-600 font-semibold"[KURUNG_TUTUP]\){formatHMS(sec)}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-gray-400 w-8 text-right font-medium"[KURUNG_TUTUP]\({share}%[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"[KURUNG_TUTUP][KURUNG_BUKA]div class="h-full rounded-full" style="width:\){pct}%; background:${color}"[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP]`;
        }).join('') || `[KURUNG_BUKA]div class="text-center text-gray-400 py-4"[KURUNG_TUTUP]No data[KURUNG_BUKA]/div[KURUNG_TUTUP]`;
        setTimeout(() =[KURUNG_TUTUP] { if (window.lucide) window.lucide.createIcons(); }, 50);
    }
    const teamList = (teamDataList || []).slice().sort((a, b) =[KURUNG_TUTUP] b.totalSec - a.totalSec).slice(0, 5), teamPanel = document.getElementById('teamPerformanceList');
    if (teamPanel) {
        const maxTeam = teamList[0]?.totalSec || 1;
        teamPanel.innerHTML = teamList.map((m) =[KURUNG_TUTUP] {
            const pct = Math.max(2, (m.totalSec / maxTeam) * 100), color = getProjectColor(m.name);
            return `[KURUNG_BUKA]div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-sm" style="background:\({color}"[KURUNG_TUTUP]\){getInitials(m.name)}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex-1 min-w-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex justify-between items-end mb-1.5"[KURUNG_TUTUP][KURUNG_BUKA]strong class="text-slate-700 text-[11px] font-semibold truncate pr-2"[KURUNG_TUTUP]\({formatCapitalize(m.name)}[KURUNG_BUKA]/strong[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-600 text-[11px] font-semibold"[KURUNG_TUTUP]\){formatHMS(m.totalSec)}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"[KURUNG_TUTUP][KURUNG_BUKA]div class="h-full rounded-full" style="width:\({pct}%; background:\){color}"[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP]`;
        }).join('') || `[KURUNG_BUKA]div class="text-center text-gray-400 py-4"[KURUNG_TUTUP]No data[KURUNG_BUKA]/div[KURUNG_TUTUP]`;
    }
    const statusLegend = document.getElementById('projectStatusLegend'), totalCount = projectCatalog.length || sortedProjects.length, trackedCount = trackedProjectIds.size, noActivity = Math.max(0, totalCount - trackedCount);
    document.getElementById('projectStatusTotal').textContent = totalCount;
    if (statusLegend) {
        statusLegend.innerHTML = `[KURUNG_BUKA]div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-2"[KURUNG_TUTUP][KURUNG_BUKA]span class="w-2.5 h-2.5 rounded-full" style="background:#18cf6d"[KURUNG_TUTUP][KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-700 font-medium"[KURUNG_TUTUP]Tracked[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-3"[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-600 font-medium"[KURUNG_TUTUP]\({trackedCount}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-gray-400 w-8 text-right"[KURUNG_TUTUP]\){totalCount ? ((trackedCount/totalCount)*100).toFixed(1) : 0}%[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-2"[KURUNG_TUTUP][KURUNG_BUKA]span class="w-2.5 h-2.5 rounded-full" style="background:#f6a21a"[KURUNG_TUTUP][KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-700 font-medium"[KURUNG_TUTUP]No Activity[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-3"[KURUNG_TUTUP][KURUNG_BUKA]span class="text-slate-600 font-medium"[KURUNG_TUTUP]\({noActivity}[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]span class="text-gray-400 w-8 text-right"[KURUNG_TUTUP]\){totalCount ? ((noActivity/totalCount)*100).toFixed(1) : 0}%[KURUNG_BUKA]/span[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP]`;
    }
    const statusCanvas = document.getElementById('projectStatusChart');
    if (statusCanvas) {
        if (chartProjectStatus) chartProjectStatus.destroy();
        chartProjectStatus = new Chart(statusCanvas, { type: 'doughnut', data: { labels: ['Tracked', 'No Activity'], datasets: [{ data: [trackedCount, noActivity], backgroundColor: ['#18cf6d', '#f6a21a'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } } });
    }
}

function processTeamActivitiesData(entries, employees) {
    const teamMap = {}, todayStr = new Date().toLocaleDateString('en-CA');
    employees.forEach(emp =[KURUNG_TUTUP] { teamMap[emp.id] = { id: emp.id, name: emp.name || (emp.email ? emp.email.split('@')[0] : 'Unnamed'), email: emp.email || '', totalSec: 0, todaySec: 0, latest: null, isTracking: false, projects: {} }; });
    (entries || []).forEach(e =[KURUNG_TUTUP] {
        if (!e.employee_id) return;
        if (!teamMap[e.employee_id]) teamMap[e.employee_id] = { id: e.employee_id, name: 'ID: ' + String(e.employee_id).substring(0, 6), email: '', totalSec: 0, todaySec: 0, latest: null, isTracking: false, projects: {} };
        const dStr = e.work_date || e.start_time.split('T')[0], sec = e.duration_seconds || 0;
        if (e.status === 'IN_PROGRESS' || e.status === 'RUNNING') { teamMap[e.employee_id].isTracking = true; if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e; } 
        else { const pName = e.project ? e.project.project_name : 'No Project'; teamMap[e.employee_id].totalSec += sec; if (dStr === todayStr) teamMap[e.employee_id].todaySec += sec; teamMap[e.employee_id].projects[pName] = (teamMap[e.employee_id].projects[pName] || 0) + sec; if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e; }
    });
    return Object.values(teamMap);
}

function bindSortingControls() {
    document.querySelectorAll('.sortable-header').forEach(header =[KURUNG_TUTUP] {
        header.addEventListener('click', () =[KURUNG_TUTUP] {
            const column = header.getAttribute('data-sort');
            if (currentSort.column === column) { currentSort.isAsc = !currentSort.isAsc; } else { currentSort.column = column; currentSort.isAsc = true; }
            document.querySelectorAll('.sortable-header').forEach(h =[KURUNG_TUTUP] { h.classList.remove('text-blue-600'); h.innerHTML = h.innerHTML.replace(' ↑', '').replace(' ↓', ''); });
            header.classList.add('text-blue-600'); header.innerHTML += currentSort.isAsc ? ' ↑' : ' ↓'; applySortingAndRender();
        });
    });
}

function applySortingAndRender() {
    teamDataList.sort((a, b) =[KURUNG_TUTUP] {
        let valA, valB;
        if (currentSort.column === 'member') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); } else if (currentSort.column === 'tracked') { valA = a.totalSec; valB = b.totalSec; } else if (currentSort.column === 'activity') { valA = a.latest ? new Date(a.latest.start_time).getTime() : 0; valB = b.latest ? new Date(b.latest.start_time).getTime() : 0; }
        if (valA [KURUNG_BUKA] valB) return currentSort.isAsc ? -1 : 1; if (valA [KURUNG_TUTUP] valB) return currentSort.isAsc ? 1 : -1; return 0;
    });
    renderTeamActivities();
}

function bindPaginationControls() {
    const recordSelect = document.getElementById('recordsPerPage');
    if (recordSelect) recordSelect.addEventListener('change', (e) =[KURUNG_TUTUP] { recordsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value); currentPage = 1; renderTeamActivities(); });
    document.getElementById('btnPrev')?.addEventListener('click', () =[KURUNG_TUTUP] { if (currentPage [KURUNG_TUTUP] 1) { currentPage--; renderTeamActivities(); } });
    document.getElementById('btnNext')?.addEventListener('click', () =[KURUNG_TUTUP] { const maxPage = recordsPerPage === 'all' ? 1 : Math.ceil(teamDataList.length / recordsPerPage); if (currentPage [KURUNG_BUKA] maxPage) { currentPage++; renderTeamActivities(); } });
}

function getStatusAndBadge(member) {
    if (member.isTracking) return `[KURUNG_BUKA]span class="bg-blue-50 text-blue-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-blue-100"[KURUNG_TUTUP]In progress[KURUNG_BUKA]/span[KURUNG_TUTUP]`;
    if (!member.latest) return `[KURUNG_BUKA]span class="bg-gray-50 text-gray-500 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-gray-200"[KURUNG_TUTUP]No activity[KURUNG_BUKA]/span[KURUNG_TUTUP]`;
    const now = new Date(), past = new Date(member.latest.start_time), today = new Date(); today.setHours(0,0,0,0); const pastDay = new Date(past); pastDay.setHours(0,0,0,0);
    const diffDays = Math.floor((today - pastDay) / (1000 * 60 * 60 * 24)), diffHrs = Math.floor((now - past) / 3600000);
    if (diffDays === 0) return `[KURUNG_BUKA]span class="bg-emerald-50 text-emerald-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-emerald-100"[KURUNG_TUTUP]In a day[KURUNG_BUKA]/span[KURUNG_TUTUP]`;
    if (diffDays [KURUNG_TUTUP] 0 && diffDays [KURUNG_BUKA] 30) { let txt = diffHrs [KURUNG_BUKA] 24 ? `\({diffHrs} hours ago` : `\){diffDays} days ago`; return `[KURUNG_BUKA]span class="bg-amber-50 text-amber-600 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-amber-100"[KURUNG_TUTUP]${txt}[KURUNG_BUKA]/span[KURUNG_TUTUP]`; }
    return `[KURUNG_BUKA]span class="bg-gray-50 text-gray-500 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-gray-200"[KURUNG_TUTUP]No activity[KURUNG_BUKA]/span[KURUNG_TUTUP]`;
}

function renderTeamActivities() {
    const tbody = document.getElementById('teamActivitiesBody'); if (!tbody) return; tbody.innerHTML = '';
    const totalRecs = teamDataList.length; if (totalRecs === 0) { tbody.innerHTML = `[KURUNG_BUKA]tr[KURUNG_TUTUP][KURUNG_BUKA]td colspan="7" class="py-6 text-center text-gray-400"[KURUNG_TUTUP]No data found.[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]/tr[KURUNG_TUTUP]`; return; }
    let pagedData = teamDataList;
    if (recordsPerPage !== 'all') { const maxPage = Math.ceil(totalRecs / recordsPerPage); if (currentPage [KURUNG_TUTUP] maxPage) currentPage = maxPage; const startIndex = (currentPage - 1) * recordsPerPage; pagedData = teamDataList.slice(startIndex, startIndex + recordsPerPage); }
    pagedData.forEach((member, index) =[KURUNG_TUTUP] {
        const init = getInitials(member.name), actualIndex = (recordsPerPage !== 'all' ? (currentPage - 1) * recordsPerPage : 0) + index + 1;
        let taskName = 'No recent activity', projName = '-', projColor = 'transparent';
        if (member.latest) { taskName = member.latest.description || 'Untitled Task'; projName = member.latest.project ? member.latest.project.project_name : 'No Project'; projColor = getProjectColor(projName); }
        const badgeHtml = getStatusAndBadge(member); let currentTimerHtml = '-';
        if (member.isTracking) { currentTimerHtml = `${formatHMS(member.todaySec)} [KURUNG_BUKA]span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block ml-1 animate-pulse"[KURUNG_TUTUP][KURUNG_BUKA]/span[KURUNG_TUTUP]`; } else if (member.latest && member.todaySec [KURUNG_TUTUP] 0) { currentTimerHtml = formatHMS(member.todaySec); } else if (member.latest && badgeHtml.includes('hours ago')) { currentTimerHtml = formatHMS(member.latest.duration_seconds || 0); }
        let barSegments = '';
        for (const [pName, pSec] of Object.entries(member.projects)) { if (pSec [KURUNG_TUTUP] 0 && member.totalSec [KURUNG_TUTUP] 0) { const perc = (pSec / member.totalSec) * 100; barSegments += `[KURUNG_BUKA]div class="h-full" style="width: \({perc}%; background-color:\){getProjectColor(pName)};"[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP]`; } }
        let breakdownHtml = `[KURUNG_BUKA]div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex"[KURUNG_TUTUP]${barSegments}[KURUNG_BUKA]/div[KURUNG_TUTUP]`;
        tbody.innerHTML += `[KURUNG_BUKA]tr class="hover:bg-slate-50/80 transition-colors"[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3 text-center text-slate-800 font-semibold"[KURUNG_TUTUP]\({actualIndex}[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3"[KURUNG_TUTUP][KURUNG_BUKA]div class="flex items-center gap-3"[KURUNG_TUTUP][KURUNG_BUKA]div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm shrink-0" style="background:\){getProjectColor(member.name)};"[KURUNG_TUTUP]\({init}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="min-w-0"[KURUNG_TUTUP][KURUNG_BUKA]div class="font-semibold text-slate-800 text-[11px] truncate capitalize"[KURUNG_TUTUP]\){formatCapitalize(member.name)}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="text-gray-400 text-[10px] truncate"[KURUNG_TUTUP]\({member.email || '-'}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3"[KURUNG_TUTUP][KURUNG_BUKA]div class="font-semibold text-slate-800 text-[11px] mb-1 truncate max-w-[150px]"[KURUNG_TUTUP]\){taskName}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]div class="text-gray-500 text-[10px] flex items-center gap-1.5 truncate max-w-[150px]"[KURUNG_TUTUP]\({member.latest ? `[KURUNG_BUKA]span class="w-2 h-2 rounded-full shrink-0" style="background:\){projColor};"[KURUNG_TUTUP][KURUNG_BUKA]/span[KURUNG_TUTUP] \({formatCapitalize(projName)}` : '-'}[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3"[KURUNG_TUTUP]\){badgeHtml}[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3 text-center font-semibold text-slate-700"[KURUNG_TUTUP]\({currentTimerHtml}[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3 font-semibold text-slate-800"[KURUNG_TUTUP]\){formatHMS(member.totalSec)}[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3 min-w-[100px]"[KURUNG_TUTUP]\({breakdownHtml}[KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]td class="py-3 px-3 text-center relative"[KURUNG_TUTUP][KURUNG_BUKA]div class="action-dropdown inline-block"[KURUNG_TUTUP][KURUNG_BUKA]button class="action-dots-btn p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"[KURUNG_TUTUP][KURUNG_BUKA]svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"[KURUNG_TUTUP][KURUNG_BUKA]circle cx="12" cy="12" r="1"[KURUNG_TUTUP][KURUNG_BUKA]/circle[KURUNG_TUTUP][KURUNG_BUKA]circle cx="12" cy="5" r="1"[KURUNG_TUTUP][KURUNG_BUKA]/circle[KURUNG_TUTUP][KURUNG_BUKA]circle cx="12" cy="19" r="1"[KURUNG_TUTUP][KURUNG_BUKA]/circle[KURUNG_TUTUP][KURUNG_BUKA]/svg[KURUNG_TUTUP][KURUNG_BUKA]/button[KURUNG_TUTUP][KURUNG_BUKA]div class="action-menu-popup hidden absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-40 z-50 text-left overflow-hidden"[KURUNG_TUTUP][KURUNG_BUKA]div class="action-menu-item chase-btn px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2" data-empid="\){member.id}" data-empname="${formatCapitalize(member.name)}"[KURUNG_TUTUP]🔔 Send Reminder[KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/div[KURUNG_TUTUP][KURUNG_BUKA]/td[KURUNG_TUTUP][KURUNG_BUKA]/tr[KURUNG_TUTUP]`;
    });
}

document.addEventListener('click', async (e) =[KURUNG_TUTUP] {
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) { e.stopPropagation(); const popup = dotsBtn.nextElementSibling; document.querySelectorAll('.action-menu-popup').forEach(p =[KURUNG_TUTUP] { if (p !== popup) p.classList.add('hidden'); }); popup.classList.toggle('hidden'); return; }
    if (!e.target.closest('.action-dropdown')) document.querySelectorAll('.action-menu-popup').forEach(p =[KURUNG_TUTUP] p.classList.add('hidden'));
    const chaseBtn = e.target.closest('.chase-btn');
    if (chaseBtn) {
        const empId = chaseBtn.getAttribute('data-empid'), empName = chaseBtn.getAttribute('data-empname') || 'staf';
        if (chaseBtn.disabled) return; chaseBtn.disabled = true; const originalText = chaseBtn.innerHTML; chaseBtn.innerHTML = '⏳ Sending...';
        try { await supabase.from('notifications').insert([{ employee_id: empId, title: 'Timesheet Reminder', message: 'Please complete your timesheet record for today.', is_read: false }]); alert(`🔔 Reminder sent successfully to ${empName}!`); } 
        catch (err) { console.error(err); alert(`Reminder flagged for ${empName}.`); } 
        finally { chaseBtn.disabled = false; chaseBtn.innerHTML = originalText; const popup = chaseBtn.closest('.action-menu-popup'); if (popup) popup.classList.add('hidden'); }
    }
});

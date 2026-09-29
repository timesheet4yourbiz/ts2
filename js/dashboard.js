import { initNotificationBell } from './notifications.js';
import { supabase } from './supabase.js';

let filterState = { startDate: '', endDate: '', projectId: 'all', teamId: 'all' };
let chartBar = null, chartDonut = null, chartProjectStatus = null;
let projectCatalog = [];

// STATE UNTUK PAGINATION & SORTING
let teamDataList = [], currentPage = 1, recordsPerPage = 20;
let currentSort = { column: 'member', isAsc: true };

// UTILITI
const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];

function getProjectColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
}

function getInitials(nameOrEmail) {
    if (!nameOrEmail) return '?';
    const parts = nameOrEmail.split(/[\s.@]+/);
    let init = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
    return init;
}

function formatHMS(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `\({hrs}:\){String(mins).padStart(2, '0')}`;
}

function formatCapitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

// INIT DASHBOARD
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        let currentDashDate = new Date();
        const getDashWeekRange = (dateObj) => {
            const curr = new Date(dateObj);
            const day = curr.getDay();
            const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(curr.setDate(diff));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        };

        const updateDashDateDisplay = () => {
            const { start, end } = getDashWeekRange(currentDashDate);
            filterState.startDate = start.toLocaleDateString('en-CA');
            filterState.endDate = end.toLocaleDateString('en-CA');

            const dateTextEl = document.getElementById('dashDateRangeText');
            if (dateTextEl) {
                const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                dateTextEl.textContent = `\({startStr} -\){endStr}`;
            }
        };

        document.getElementById('prevDashBtn')?.addEventListener('click', async () => {
            currentDashDate.setDate(currentDashDate.getDate() - 7);
            updateDashDateDisplay();
            await refreshDashboardData();
        });

        document.getElementById('nextDashBtn')?.addEventListener('click', async () => {
            currentDashDate.setDate(currentDashDate.getDate() + 7);
            updateDashDateDisplay();
            await refreshDashboardData();
        });

        updateDashDateDisplay();
        bindFilters();
        bindPaginationControls();
        bindSortingControls();
        
        await loadProjectDropdown();
        await refreshDashboardData();
        
    } catch (error) {
        console.error('Dashboard Init Error:', error);
    }
});

// FILTERS
function bindFilters() {
    ['filterProject', 'filterProject2'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            filterState.projectId = e.target.value; 
            refreshDashboardData();
        });
    });

    ['filterTeam', 'filterTeam2'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            filterState.teamId = e.target.value; 
            refreshDashboardData();
        });
    });
}

async function loadProjectDropdown() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    projectCatalog = projs || [];
    ['filterProject', 'filterProject2'].forEach(id => {
        const select = document.getElementById(id);
        if (projs && select) {
            select.innerHTML = 'All Projects';
            projs.forEach(p => select.innerHTML += `${p.project_name}`);
        }
    });
}

function getDatesArray(startStr, endStr) {
    const dates = []; let curr = new Date(startStr); const end = new Date(endStr);
    while (curr <= end) {
        dates.push(curr.toLocaleDateString('en-CA'));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

// REFRESH DATA UTAMA
async function refreshDashboardData() {
    if (!filterState.startDate || !filterState.endDate) return;

    const startIso = new Date(`${filterState.startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${filterState.endDate}T23:59:59.999`).toISOString();

    let query = supabase.from('time_entries')
        .select(`id, duration_seconds, start_time, work_date, status, description, employee_id, project_id`)
        .gte('start_time', startIso).lte('start_time', endIso).order('start_time', { ascending: false });

    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);
    if (filterState.teamId !== 'all') query = query.eq('employee_id', filterState.teamId);

    const [entriesResult, employeesResult] = await Promise.all([
        query,
        supabase.from('employees').select('id, email, name').order('name')
    ]);

    if (entriesResult.error || employeesResult.error) return;

    const employees = employeesResult.data || [];
    const projectMap = new Map((projectCatalog || []).map(p => [String(p.id), p]));
    const entries = (entriesResult.data || []).map(e => ({ ...e, project: projectMap.get(String(e.project_id)) || null }));

    // Update Team Dropdowns dynamically
    ['filterTeam', 'filterTeam2'].forEach(id => {
        const teamSelect = document.getElementById(id);
        if (teamSelect && teamSelect.options.length <= 1) {
            employees.forEach(emp => {
                teamSelect.innerHTML += `${formatCapitalize(emp.name || emp.email)}`;
            });
        }
    });

    processKPI(entries);
    processBarChart(entries);
    processDonutAndRanking(entries);
    teamDataList = processTeamActivitiesData(entries, employees);
    renderPremiumDashboard(entries, employees);
    
    currentPage = 1;
    applySortingAndRender();
}

// KPI
function processKPI(entries) {
    let totalSec = 0; const projMap = {};
    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0;
        totalSec += sec;
        const pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec;
    });

    let topP = '--', maxP = 0;
    for (const [k, v] of Object.entries(projMap)) { if (v > maxP) { maxP = v; topP = k; } }

    const els = { kpiTotalTime: formatHMS(totalSec), kpiTopProject: topP, donutTotal: formatHMS(totalSec) };
    for (const [id, val] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}

// BAR CHART
function processBarChart(entries) {
    const dateArr = getDatesArray(filterState.startDate, filterState.endDate);
    const labels = dateArr.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const projDateMap = {};

    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return;
        const dStr = e.work_date || e.start_time.split('T')[0];
        const pName = e.project ? e.project.project_name : 'No Project';
        if (!projDateMap[pName]) { projDateMap[pName] = {}; dateArr.forEach(d => projDateMap[pName][d] = 0); }
        if (projDateMap[pName][dStr] !== undefined) projDateMap[pName][dStr] += (e.duration_seconds || 0);
    });

    const datasets = Object.keys(projDateMap).map(pName => {
        return {
            label: pName,
            data: dateArr.map(d => (projDateMap[pName][d] / 3600).toFixed(2)),
            backgroundColor: getProjectColor(pName),
            borderRadius: 4
        };
    });

    const ctx = document.getElementById('stackedBarChart');
    if (!ctx) return;
    if (chartBar) chartBar.destroy();
    chartBar = new Chart(ctx, {
        type: 'bar', data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, border: { display: false } } }
        }
    });
}

// DONUT + LEGEND
function processDonutAndRanking(entries) {
    const projMap = {}; let grandTotal = 0;
    (entries || []).forEach(e => {
        if (e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0;
        const pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec;
        grandTotal += sec;
    });

    const sortedProjs = Object.entries(projMap).sort((a, b) => b[1] - a[1]);
    
    // RENDER BEAUTIFUL PROJECT LEGEND 
    const legend = document.getElementById('projectDistributionLegend');
    if (legend) {
        legend.innerHTML = sortedProjs.slice(0, 7).map(([name, sec]) => {
            const pct = grandTotal ? ((sec / grandTotal) * 100).toFixed(1) : '0.0';
            return `

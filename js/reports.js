import { supabase } from './supabase.js';

const REPORT_STORAGE_KEY = 'worktime_reports_filter_v2';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { window.location.href = '../pages/login.html'; return; }

        setupStaticUI();
        await populateFilters(session);
        restoreSavedFilter();

        document.getElementById('btnGenerate')?.addEventListener('click', generateReport);
        document.getElementById('btnReset')?.addEventListener('click', resetFilter);
        document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
        document.getElementById('btnPdf')?.addEventListener('click', () => window.print());
        document.getElementById('btnExcel')?.addEventListener('click', exportCSV);
        document.getElementById('btnSaveTemplate')?.addEventListener('click', saveTemplate);
        document.getElementById('btnLoadSavedFilter')?.addEventListener('click', () => { restoreSavedFilter(true); });
        document.getElementById('reportMonth')?.addEventListener('change', syncTopDateRange);

        document.querySelectorAll('.report-type').forEach(card => {
            card.addEventListener('click', () => { selectReportType(card.dataset.reportType); });
        });

        await generateReport();
    } catch (err) {
        console.error('Reports Init Error:', err);
        showToast('Reports gagal dimulakan. Semak console untuk maklumat lanjut.', true);
    }
});

function setupStaticUI() {
    const monthInput = document.getElementById('reportMonth');
    if (monthInput && !monthInput.value) {
        const now = new Date();
        monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    syncTopDateRange();
}

async function populateFilters(session) {
    await populateProjects();
    await populateEmployees();
    await populateClientsIfAvailable();
    await populateProjectStatusesIfAvailable();

    const email = session?.user?.email || '';
    const metadata = session?.user?.user_metadata || {};
    const displayName = metadata.full_name || metadata.name || metadata.display_name || (email ? email.split('@')[0] : 'USER');
    const role = metadata.role || metadata.user_role || 'Administrator';

    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const avatarInitial = document.getElementById('avatarInitial');

    if (profileName) profileName.textContent = displayName.toUpperCase();
    if (profileRole) profileRole.textContent = role;
    if (avatarInitial) avatarInitial.textContent = displayName.trim().charAt(0).toUpperCase() || 'U';
}

async function populateProjects() {
    const select = document.getElementById('filterProject'); if (!select) return;
    try {
        const { data, error } = await supabase.from('projects').select('id, project_name').order('project_name');
        if (error) throw error;
        (data || []).forEach(project => {
            const option = document.createElement('option');
            option.value = project.id; option.textContent = project.project_name || 'Unnamed Project';
            select.appendChild(option);
        });
    } catch (error) { console.warn('Projects filter could not be loaded:', error); }
}

async function populateEmployees() {
    const select = document.getElementById('filterUser'); if (!select) return;
    try {
        const { data, error } = await supabase.from('employees').select('id, name, email').order('name');
        if (error) throw error;
        (data || []).forEach(employee => {
            const option = document.createElement('option'); option.value = employee.id;
            option.textContent = employee.name || employee.email?.split('@')[0] || 'Employee ' + employee.id;
            select.appendChild(option);
        });
    } catch (error) { console.warn('Employees filter could not be loaded:', error); }
}

async function populateClientsIfAvailable() {
    const select = document.getElementById('filterClient'); if (!select) return;
    try {
        const { data, error } = await supabase.from('clients').select('id, name').order('name');
        if (error) throw error;
        (data || []).forEach(client => {
            const option = document.createElement('option'); option.value = client.id;
            option.textContent = client.name || 'Client ' + client.id; select.appendChild(option);
        });
    } catch (error) { console.info('Clients filter is optional.'); }
}

async function populateProjectStatusesIfAvailable() {
    const select = document.getElementById('filterStatus'); if (!select) return;
    try {
        const { data, error } = await supabase.from('projects').select('status').not('status', 'is', null);
        if (error) throw error;
        const statuses = [...new Set((data || []).map(row => row.status).filter(Boolean))];
        statuses.forEach(status => {
            const option = document.createElement('option'); option.value = status;
            option.textContent = formatStatus(status); select.appendChild(option);
        });
    } catch (error) { console.info('Project status filter is optional.'); }
}

function selectReportType(type) {
    document.querySelectorAll('.report-type').forEach(card => {
        card.classList.toggle('active', card.dataset.reportType === type);
    });
    const reportType = document.getElementById('reportType');
    const map = { project: 'PROJECT_MANHOUR', historical: 'HISTORICAL', budget: 'BUDGET', team: 'TEAM', client: 'CLIENT', custom: 'CUSTOM' };
    if (reportType) reportType.value = map[type] || 'PROJECT_MANHOUR';
    if (type !== 'project') { showToast('Paparan UI sudah disediakan. Data engine yang dibekalkan sekarang ialah Project Man-Hour.'); return; }
    generateReport();
}

function getSelectedMonthYear() {
    const value = document.getElementById('reportMonth')?.value;
    if (value && /^\d{4}-\d{2}$/.test(value)) { const [year, month] = value.split('-').map(Number); return { year, month }; }
    const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getWeekDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
    return [
        { label: 'Week 1', start: 1, end: 7, text: '01 - 07 ' + monthName },
        { label: 'Week 2', start: 8, end: 14, text: '08 - 14 ' + monthName },
        { label: 'Week 3', start: 15, end: 21, text: '15 - 21 ' + monthName },
        { label: 'Week 4', start: 22, end: 28, text: '22 - 28 ' + monthName },
        { label: 'Week 5', start: 29, end: lastDay, text: lastDay >= 29 ? '29 - ' + lastDay + ' ' + monthName : 'N/A' }
    ];
}

async function generateReport() {
    const reportType = document.getElementById('reportType')?.value;
    if (reportType !== 'PROJECT_MANHOUR') { showToast('Report engine yang tersedia daripada source asal ialah Project Man-Hour.'); return; }
    
    const page = document.querySelector('.preview-panel'); page?.classList.add('loading');
    try {
        const { year, month } = getSelectedMonthYear();
        const selectedProject = document.getElementById('filterProject')?.value || 'ALL';
        const selectedUser = document.getElementById('filterUser')?.value || 'ALL';
        
        updateReportHeader(year, month);
        const weeks = getWeekDates(year, month); updateWeekHeaders(weeks);
        
        const lastDay = new Date(year, month, 0).getDate();
        const startDateIso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
        const endDateIso = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59)).toISOString();

        let query = supabase.from('time_entries').select('duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)').eq('status', 'STOPPED').gte('start_time', startDateIso).lte('start_time', endDateIso);
        
        if (selectedProject !== 'ALL') query = query.eq('project_id', selectedProject);
        if (selectedUser !== 'ALL') query = query.eq('employee_id', selectedUser);

        const { data: entries, error } = await query;
        if (error) throw error;

        const projectGroups = {};
        (entries || []).forEach(item => {
            const projectName = (item.project?.project_name || 'General Project').toUpperCase();
            if (!projectGroups[projectName]) { projectGroups[projectName] = { client: '-', w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 }; }
            
            const dateObj = new Date(item.work_date || item.start_time);
            const day = dateObj.getDate();
            const hours = (item.duration_seconds || 0) / 3600;

            if (day <= 7) projectGroups[projectName].w1 += hours;
            else if (day <= 14) projectGroups[projectName].w2 += hours;
            else if (day <= 21) projectGroups[projectName].w3 += hours;
            else if (day <= 28) projectGroups[projectName].w4 += hours;
            else projectGroups[projectName].w5 += hours;
            projectGroups[projectName].total += hours;
        });

        renderRows(projectGroups, weeks);
        saveCurrentFilterSilently();
    } catch (error) {
        console.error('Ralat Carian Laporan:', error);
        const tbody = document.getElementById('tableBodyProjects');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Unable to generate report. Please check your Supabase relationship and browser console.</td></tr>';
        showToast('Gagal menjana laporan. Semak console / Supabase relationship.', true);
    } finally {
        page?.classList.remove('loading');
    }
}

function renderRows(projectGroups, weeks) {
    const tbody = document.getElementById('tableBodyProjects'); if (!tbody) return;
    tbody.innerHTML = '';
    const weeklyTotals = [0, 0, 0, 0, 0]; let grandTotal = 0;
    const names = Object.keys(projectGroups).sort();

    if (!names.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No man-hour records found for this period / filter.</td></tr>';
        setTotals(weeklyTotals, grandTotal); return;
    }

    names.forEach((projectName, index) => {
        const row = projectGroups[projectName];
        weeklyTotals[0] += row.w1; weeklyTotals[1] += row.w2; weeklyTotals[2] += row.w3; weeklyTotals[3] += row.w4; weeklyTotals[4] += row.w5; grandTotal += row.total;
        const week5 = weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-';

        tbody.innerHTML += '<tr>' +
            '<td class="index">' + (index + 1) + '</td>' +
            '<td class="project-name">' + escapeHtml(projectName) + '</td>' +
            '<td class="client-name">' + escapeHtml(row.client || '-') + '</td>' +
            '<td>' + row.w1.toFixed(1) + '</td>' +
            '<td>' + row.w2.toFixed(1) + '</td>' +
            '<td>' + row.w3.toFixed(1) + '</td>' +
            '<td>' + row.w4.toFixed(1) + '</td>' +
            '<td>' + week5 + '</td>' +
            '<td class="total-col">' + row.total.toFixed(1) + '</td>' +
            '</tr>';
    });
    setTotals(weeklyTotals, grandTotal);
}

function setTotals(weeklyTotals, grandTotal) {
    for (let i = 0; i < 5; i++) { const element = document.getElementById('totW' + (i + 1)); if (element) element.textContent = weeklyTotals[i].toFixed(1); }
    const grand = document.getElementById('totGrand'); if (grand) grand.textContent = grandTotal.toFixed(1);
}

function updateReportHeader(year, month) {
    const date = new Date(year, month - 1, 1);
    const monthLong = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const monthShort = date.toLocaleString('en-US', { month: 'short' });
    const badge = document.getElementById('badgeMonthYear');
    if (badge) badge.innerHTML = monthLong + '<br>' + year;
    
    const subtitle = document.getElementById('previewSubtitle');
    if (subtitle) subtitle.textContent = 'Project Man-Hour Report - ' + monthLong.charAt(0) + monthLong.slice(1).toLowerCase() + ' ' + year;
    syncTopDateRange(year, month, monthShort);
}

function updateWeekHeaders(weeks) {
    weeks.forEach((week, index) => { const dateElement = document.getElementById('dtW' + (index + 1)); if (dateElement) dateElement.textContent = week.text; });
}

function syncTopDateRange(year, month, monthShort) {
    if (!year || !month) { const sel = getSelectedMonthYear(); year = sel.year; month = sel.month; }
    if (!monthShort) monthShort = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
    const lastDay = new Date(year, month, 0).getDate();
    const element = document.getElementById('topDateRange');
    if (element) element.textContent = monthShort + ' 01, ' + year + ' - ' + monthShort + ' ' + String(lastDay).padStart(2, '0') + ', ' + year;
}

function getFilterState() {
    return {
        reportType: document.getElementById('reportType')?.value || 'PROJECT_MANHOUR',
        reportPeriod: document.getElementById('reportPeriod')?.value || 'MONTHLY_WEEK',
        reportMonth: document.getElementById('reportMonth')?.value || '',
        groupBy: document.getElementById('groupBy')?.value || 'WEEK',
        project: document.getElementById('filterProject')?.value || 'ALL',
        client: document.getElementById('filterClient')?.value || 'ALL',
        user: document.getElementById('filterUser')?.value || 'ALL',
        status: document.getElementById('filterStatus')?.value || 'ALL'
    };
}

function applyFilterState(state) {
    if (!state) return;
    setValue('reportType', state.reportType); setValue('reportPeriod', state.reportPeriod); setValue('reportMonth', state.reportMonth);
    setValue('groupBy', state.groupBy); setValue('filterProject', state.project); setValue('filterClient', state.client);
    setValue('filterUser', state.user); setValue('filterStatus', state.status);
    syncReportCardFromSelect(); syncTopDateRange();
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) {
        const exists = [...element.options].some(option => option.value === value);
        if (exists || element.tagName !== 'SELECT') element.value = value;
    }
}

function saveCurrentFilterSilently() {
    try { localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(getFilterState())); } catch (error) { console.warn('Could not save report filter:', error); }
}

function saveTemplate() {
    try { localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(getFilterState())); showToast('Report filter template saved pada browser ini.'); } 
    catch (error) { showToast('Template tidak dapat disimpan.', true); }
}

function restoreSavedFilter(showMessage = false) {
    try {
        const raw = localStorage.getItem(REPORT_STORAGE_KEY);
        if (!raw) { if (showMessage) showToast('Tiada saved filter ditemui.'); return; }
        applyFilterState(JSON.parse(raw));
        if (showMessage) { showToast('Saved filter telah dimuatkan.'); generateReport(); }
    } catch (error) { console.warn('Could not restore report filter:', error); if (showMessage) showToast('Saved filter tidak dapat dimuatkan.', true); }
}

function resetFilter() {
    const { year, month } = getSelectedMonthYear();
    setValue('reportType', 'PROJECT_MANHOUR'); setValue('reportPeriod', 'MONTHLY_WEEK');
    setValue('reportMonth', year + '-' + String(month).padStart(2, '0'));
    setValue('groupBy', 'WEEK'); setValue('filterProject', 'ALL'); setValue('filterClient', 'ALL'); setValue('filterUser', 'ALL'); setValue('filterStatus', 'ALL');
    syncReportCardFromSelect(); syncTopDateRange(); generateReport();
}

function syncReportCardFromSelect() {
    const value = document.getElementById('reportType')?.value;
    const map = { PROJECT_MANHOUR: 'project', HISTORICAL: 'historical', BUDGET: 'budget', TEAM: 'team', CLIENT: 'client', CUSTOM: 'custom' };
    document.querySelectorAll('.report-type').forEach(card => { card.classList.toggle('active', card.dataset.reportType === map[value]); });
}

function exportCSV() {
    const table = document.getElementById('exportTable');
    if (!table) { showToast('Report table tidak ditemui.', true); return; }
    const rows = [...table.querySelectorAll('tr')];
    const csv = rows.map(row => {
        const cells = [...row.querySelectorAll('th, td')];
        return cells.map(cell => {
            const value = cell.innerText.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim().replace(/"/g, '""');
            return '"' + value + '"';
        }).join(',');
    }).join('\n');

    const { year, month } = getSelectedMonthYear();
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
    downloadBlob(csv, 'Project_ManHour_Report_' + monthName + '_' + year + '.csv', 'text/csv;charset=utf-8;');
    showToast('Report berjaya diexport sebagai CSV untuk Excel.');
}

function downloadBlob(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&').replaceAll('<', '<').replaceAll('>', '>').replaceAll('"', '"').replaceAll("'", '''); }
function formatStatus(status) { return String(status).replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()); }

function showToast(message, isError = false) {
    const toast = document.getElementById('toast'); if (!toast) return;
    toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.classList.remove('show'); }, 3200);
}


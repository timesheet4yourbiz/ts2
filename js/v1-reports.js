import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        // Set nama pengguna di penjuru kanan atas
        const profileName = document.getElementById('profileName');
        const avatarInitial = document.getElementById('avatarInitial');
        if (profileName) profileName.textContent = session.user.email.split('@')[0].toUpperCase();
        if (avatarInitial) avatarInitial.textContent = session.user.email.charAt(0).toUpperCase();

        await populateFilters();

        // Tetapkan bulan & tahun semasa secara automatik
        const rm = document.getElementById('reportMonth');
        if (rm) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            rm.value = now.getFullYear() + '-' + m;
        }

        document.getElementById('btnGenerate')?.addEventListener('click', generateReport);
        document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
        document.getElementById('btnExcel')?.addEventListener('click', exportCSV);

        // Jana laporan untuk kali pertama
        await generateReport();

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

async function populateFilters() {
    try {
        const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
        const projSelect = document.getElementById('filterProject');
        if (projs && projSelect) {
            projs.forEach(p => {
                projSelect.innerHTML += '<option value="' + p.id + '">' + p.project_name + '</option>';
            });
        }
    } catch (e) {}

    try {
        const { data: emps } = await supabase.from('employees').select('id, name, email').order('name');
        const userSelect = document.getElementById('filterUser');
        if (emps && userSelect) {
            emps.forEach(e => {
                const displayName = e.name || e.email.split('@')[0];
                userSelect.innerHTML += '<option value="' + e.id + '">' + displayName + '</option>';
            });
        }
    } catch (e) {}
}

function getWeekDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const mName = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
    return [
        { start: 1, end: 7, text: '01 - 07 ' + mName },
        { start: 8, end: 14, text: '08 - 14 ' + mName },
        { start: 15, end: 21, text: '15 - 21 ' + mName },
        { start: 22, end: 28, text: '22 - 28 ' + mName },
        { start: 29, end: lastDay, text: lastDay >= 29 ? '29 - ' + lastDay + ' ' + mName : 'N/A' }
    ];
}

async function generateReport() {
    const monthInput = document.getElementById('reportMonth').value;
    if (!monthInput) return;
    
    const year = parseInt(monthInput.split('-')[0]);
    const month = parseInt(monthInput.split('-')[1]);
    const selectedProject = document.getElementById('filterProject').value;
    const selectedUser = document.getElementById('filterUser').value;
    
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const badge = document.getElementById('badgeMonthYear');
    if (badge) badge.innerHTML = monthName + '<br>' + year;

    const weeks = getWeekDates(year, month);
    weeks.forEach((w, i) => {
        const el = document.getElementById('dtW' + (i+1));
        if (el) el.textContent = w.text || '-';
    });

    const lastDay = new Date(year, month, 0).getDate();
    const startDateIso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    const endDateIso = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59)).toISOString();

    let query = supabase
        .from('time_entries')
        .select('duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)')
        .eq('status', 'STOPPED')
        .gte('start_time', startDateIso)
        .lte('start_time', endDateIso);

    if (selectedProject !== 'ALL') query = query.eq('project_id', selectedProject);
    if (selectedUser !== 'ALL') query = query.eq('employee_id', selectedUser);

    const { data: entries, error } = await query;
    if (error) { console.error('Error:', error); return; }

    let projectGroups = {};
    if (entries && entries.length > 0) {
        entries.forEach(item => {
            const pName = (item.project ? item.project.project_name : 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            const dateObj = new Date(item.work_date || item.start_time);
            const day = dateObj.getDate();
            const hrs = (item.duration_seconds || 0) / 3600;
            
            if (day <= 7) projectGroups[pName].w1 += hrs;
            else if (day <= 14) projectGroups[pName].w2 += hrs;
            else if (day <= 21) projectGroups[pName].w3 += hrs;
            else if (day <= 28) projectGroups[pName].w4 += hrs;
            else projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    renderTable(projectGroups, weeks);
}

function renderTable(projectGroups, weeks) {
    const tbody = document.getElementById('tableBodyProjects');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let sumWeekly = [0, 0, 0, 0, 0];
    let grandTotal = 0;
    let idx = 1;

    if (Object.keys(projectGroups).length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No man-hour records found for this period.</td></tr>';
    } else {
        Object.keys(projectGroups).sort().forEach(pName => {
            const row = projectGroups[pName];
            sumWeekly[0] += row.w1; sumWeekly[1] += row.w2; sumWeekly[2] += row.w3;
            sumWeekly[3] += row.w4; sumWeekly[4] += row.w5; grandTotal += row.total;
            
            tbody.innerHTML += '<tr>' +
                '<td class="index">' + idx++ + '</td>' +
                '<td class="project-name">' + pName + '</td>' +
                '<td class="client-name">-</td>' +
                '<td>' + row.w1.toFixed(1) + '</td>' +
                '<td>' + row.w2.toFixed(1) + '</td>' +
                '<td>' + row.w3.toFixed(1) + '</td>' +
                '<td>' + row.w4.toFixed(1) + '</td>' +
                '<td>' + (weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-') + '</td>' +
                '<td class="total-col">' + row.total.toFixed(1) + '</td>' +
                '</tr>';
        });
    }

    for (let i = 0; i < 5; i++) {
        const el = document.getElementById('totW' + (i+1));
        if (el) el.textContent = sumWeekly[i].toFixed(1);
    }
    const tg = document.getElementById('totGrand');
    if (tg) tg.textContent = grandTotal.toFixed(1);
}

function exportCSV() {
    let csv = [];
    const rows = document.querySelectorAll("table#exportTable tr");
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ");
            row.push('"' + data + '"');
        }
        csv.push(row.join(","));
    }
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    downloadLink.download = "Project_ManHour_Report.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
}



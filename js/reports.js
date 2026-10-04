import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        // Profil header diuruskan oleh sidebar.js, kita fokus pada fungsionaliti Reports di sini.
        await populateFilters();

        const rm = document.getElementById('reportMonth');
        if (rm) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            rm.value = now.getFullYear() + '-' + m;
        }

        bindAllButtons(); 

        const previewPanel = document.querySelector('.preview-panel');
        if (previewPanel) previewPanel.style.display = 'none';

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

function bindAllButtons() {
    const reportCards = document.querySelectorAll('.report-type');
    const reportTypeSelect = document.getElementById('reportType');

    reportCards.forEach(card => {
        card.addEventListener('click', function() {
            reportCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            const typeMap = { 'project': 'PROJECT_MANHOUR', 'historical': 'HISTORICAL', 'budget': 'BUDGET', 'team': 'TEAM', 'client': 'CLIENT', 'custom': 'CUSTOM' };
            const clickedType = this.getAttribute('data-report-type');
            if (reportTypeSelect && typeMap[clickedType]) reportTypeSelect.value = typeMap[clickedType];
            
            const previewPanel = document.querySelector('.preview-panel');
            if (previewPanel) previewPanel.style.display = 'none';
        });
    });

    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', function() {
            const reverseMap = { 'PROJECT_MANHOUR': 'project', 'HISTORICAL': 'historical', 'BUDGET': 'budget', 'TEAM': 'team', 'CLIENT': 'client', 'CUSTOM': 'custom' };
            const mappedType = reverseMap[this.value];
            reportCards.forEach(c => {
                c.classList.remove('active');
                if (c.getAttribute('data-report-type') === mappedType) c.classList.add('active');
            });
            const previewPanel = document.querySelector('.preview-panel');
            if (previewPanel) previewPanel.style.display = 'none';
        });
    }

    document.getElementById('btnGenerate')?.addEventListener('click', generateReport);
    document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
    document.getElementById('btnExcel')?.addEventListener('click', exportCSV);
    
    document.getElementById('btnPdf')?.addEventListener('click', () => {
        alert('PDF Export: Sila pilih pilihan "Save as PDF" di tetingkap cetak (Print).');
        window.print(); 
    });
    
    document.getElementById('btnSaveTemplate')?.addEventListener('click', () => {
        alert('Template laporan berjaya disimpan!');
    });

    document.getElementById('btnLoadSavedFilter')?.addEventListener('click', () => {
        alert('Memuatkan senarai filter yang pernah disimpan...');
    });

    document.getElementById('btnReset')?.addEventListener('click', () => {
        if(reportTypeSelect) reportTypeSelect.value = 'PROJECT_MANHOUR';
        document.getElementById('reportPeriod').value = 'MONTHLY_WEEK';
        document.getElementById('filterProject').value = 'ALL';
        document.getElementById('filterClient').value = 'ALL';
        document.getElementById('filterUser').value = 'ALL';
        document.getElementById('filterStatus').value = 'ALL';
        
        const now = new Date();
        document.getElementById('reportMonth').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

        reportCards.forEach(c => c.classList.remove('active'));
        const firstCard = document.querySelector('.report-type[data-report-type="project"]');
        if(firstCard) firstCard.classList.add('active');

        const previewPanel = document.querySelector('.preview-panel');
        if (previewPanel) previewPanel.style.display = 'none';
    });
}

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

// LOGIK KUNCI (CLAMP) AKHIR & AWAL BULAN MENGIKUT KALENDAR SEBENAR
function getWeekDates(year, month) {
    let weeks = [];
    const formatFull = (dt) => {
        const mStr = dt.toLocaleString('en-US', {month:'short'});
        return String(dt.getDate()).padStart(2, '0') + ' - ' + mStr;
    };
    
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0); 
    
    // Cari hari Isnin pertama untuk minggu yang merangkumi 1hb
    let dayOfWeek = firstDayOfMonth.getDay(); 
    let diff = firstDayOfMonth.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    let currentMonday = new Date(year, month - 1, diff);

    for (let i = 0; i < 5; i++) {
        let start = new Date(currentMonday);
        start.setDate(start.getDate() + (i * 7));
        start.setHours(0, 0, 0, 0);

        let end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        // Berhenti jika minggu mula melangkaui bulan ini
        if (start > lastDayOfMonth) {
            weeks.push({ start: null, end: null, text: 'N/A' });
            continue;
        }

        // KUNCI PERMULAAN: Jangan tarik tarikh dari bulan lepas (Elak double count gaji)
        if (start < firstDayOfMonth) {
            start = new Date(firstDayOfMonth);
            start.setHours(0, 0, 0, 0);
        }

        // KUNCI PENGHUJUNG: Jangan tarik tarikh dari bulan hadapan
        if (end > lastDayOfMonth) {
            end = new Date(lastDayOfMonth);
            end.setHours(23, 59, 59, 999);
        }

        weeks.push({
            start: start,
            end: end,
            text: formatFull(start) + ' - ' + formatFull(end)
        });
    }
    
    while (weeks.length < 5) {
        weeks.push({ start: null, end: null, text: 'N/A' });
    }
    
    return weeks;
}

async function generateReport() {
    const monthInput = document.getElementById('reportMonth').value;
    if (!monthInput) return;
    
    const previewPanel = document.querySelector('.preview-panel');
    if (previewPanel) previewPanel.style.display = 'block';

    const reportType = document.getElementById('reportType').value;
    const selectEl = document.getElementById('reportType');
    const subtitle = document.getElementById('previewSubtitle');
    if (subtitle && selectEl) subtitle.textContent = selectEl.options[selectEl.selectedIndex].text + ' - Generated';

    if (reportType !== 'PROJECT_MANHOUR') {
        const tbody = document.getElementById('tableBodyProjects');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding:50px !important;"><strong style="font-size:14px; color:#1e293b;">Engine under development</strong><br>The engine for this specific report type will be available in the next phase.</td></tr>';
        return;
    }
    
    const btnGen = document.getElementById('btnGenerate');
    if (btnGen) { btnGen.disabled = true; btnGen.innerHTML = '⏳ Loading...'; }

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

    const validWeeks = weeks.filter(w => w.start !== null);
    if(validWeeks.length === 0) return;

    const sDt = validWeeks[0].start;
    const eDt = validWeeks[validWeeks.length - 1].end;
    const startStr = sDt.getFullYear() + '-' + String(sDt.getMonth()+1).padStart(2,'0') + '-' + String(sDt.getDate()).padStart(2,'0');
    const endStr = eDt.getFullYear() + '-' + String(eDt.getMonth()+1).padStart(2,'0') + '-' + String(eDt.getDate()).padStart(2,'0');

    let allEntries = [];
    let from = 0;
    const step = 999;
    let hasMore = true;

    while (hasMore) {
        let query = supabase
            .from('time_entries')
            .select('duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)')
            .eq('status', 'STOPPED')
            .gte('work_date', startStr)
            .lte('work_date', endStr)
            .range(from, from + step);

        if (selectedProject !== 'ALL') query = query.eq('project_id', selectedProject);
        if (selectedUser !== 'ALL') query = query.eq('employee_id', selectedUser);

        const { data, error } = await query;
        if (error) { console.error('Fetch Error:', error); break; }

        if (data && data.length > 0) {
            allEntries = allEntries.concat(data);
            if (data.length <= step) hasMore = false;
            else from += step + 1;
        } else {
            hasMore = false;
        }
    }

    let projectGroups = {};
    
    const w1S = weeks[0].start ? weeks[0].start.getTime() : 0; const w1E = weeks[0].end ? weeks[0].end.getTime() : 0;
    const w2S = weeks[1].start ? weeks[1].start.getTime() : 0; const w2E = weeks[1].end ? weeks[1].end.getTime() : 0;
    const w3S = weeks[2].start ? weeks[2].start.getTime() : 0; const w3E = weeks[2].end ? weeks[2].end.getTime() : 0;
    const w4S = weeks[3].start ? weeks[3].start.getTime() : 0; const w4E = weeks[3].end ? weeks[3].end.getTime() : 0;
    const w5S = weeks[4].start ? weeks[4].start.getTime() : 0; const w5E = weeks[4].end ? weeks[4].end.getTime() : 0;

    if (allEntries.length > 0) {
        allEntries.forEach(item => {
            const pName = (item.project ? item.project.project_name : 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            let dObj;
            if (item.work_date) {
                const pts = item.work_date.split('-');
                dObj = new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2]));
            } else {
                dObj = new Date(item.start_time);
            }
            dObj.setHours(0,0,0,0);

            const itemTime = dObj.getTime();
            const hrs = (item.duration_seconds || 0) / 3600;
            
            if (weeks[0].start && itemTime >= w1S && itemTime <= w1E) projectGroups[pName].w1 += hrs;
            else if (weeks[1].start && itemTime >= w2S && itemTime <= w2E) projectGroups[pName].w2 += hrs;
            else if (weeks[2].start && itemTime >= w3S && itemTime <= w3E) projectGroups[pName].w3 += hrs;
            else if (weeks[3].start && itemTime >= w4S && itemTime <= w4E) projectGroups[pName].w4 += hrs;
            else if (weeks[4].start && itemTime >= w5S && itemTime <= w5E) projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    renderTable(projectGroups, weeks);

    if (btnGen) { btnGen.disabled = false; btnGen.innerHTML = '▽  Generate Report'; }
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
                '<td>' + (weeks[3].text !== 'N/A' ? row.w4.toFixed(1) : '-') + '</td>' +
                '<td>' + (weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-') + '</td>' +
                '<td class="total-col">' + row.total.toFixed(1) + '</td>' +
                '</tr>';
        });
    }

    for (let i = 0; i < 5; i++) {
        const el = document.getElementById('totW' + (i+1));
        if (el) {
            if(weeks[i].text === 'N/A') el.textContent = '-';
            else el.textContent = sumWeekly[i].toFixed(1);
        }
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

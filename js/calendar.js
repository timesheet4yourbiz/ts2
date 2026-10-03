import { supabase } from './supabase.js';

let currentEmployeeId = null;
let isAdmin = false;
let currentDate = new Date(); 
let viewStart = new Date();
let viewEnd = new Date();
let weekDays = [];
let currentView = 'week'; // 'week' or 'month'

let employeesData = [];
let projectsData = [];
let tasksData = [];
let entriesData = [];

let activeEntryId = null;
const START_HOUR = 8; 
const END_HOUR = 19;  
const ROW_HEIGHT = 60; 

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const userEmail = session.user.email;
        const profileName = document.getElementById('profileName');
        const avatarInitial = document.getElementById('avatarInitial');
        if (profileName) profileName.textContent = userEmail.split('@')[0].toUpperCase();
        if (avatarInitial) avatarInitial.textContent = userEmail.charAt(0).toUpperCase();

        const { data: profile } = await supabase.from('employees').select('id, system_role').eq('email', userEmail).single();
        if (profile) {
            currentEmployeeId = profile.id;
            isAdmin = (profile.system_role === 'Admin' || profile.system_role === 'Manager');
            const profileRole = document.getElementById('profileRole');
            if(profileRole) profileRole.textContent = profile.system_role === 'Admin' ? 'Administrator' : profile.system_role;
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));
        }

        if (!isAdmin) {
            const formEmpContainer = document.getElementById('formEmpContainer');
            if(formEmpContainer) formEmpContainer.style.display = 'none';
        }

        await loadDropdowns();
        calculateDateRange();
        await fetchEntries();

        const btnPrevNav = document.getElementById('btnPrevNav');
        const btnNextNav = document.getElementById('btnNextNav');
        const btnToday = document.getElementById('btnToday');
        const filterEmp = document.getElementById('filterEmp');
        const filterProj = document.getElementById('filterProj');

        if (btnPrevNav) btnPrevNav.addEventListener('click', () => { 
            if(currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
            else currentDate.setMonth(currentDate.getMonth() - 1);
            calculateDateRange(); fetchEntries(); 
        });
        
        if (btnNextNav) btnNextNav.addEventListener('click', () => { 
            if(currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
            else currentDate.setMonth(currentDate.getMonth() + 1);
            calculateDateRange(); fetchEntries(); 
        });
        
        if (btnToday) btnToday.addEventListener('click', () => { 
            currentDate = new Date(); calculateDateRange(); fetchEntries(); 
        });
        
        if (filterEmp) filterEmp.addEventListener('change', fetchEntries);
        if (filterProj) filterProj.addEventListener('change', fetchEntries);

        // Binding Toggles
        const btnViewWeek = document.getElementById('btnViewWeek');
        const btnViewMonth = document.getElementById('btnViewMonth');
        
        if(btnViewWeek) btnViewWeek.addEventListener('click', () => {
            currentView = 'week';
            btnViewWeek.className = 'view-btn active';
            if(btnViewMonth) btnViewMonth.className = 'view-btn inactive';
            calculateDateRange(); fetchEntries();
        });
        
        if(btnViewMonth) btnViewMonth.addEventListener('click', () => {
            currentView = 'month';
            btnViewMonth.className = 'view-btn active';
            if(btnViewWeek) btnViewWeek.className = 'view-btn inactive';
            calculateDateRange(); fetchEntries();
        });

        setupModal();
        setInterval(updateCurrentTimeLine, 60000);

    } catch (err) {
        console.error("Calendar Init Error:", err);
    }
});

function calculateDateRange() {
    const formatFull = (d) => d.getDate() + ' ' + d.toLocaleString('en-US', {month:'short'}) + ' ' + d.getFullYear();
    
    if (currentView === 'week') {
        const curr = new Date(currentDate);
        const dayOfWeek = curr.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        viewStart = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + diffToMonday);
        viewStart.setHours(0, 0, 0, 0);
        
        viewEnd = new Date(viewStart);
        viewEnd.setDate(viewStart.getDate() + 6);
        viewEnd.setHours(23, 59, 59, 999);

        weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(viewStart);
            d.setDate(viewStart.getDate() + i);
            weekDays.push(d);
        }

        const dStr = viewStart.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' - ' + viewEnd.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
        const currentPeriodText = document.getElementById('currentPeriodText');
        if(currentPeriodText) currentPeriodText.textContent = dStr;
        
    } else {
        // Logik Paparan Bulan (Mengikut Isnin / Sama macam reports.js)
        const curr = new Date(currentDate);
        const year = curr.getFullYear();
        const month = curr.getMonth() + 1;
        
        let weeks = [];
        for (let day = 1; day <= 31; day++) {
            let d = new Date(year, month - 1, day);
            if (d.getMonth() !== month - 1) break; 
            
            if (d.getDay() === 1) { // 1 = Isnin
                let start = new Date(d);
                start.setHours(0,0,0,0);
                
                let end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23,59,59,999);
                
                weeks.push({ start: start, end: end });
            }
        }
        
        if(weeks.length > 0) {
            viewStart = weeks[0].start;
            viewEnd = weeks[weeks.length - 1].end;
            
            weekDays = [];
            let tempD = new Date(viewStart);
            while(tempD <= viewEnd) {
                weekDays.push(new Date(tempD));
                tempD.setDate(tempD.getDate() + 1);
            }
            
            const currentPeriodText = document.getElementById('currentPeriodText');
            if(currentPeriodText) currentPeriodText.textContent = formatFull(viewStart) + ' - ' + formatFull(viewEnd);
        }
    }
}

function renderCalendarHeaders() {
    const header = document.getElementById('calHeader');
    if(!header) return;
    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    if (currentView === 'week') {
        header.style.gridTemplateColumns = '60px repeat(7, 1fr)';
        let html = '<div class="cal-header-cell flex items-center justify-center text-[10px]">GMT+8</div>';
        const todayStr = new Date().toDateString();

        weekDays.forEach((d, i) => {
            const isToday = d.toDateString() === todayStr;
            const cls = isToday ? 'cal-header-cell today' : 'cal-header-cell';
            html += '<div class="' + cls + '">' + daysArr[i] + 
                    '<span class="cal-header-date">' + d.getDate() + '</span></div>';
        });
        header.innerHTML = html;
        
    } else {
        header.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
        let html = '';
        daysArr.forEach(d => {
            html += '<div class="cal-header-cell flex items-center justify-center bg-slate-100 py-3">' + d + '</div>';
        });
        header.innerHTML = html;
    }
}

async function loadDropdowns() {
    const [{ data: emps }, { data: projs }, { data: tasks }] = await Promise.all([
        supabase.from('employees').select('id, name, email').order('name'),
        supabase.from('projects').select('id, project_name').order('project_name'),
        supabase.from('tasks').select('id, project_id, task_name')
    ]);

    employeesData = emps || [];
    projectsData = projs || [];
    tasksData = tasks || [];

    const fEmp = document.getElementById('filterEmp');
    const fProj = document.getElementById('filterProj');
    const modEmp = document.getElementById('formEmp');
    const modProj = document.getElementById('formProj');

    if(fEmp) employeesData.forEach(e => fEmp.innerHTML += '<option value="' + e.id + '">' + (e.name || e.email) + '</option>');
    if(modEmp) employeesData.forEach(e => modEmp.innerHTML += '<option value="' + e.id + '">' + (e.name || e.email) + '</option>');
    if(modEmp && !isAdmin) modEmp.value = currentEmployeeId;

    if(fProj) projectsData.forEach(p => fProj.innerHTML += '<option value="' + p.id + '">' + p.project_name + '</option>');
    if(modProj) {
        modProj.innerHTML = '<option value="">- Select Project -</option>';
        projectsData.forEach(p => modProj.innerHTML += '<option value="' + p.id + '">' + p.project_name + '</option>');
    }

    if(modProj) {
        modProj.addEventListener('change', (e) => {
            const pid = e.target.value;
            const tSel = document.getElementById('formTask');
            if(!tSel) return;
            tSel.innerHTML = '<option value="">No Task</option>';
            if(pid) {
                const pTasks = tasksData.filter(t => t.project_id === pid);
                pTasks.forEach(t => tSel.innerHTML += '<option value="' + t.id + '">' + t.task_name + '</option>');
            }
        });
    }
}

async function fetchEntries() {
    const startIso = new Date(Date.UTC(viewStart.getFullYear(), viewStart.getMonth(), viewStart.getDate(), 0,0,0)).toISOString();
    const endIso = new Date(Date.UTC(viewEnd.getFullYear(), viewEnd.getMonth(), viewEnd.getDate(), 23,59,59)).toISOString();

    const fEmp = document.getElementById('filterEmp');
    const fProj = document.getElementById('filterProj');
    const empFilter = fEmp ? fEmp.value : null;
    const projFilter = fProj ? fProj.value : null;

    let query = supabase.from('time_entries')
        .select('*, project:projects(project_name), task:tasks(task_name), employee:employees(name)')
        .eq('status', 'STOPPED')
        .gte('start_time', startIso)
        .lte('start_time', endIso);

    if (empFilter) query = query.eq('employee_id', empFilter);
    else if (!isAdmin) query = query.eq('employee_id', currentEmployeeId);
    
    if (projFilter) query = query.eq('project_id', projFilter);

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching entries:", error);
        return;
    }

    entriesData = data || [];
    renderCalendarHeaders();
    renderGridAndEvents();
    updateKPIs();
}

const colors = [
    { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' }, 
    { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' }, 
    { bg: '#fdf4ff', border: '#d946ef', text: '#701a75' }, 
    { bg: '#fffbeb', border: '#f59e0b', text: '#78350f' }, 
    { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d' }
];

function renderGridAndEvents() {
    const gridArea = document.getElementById('calGridArea');
    const timeCol = document.getElementById('calTimeCol');
    const calBody = document.getElementById('calBody');
    if(!gridArea || !timeCol || !calBody) return;
    
    if (currentView === 'week') {
        calBody.style.display = 'grid';
        calBody.style.gridTemplateColumns = '60px 1fr';
        timeCol.style.display = 'flex';
        
        let timeHtml = '';
        for(let i = START_HOUR; i <= END_HOUR; i++) {
            const h = i.toString().padStart(2, '0') + ':00';
            timeHtml += '<div class="cal-time-slot">' + h + '</div>';
        }
        timeCol.innerHTML = timeHtml;

        gridArea.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
        gridArea.style.gridAutoRows = 'auto';
        gridArea.style.backgroundImage = 'linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)';
        
        let html = '';
        for(let i = 0; i < 7; i++) {
            const dStr = weekDays[i].getFullYear() + '-' + String(weekDays[i].getMonth()+1).padStart(2,'0') + '-' + String(weekDays[i].getDate()).padStart(2,'0');
            html += '<div class="cal-day-col" data-date="' + dStr + '"></div>';
        }
        
        html += '<div id="currentTimeLine" class="current-time-line" style="display: none;"></div>';
        gridArea.innerHTML = html;

        entriesData.forEach(entry => {
            let entryDate;
            if(entry.work_date) {
                const pts = entry.work_date.split('-');
                entryDate = new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2]));
            } else {
                entryDate = new Date(entry.start_time);
            }

            const dStr = entryDate.getFullYear() + '-' + String(entryDate.getMonth()+1).padStart(2,'0') + '-' + String(entryDate.getDate()).padStart(2,'0');
            const col = gridArea.querySelector('.cal-day-col[data-date="' + dStr + '"]');
            
            if (col) {
                let startDt = new Date(entry.start_time);
                let startH = startDt.getHours() + (startDt.getMinutes() / 60);
                
                if(startDt.getUTCHours() === 0 && startDt.getUTCMinutes() === 0 && startDt.getUTCSeconds() === 0) {
                    startH = 9.0; 
                }
                
                const durHrs = (entry.duration_seconds || 3600) / 3600;
                let topPx = (startH - START_HOUR) * ROW_HEIGHT;
                let heightPx = durHrs * ROW_HEIGHT;
                
                if (topPx < 0) { heightPx += topPx; topPx = 0; }
                if (topPx + heightPx > (END_HOUR - START_HOUR + 1) * ROW_HEIGHT) {
                    heightPx = ((END_HOUR - START_HOUR + 1) * ROW_HEIGHT) - topPx;
                }

                if (heightPx > 5) {
                    const colorObj = colors[entry.project_id ? (entry.project_id.charCodeAt(0) % colors.length) : 0];
                    const pName = entry.project ? entry.project.project_name : 'No Project';
                    const tName = entry.task ? entry.task.task_name : '';
                    const eName = entry.employee ? entry.employee.name : '';
                    
                    const titleHtml = isAdmin ? '[' + eName.split(' ')[0] + '] ' + pName : pName;
                    const hMins = Math.floor(durHrs) + 'h ' + Math.round((durHrs % 1) * 60) + 'm';

                    const evDiv = document.createElement('div');
                    evDiv.className = 'cal-event';
                    evDiv.style.top = topPx + 'px';
                    evDiv.style.height = heightPx + 'px';
                    evDiv.style.backgroundColor = colorObj.bg;
                    evDiv.style.borderColor = colorObj.border;
                    evDiv.style.color = colorObj.text;
                    
                    evDiv.innerHTML = '<div class="cal-event-title">' + titleHtml + '</div>' +
                                      '<div class="cal-event-time">' + tName + '</div>' +
                                      '<div class="cal-event-time" style="margin-top:2px;">⏱ ' + hMins + '</div>';

                    evDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEntryModal(entry);
                    });

                    col.appendChild(evDiv);
                }
            }
        });

        gridArea.querySelectorAll('.cal-day-col').forEach(col => {
            col.addEventListener('click', (e) => {
                if(e.target === col) {
                    const rect = col.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const clickHrs = START_HOUR + (clickY / ROW_HEIGHT);
                    const clickH = Math.floor(clickHrs);
                    const clickM = Math.floor((clickHrs % 1) * 60);
                    
                    const dateStr = col.getAttribute('data-date');
                    openEntryModal(null, dateStr, clickH, clickM);
                }
            });
        });

        updateCurrentTimeLine();

    } else {
        // VIEW MONTH
        calBody.style.display = 'block';
        timeCol.style.display = 'none';

        let html = '';
        weekDays.forEach(d => {
            const dStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const isToday = d.toDateString() === new Date().toDateString();
            const bgCls = isToday ? 'bg-blue-50/50' : 'bg-white';
            const txtCls = isToday ? 'text-blue-600 font-extrabold' : 'text-slate-400 font-bold';
            
            html += '<div class="month-day-cell ' + bgCls + ' border border-gray-100 p-2 flex flex-col gap-1 cursor-pointer hover:bg-slate-50 transition-colors min-h-[120px]" data-date="' + dStr + '">';
            html += '<div class="text-right text-[11px] mb-1 ' + txtCls + '">' + d.getDate() + ' ' + d.toLocaleString('en-US', {month:'short'}) + '</div>';
            html += '<div class="month-events-container flex flex-col gap-1"></div>';
            html += '</div>';
        });
        
        gridArea.innerHTML = html;
        gridArea.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
        gridArea.style.gridAutoRows = 'minmax(120px, auto)';
        gridArea.style.backgroundImage = 'none';

        entriesData.forEach(entry => {
            let entryDate;
            if(entry.work_date) {
                const pts = entry.work_date.split('-');
                entryDate = new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2]));
            } else {
                entryDate = new Date(entry.start_time);
            }

            const dStr = entryDate.getFullYear() + '-' + String(entryDate.getMonth()+1).padStart(2,'0') + '-' + String(entryDate.getDate()).padStart(2,'0');
            const container = gridArea.querySelector('.month-day-cell[data-date="' + dStr + '"] .month-events-container');
            
            if (container) {
                const durHrs = (entry.duration_seconds || 3600) / 3600;
                const hMins = Math.floor(durHrs) + 'h ' + Math.round((durHrs % 1) * 60) + 'm';
                const colorObj = colors[entry.project_id ? (entry.project_id.charCodeAt(0) % colors.length) : 0];
                const pName = entry.project ? entry.project.project_name : 'No Project';
                const eName = entry.employee ? entry.employee.name : '';
                const titleStr = isAdmin ? '[' + eName.split(' ')[0] + '] ' + pName : pName;
                
                const evDiv = document.createElement('div');
                evDiv.className = 'text-[9px] p-1.5 rounded border-l-[3px] shadow-sm font-semibold truncate';
                evDiv.style.backgroundColor = colorObj.bg;
                evDiv.style.borderColor = colorObj.border;
                evDiv.style.color = colorObj.text;
                evDiv.textContent = titleStr + ' (' + hMins + ')';
                
                evDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEntryModal(entry);
                });
                
                container.appendChild(evDiv);
            }
        });

        gridArea.querySelectorAll('.month-day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.getAttribute('data-date');
                openEntryModal(null, dateStr, 9, 0);
            });
        });
    }
}

function updateCurrentTimeLine() {
    if (currentView !== 'week') return;
    const line = document.getElementById('currentTimeLine');
    if (!line) return;

    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    
    const col = document.querySelector('.cal-day-col[data-date="' + todayStr + '"]');
    
    if (col && now.getHours() >= START_HOUR && now.getHours() <= END_HOUR) {
        line.style.display = 'block';
        const topPx = ((now.getHours() + (now.getMinutes() / 60)) - START_HOUR) * ROW_HEIGHT;
        line.style.top = topPx + 'px';
        col.appendChild(line); 
    } else {
        line.style.display = 'none';
    }
}

function updateKPIs() {
    let totalSecs = 0;
    let projSet = new Set();
    
    entriesData.forEach(e => {
        totalSecs += (e.duration_seconds || 0);
        if(e.project_id) projSet.add(e.project_id);
    });

    const h = Math.floor(totalSecs / 3600);
    const m = Math.round((totalSecs % 3600) / 60);

    const kpiHours = document.getElementById('kpiHours');
    if(kpiHours) kpiHours.textContent = h + 'h ' + m + 'm';
    
    const kpiProjects = document.getElementById('kpiProjects');
    if(kpiProjects) kpiProjects.textContent = projSet.size;
    
    const kpiEntries = document.getElementById('kpiEntries');
    if(kpiEntries) kpiEntries.textContent = entriesData.length;
    
    const kpiStaff = document.getElementById('kpiStaff');
    if(kpiStaff) {
        if(isAdmin) {
            let empSet = new Set();
            entriesData.forEach(e => { if(e.employee_id) empSet.add(e.employee_id); });
            kpiStaff.textContent = empSet.size;
        } else {
            kpiStaff.textContent = '1';
        }
    }
}

function setupModal() {
    const modal = document.getElementById('entryModal');
    const form = document.getElementById('entryForm');
    
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const openAddBtn = document.getElementById('openAddModalBtn');

    if(closeBtn) closeBtn.addEventListener('click', () => { if(modal) modal.style.display = 'none'; });
    if(cancelBtn) cancelBtn.addEventListener('click', () => { if(modal) modal.style.display = 'none'; });
    if(openAddBtn) openAddBtn.addEventListener('click', () => openEntryModal(null));

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveEntry');
            if(btnSave) { btnSave.disabled = true; btnSave.textContent = 'Saving...'; }

            const dStr = document.getElementById('formDate').value;
            const sTime = document.getElementById('formStart').value;
            const eTime = document.getElementById('formEnd').value;
            
            const empId = isAdmin ? document.getElementById('formEmp').value : currentEmployeeId;
            const projId = document.getElementById('formProj').value;
            const taskInput = document.getElementById('formTask');
            const taskId = taskInput ? (taskInput.value || null) : null;
            const notesInput = document.getElementById('formNotes');
            const notes = notesInput ? notesInput.value : '';

            const sDate = new Date(dStr + 'T' + sTime + ':00');
            const eDate = new Date(dStr + 'T' + eTime + ':00');
            let diffSecs = (eDate.getTime() - sDate.getTime()) / 1000;
            if(diffSecs < 0) diffSecs = 0;

            const payload = {
                employee_id: empId,
                project_id: projId,
                task_id: taskId,
                work_date: dStr,
                start_time: sDate.toISOString(),
                duration_seconds: diffSecs,
                notes: notes,
                status: 'STOPPED'
            };

            try {
                if (activeEntryId) {
                    await supabase.from('time_entries').update(payload).eq('id', activeEntryId);
                } else {
                    await supabase.from('time_entries').insert([payload]);
                }
                if(modal) modal.style.display = 'none';
                fetchEntries();
            } catch (err) { alert('Error: ' + err.message); }
            
            if(btnSave) { btnSave.disabled = false; btnSave.textContent = 'Save Entry'; }
        });
    }

    const delBtn = document.getElementById('btnDeleteEntry');
    if(delBtn) {
        delBtn.addEventListener('click', async () => {
            if(!confirm('Padam rekod masa ini?')) return;
            try {
                await supabase.from('time_entries').delete().eq('id', activeEntryId);
                if(modal) modal.style.display = 'none';
                fetchEntries();
            } catch(err) { alert('Gagal: ' + err.message); }
        });
    }
}

function openEntryModal(entry = null, defDate = null, defH = 9, defM = 0) {
    const modal = document.getElementById('entryModal');
    const form = document.getElementById('entryForm');
    const title = document.getElementById('modalTitle');
    const delBtn = document.getElementById('btnDeleteEntry');
    
    if(form) form.reset();
    
    if (entry) {
        activeEntryId = entry.id;
        if(title) title.textContent = 'Edit Time Entry';
        if(delBtn) delBtn.style.display = 'block';

        let dObj = entry.work_date ? new Date(entry.work_date) : new Date(entry.start_time);
        const formDate = document.getElementById('formDate');
        if(formDate) formDate.value = dObj.getFullYear() + '-' + String(dObj.getMonth()+1).padStart(2,'0') + '-' + String(dObj.getDate()).padStart(2,'0');
        
        const sDt = new Date(entry.start_time);
        const formStart = document.getElementById('formStart');
        if(formStart) formStart.value = String(sDt.getHours()).padStart(2,'0') + ':' + String(sDt.getMinutes()).padStart(2,'0');
        
        const eDt = new Date(sDt.getTime() + (entry.duration_seconds * 1000));
        const formEnd = document.getElementById('formEnd');
        if(formEnd) formEnd.value = String(eDt.getHours()).padStart(2,'0') + ':' + String(eDt.getMinutes()).padStart(2,'0');

        const formEmp = document.getElementById('formEmp');
        if(isAdmin && formEmp) formEmp.value = entry.employee_id;
        
        const formProj = document.getElementById('formProj');
        if(formProj) formProj.value = entry.project_id;
        
        const tSel = document.getElementById('formTask');
        if(tSel) {
            tSel.innerHTML = '<option value="">No Task</option>';
            if(entry.project_id) {
                const pTasks = tasksData.filter(t => t.project_id === entry.project_id);
                pTasks.forEach(t => tSel.innerHTML += '<option value="' + t.id + '">' + t.task_name + '</option>');
            }
            tSel.value = entry.task_id || '';
        }
        
        const formNotes = document.getElementById('formNotes');
        if(formNotes) formNotes.value = entry.notes || '';

    } else {
        activeEntryId = null;
        if(title) title.textContent = 'Add Time Entry';
        if(delBtn) delBtn.style.display = 'none';
        
        const formDate = document.getElementById('formDate');
        if (defDate && formDate) {
            formDate.value = defDate;
        } else if (formDate) {
            const n = new Date();
            formDate.value = n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
        }

        const formStart = document.getElementById('formStart');
        if(formStart) formStart.value = String(defH).padStart(2,'0') + ':' + String(defM).padStart(2,'0');
        
        const formEnd = document.getElementById('formEnd');
        if(formEnd) formEnd.value = String(defH+1).padStart(2,'0') + ':' + String(defM).padStart(2,'0');
        
        const formEmp = document.getElementById('formEmp');
        if(isAdmin && formEmp) formEmp.value = currentEmployeeId;
    }

    if(modal) modal.style.display = 'flex';
}

import { supabase } from './supabase.js';

let currentEmployeeId = null;
let currentDate = new Date(); 
let tagsDataList = []; 
let tasksDataList = []; // Menyimpan senarai Task
let myChartBar = null;
let myChartDonut = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return window.location.href = '../pages/login.html';
        
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial) avatarInitial.textContent = session.user.email.charAt(0).toUpperCase();

        // 1. Tarik Senarai Tag
        try {
            const { data: tagsData } = await supabase.from('tags').select('*').order('tag_name');
            tagsDataList = tagsData || [];
        } catch(e) {}

        // 2. Tarik Senarai Task
        try {
            const { data: tasksData } = await supabase.from('tasks').select('*').order('task_name');
            tasksDataList = tasksData || [];
        } catch(e) {}

        const { data: empData } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        
        if (empData) {
            currentEmployeeId = empData.id;
            buildPopup();
            renderHeader();
            await loadData();
        } else {
            document.getElementById('timesheetTableBody').innerHTML = '<tr><td colspan="14" class="text-center text-red-500 py-6 font-bold">Akses Ditolak: Emel tidak didaftarkan sebagai pekerja sah.</td></tr>';
        }

        document.getElementById('prevWeekBtn')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 7); renderHeader(); loadData(); });
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 7); renderHeader(); loadData(); });
        document.getElementById('addNewRowBtn')?.addEventListener('click', togglePopup);

        // --- ENJIN DROPDOWN COPY LAST WEEK ---
        const copyBtn = document.getElementById('copyLastWeekBtn');
        const copyMenu = document.getElementById('copyLastWeekMenu');
        if (copyBtn && copyMenu) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!copyBtn.contains(e.target) && !copyMenu.contains(e.target)) copyMenu.classList.add('hidden');
            });
            document.getElementById('btnCopyActivitiesOnly')?.addEventListener('click', async () => {
                copyMenu.classList.add('hidden'); await executeCopyLastWeek(false);
            });
            document.getElementById('btnCopyActivitiesAndTime')?.addEventListener('click', async () => {
                copyMenu.classList.add('hidden'); await executeCopyLastWeek(true);
            });
        }

    } catch (error) { console.error(error); }
});

const getWeekRange = (dateObj) => {
    const curr = new Date(dateObj);
    let dayOfWeek = curr.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const start = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return { start: days[0], end: days[6], days };
};

const formatHMS = (sec) => {
    if (!sec || sec <= 0) return '0:00';
    return Math.floor(sec / 3600) + ':' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
};

const parseTime = (val) => {
    if (!val) return 0;
    let hrs = 0, mins = 0;
    if (val.includes(':')) { const p = val.split(':'); hrs = parseInt(p[0])||0; mins = parseInt(p[1])||0; } 
    else if (val.includes('.')) { const v = parseFloat(val); hrs = Math.floor(v); mins = Math.round((v - hrs) * 60); } 
    else { hrs = parseInt(val)||0; }
    return (hrs * 3600) + (mins * 60);
};

const renderHeader = () => {
    const { start, end, days } = getWeekRange(currentDate);
    const dStr = start.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' - ' + end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    ['filterDateRange', 'tableDateRange'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = dStr;
    });
    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((d, i) => {
        const th = document.getElementById('th' + daysArr[i]);
        if (th) th.textContent = d.toLocaleDateString('en-US', {month:'short', day:'numeric'}).toUpperCase();
    });
};

let popup;
const buildPopup = () => {
    popup = document.createElement('div');
    popup.id = 'projPicker';
    popup.style.display = 'none'; popup.style.position = 'absolute'; popup.style.background = 'white';
    popup.style.border = '1px solid #cbd5e1'; popup.style.borderRadius = '8px'; popup.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
    popup.style.width = '300px'; popup.style.zIndex = '9999';
    document.body.appendChild(popup);
    document.addEventListener('click', (e) => { if (popup.style.display === 'block' && !popup.contains(e.target) && !e.target.closest('#addNewRowBtn')) popup.style.display = 'none'; });
};

const togglePopup = async (e) => {
    if (popup.style.display === 'block') { popup.style.display = 'none'; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px'; popup.style.left = (rect.left + window.scrollX - 100) + 'px';
    popup.style.display = 'block';
    popup.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm font-semibold">Memuatkan projek...</div>';
    
    const { data: projs } = await supabase.from('projects').select('*').order('project_name');
    let html = '<div class="max-h-64 overflow-y-auto">';
    if (projs && projs.length > 0) {
        projs.forEach(p => {
            html += '<div class="p-3 hover:bg-blue-50 border-b border-gray-100 cursor-pointer text-sm font-bold text-slate-700 flex items-center gap-2 pick-proj" data-id="' + p.id + '">📁 ' + p.project_name + '</div>';
        });
    } else { html += '<div class="p-4 text-center text-sm text-gray-400 font-semibold">Tiada projek ditemui.</div>'; }
    popup.innerHTML = html + '</div>';

    document.querySelectorAll('.pick-proj').forEach(item => {
        item.addEventListener('click', async (e) => {
            const pid = e.currentTarget.getAttribute('data-id');
            const { days } = getWeekRange(currentDate);
            const dStr = days[0].getFullYear() + '-' + String(days[0].getMonth()+1).padStart(2,'0') + '-' + String(days[0].getDate()).padStart(2,'0');
            await saveEntry(dStr, pid, null, 0, true);
            popup.style.display = 'none';
            loadData();
        });
    });
};

const saveEntry = async (dateStr, pid, taskId, sec, isInit = false, tagId = null, remark = null) => {
    let query = supabase.from('time_entries').select('id').eq('employee_id', currentEmployeeId).eq('work_date', dateStr);
    if (pid) query = query.eq('project_id', pid); else query = query.is('project_id', null);
    
    const { data: ext } = await query;
    const exists = ext && ext.length > 0;

    if (isInit && exists) return;
    if (!isInit && sec === 0) { if (exists) await supabase.from('time_entries').delete().in('id', ext.map(e=>e.id)); return; }

    const payload = { duration_seconds: sec, tag_id: tagId, task_id: taskId, notes: remark };
    if (exists) {
        await supabase.from('time_entries').update(payload).eq('id', ext[0].id);
    } else {
        await supabase.from('time_entries').insert([{
            employee_id: currentEmployeeId, project_id: pid, work_date: dateStr, start_time: dateStr + 'T09:00:00',
            duration_seconds: sec, tag_id: tagId, task_id: taskId, notes: remark, status: 'STOPPED'
        }]);
    }
};

const loadData = async () => {
    const tbody = document.getElementById('timesheetTableBody');
    tbody.innerHTML = '<tr><td colspan="14" class="text-center py-6 text-gray-400 font-semibold">Loading...</td></tr>';

    const { start, end, days } = getWeekRange(currentDate);
    const sIso = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0,0,0)).toISOString();
    const eIso = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23,59,59)).toISOString();

    const { data } = await supabase.from('time_entries').select('*, project:projects(project_name)').eq('employee_id', currentEmployeeId).eq('status', 'STOPPED').gte('start_time', sIso).lte('start_time', eIso);

    const matrix = {}; let gTotal = 0; let dTotal = [0,0,0,0,0,0,0]; let activeDays = new Set();
    const projColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    let colorIdx = 0;

    (data || []).forEach(e => {
        const pid = e.project_id || 'null';
        const pName = e.project ? e.project.project_name : 'General';
        let dObj = e.work_date ? new Date(e.work_date) : new Date(e.start_time);
        const dStr = dObj.getFullYear() + '-' + String(dObj.getMonth()+1).padStart(2,'0') + '-' + String(dObj.getDate()).padStart(2,'0');
        
        if (!matrix[pid]) {
            matrix[pid] = { name: pName, pid: pid, tag: e.tag_id||'', task: e.task_id||'', note: e.notes||'', arr: {}, color: projColors[colorIdx % projColors.length] };
            colorIdx++;
            days.forEach(d => matrix[pid].arr[d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')] = 0);
        } else {
            if (!matrix[pid].tag && e.tag_id) matrix[pid].tag = e.tag_id;
            if (!matrix[pid].task && e.task_id) matrix[pid].task = e.task_id;
            if (!matrix[pid].note && e.notes) matrix[pid].note = e.notes;
        }
        if (matrix[pid].arr[dStr] !== undefined) {
            matrix[pid].arr[dStr] += (e.duration_seconds || 0);
            if(e.duration_seconds > 0) activeDays.add(dStr);
        }
    });

    let html = ''; let idx = 1; let chartLabels = []; let chartData = [];
    Object.values(matrix).forEach(row => {
        let rTotal = 0;
        
        let tagOpts = '<option value="">- Tag -</option>';
        tagsDataList.forEach(t => { tagOpts += '<option value="' + t.id + '" ' + (row.tag==t.id?'selected':'') + '>' + (t.tag_name || t.name) + '</option>'; });

        let taskOpts = '<option value="">- Task -</option>';
        tasksDataList.forEach(tsk => { 
            if (tsk.project_id === row.pid) {
                taskOpts += '<option value="' + tsk.id + '" ' + (row.task==tsk.id?'selected':'') + '>' + tsk.task_name + '</option>';
            }
        });

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="text-center text-xs font-bold text-gray-500 border-r border-gray-100">' + (idx++) + '</td>' +
            '<td class="font-extrabold text-[11px] text-slate-800 uppercase tracking-tight"><span class="inline-block w-2.5 h-2.5 rounded-full mr-2 shadow-sm" style="background:'+row.color+'"></span>' + row.name + '</td>' +
            '<td><select class="ts-input font-semibold text-slate-700 bind-task" data-pid="'+row.pid+'">' + taskOpts + '</select></td>' +
            '<td><select class="ts-input font-semibold text-slate-700 bind-tag" data-pid="'+row.pid+'">' + tagOpts + '</select></td>' +
            '<td><input type="text" class="ts-input text-slate-700 font-medium bind-note" data-pid="'+row.pid+'" value="'+row.note+'" placeholder="Remarks..."></td>';

        days.forEach((d, i) => {
            const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const sec = row.arr[k]; rTotal += sec; dTotal[i] += sec;
            const val = sec > 0 ? formatHMS(sec) : '0:00';
            const zc = sec > 0 ? 'font-bold text-blue-700 bg-blue-50' : 'zero font-medium';
            html += '<td><input type="text" class="ts-input bind-time '+zc+'" data-d="'+k+'" data-pid="'+row.pid+'" value="'+val+'"></td>';
        });

        gTotal += rTotal;
        chartLabels.push(row.name); chartData.push((rTotal/3600).toFixed(2));

        html += '<td class="text-center font-black text-blue-700 border-l border-blue-100 bg-blue-50/30">' + formatHMS(rTotal) + '</td>' +
            '<td class="text-center"><button class="text-gray-400 hover:text-red-500 font-bold transition-colors bind-del" data-pid="'+row.pid+'" title="Padam Baris">🗑️</button></td></tr>';
    });

    if(html === '') html = '<tr><td colspan="14" class="text-center py-10 text-gray-400 font-semibold bg-gray-50/50">Tiada entri minggu ini. Sila klik butang <span class="text-blue-600">+ ADD ROW</span></td></tr>';
    tbody.innerHTML = html;

    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    daysArr.forEach((d, i) => { const tf = document.getElementById('tf'+d); if(tf) tf.textContent = dTotal[i]>0 ? formatHMS(dTotal[i]) : '0:00'; });
    const tfTotal = document.getElementById('tfTotal'); if(tfTotal) tfTotal.textContent = formatHMS(gTotal);

    document.getElementById('kpiTotalHrs').textContent = formatHMS(gTotal);
    document.getElementById('kpiProjects').textContent = Object.keys(matrix).length;
    document.getElementById('kpiTasks').textContent = '-';
    document.getElementById('kpiDays').textContent = activeDays.size + ' / 7';

    updateCharts(chartLabels, chartData, Object.values(matrix));

    // Event Listener untuk Time Input
    document.querySelectorAll('.bind-time').forEach(inp => {
        inp.addEventListener('focus', function(){ this.dataset.old = this.value; if(this.value==='0:00')this.value=''; });
        inp.addEventListener('blur', function(){ if(this.value.trim()==='') this.value='0:00'; });
        inp.addEventListener('change', async function(){
            let v = this.value.trim()||'0:00'; if(!v.includes(':')&&!v.includes('.')) v+=':00';
            const sec = parseTime(v); this.value = sec>0 ? formatHMS(sec) : '0:00';
            if(this.value === this.dataset.old) return;
            
            const tr = this.closest('tr');
            const tag = tr.querySelector('.bind-tag').value;
            const task = tr.querySelector('.bind-task').value;
            const note = tr.querySelector('.bind-note').value;
            
            this.style.opacity = '0.5';
            await saveEntry(this.dataset.d, this.dataset.pid==='null'?null:this.dataset.pid, task, sec, false, tag, note);
            loadData();
        });
    });

    // Event Listener untuk Task, Tag & Note
    document.querySelectorAll('.bind-task, .bind-tag, .bind-note').forEach(inp => {
        inp.addEventListener('change', async function() {
            const tr = this.closest('tr');
            const pid = this.dataset.pid;
            const tag = tr.querySelector('.bind-tag').value;
            const task = tr.querySelector('.bind-task').value;
            const note = tr.querySelector('.bind-note').value;
            
            const { days } = getWeekRange(currentDate);
            const sStr = days[0].getFullYear() + '-' + String(days[0].getMonth()+1).padStart(2,'0') + '-' + String(days[0].getDate()).padStart(2,'0');
            const eStr = days[6].getFullYear() + '-' + String(days[6].getMonth()+1).padStart(2,'0') + '-' + String(days[6].getDate()).padStart(2,'0');
            
            this.style.opacity = '0.5';
            let q = supabase.from('time_entries').update({tag_id:tag, task_id:task, notes:note}).eq('employee_id', currentEmployeeId).gte('work_date', sStr).lte('work_date', eStr);
            if(pid==='null') q=q.is('project_id', null); else q=q.eq('project_id', pid);
            await q;
            this.style.opacity = '1';
        });
    });

    document.querySelectorAll('.bind-del').forEach(btn => {
        btn.addEventListener('click', async function(){
            if(!confirm("Anda pasti mahu memadam keseluruhan baris rekod masa untuk projek ini?")) return;
            const pid = this.dataset.pid;
            const { days } = getWeekRange(currentDate);
            const sStr = days[0].getFullYear() + '-' + String(days[0].getMonth()+1).padStart(2,'0') + '-' + String(days[0].getDate()).padStart(2,'0');
            const eStr = days[6].getFullYear() + '-' + String(days[6].getMonth()+1).padStart(2,'0') + '-' + String(days[6].getDate()).padStart(2,'0');
            
            let q = supabase.from('time_entries').delete().eq('employee_id', currentEmployeeId).gte('work_date', sStr).lte('work_date', eStr);
            if(pid==='null') q=q.is('project_id', null); else q=q.eq('project_id', pid);
            await q; loadData();
        });
    });
};

const updateCharts = (labels, data, matrixVals) => {
    const ctxBar = document.getElementById('barChart');
    const ctxDonut = document.getElementById('donutChart');
    if(!ctxBar || !ctxDonut) return;
    if(myChartBar) myChartBar.destroy();
    if(myChartDonut) myChartDonut.destroy();

    const colors = matrixVals.map(m => m.color);

    myChartBar = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Hours', data: data, backgroundColor: colors, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    myChartDonut = new Chart(ctxDonut, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } } } }
    });
};

// --- FUNGSI COPY LAST WEEK KE DATABASE ---
const executeCopyLastWeek = async (includeTime) => {
    const copyBtn = document.getElementById('copyLastWeekBtn');
    const originalHtml = copyBtn.innerHTML;
    if(copyBtn) copyBtn.innerHTML = '⏳ Copying...';
    
    try {
        const lwDate = new Date(currentDate);
        lwDate.setDate(lwDate.getDate() - 7);
        const { start: lwStart, end: lwEnd } = getWeekRange(lwDate);
        const { days: cwDays } = getWeekRange(currentDate);

        const sIso = new Date(Date.UTC(lwStart.getFullYear(), lwStart.getMonth(), lwStart.getDate(), 0,0,0)).toISOString();
        const eIso = new Date(Date.UTC(lwEnd.getFullYear(), lwEnd.getMonth(), lwEnd.getDate(), 23,59,59)).toISOString();

        const { data: lwData, error } = await supabase.from('time_entries')
            .select('*').eq('employee_id', currentEmployeeId).eq('status', 'STOPPED').gte('start_time', sIso).lte('start_time', eIso);

        if (error) throw error;
        if (!lwData || lwData.length === 0) {
            alert('Tiada rekod pada minggu lepas untuk disalin.');
            if(copyBtn) copyBtn.innerHTML = originalHtml;
            return;
        }

        const matrix = {};
        lwData.forEach(entry => {
            const pid = entry.project_id || 'null';
            let dObj = entry.work_date ? new Date(entry.work_date) : new Date(entry.start_time);
            let dayIndex = dObj.getDay() - 1;
            if (dayIndex === -1) dayIndex = 6;

            if (!matrix[pid]) matrix[pid] = { pid: entry.project_id, tag: entry.tag_id, task: entry.task_id, note: entry.notes, dailyData: [0,0,0,0,0,0,0] };
            if (includeTime) matrix[pid].dailyData[dayIndex] += (entry.duration_seconds || 0);
        });

        for (const key in matrix) {
            const row = matrix[key];
            const cD0 = cwDays[0];
            const cD0Str = cD0.getFullYear() + '-' + String(cD0.getMonth()+1).padStart(2,'0') + '-' + String(cD0.getDate()).padStart(2,'0');
            
            await saveEntry(cD0Str, row.pid, row.task, 0, true, row.tag, row.note);
            
            if (includeTime) {
                for (let i = 0; i < 7; i++) {
                    const sec = row.dailyData[i];
                    if (sec > 0) {
                        const trg = cwDays[i];
                        const targetDateStr = trg.getFullYear() + '-' + String(trg.getMonth()+1).padStart(2,'0') + '-' + String(trg.getDate()).padStart(2,'0');
                        await saveEntry(targetDateStr, row.pid, row.task, sec, false, row.tag, row.note);
                    }
                }
            }
        }
        await loadData();
    } catch (err) { alert("Gagal menyalin: " + err.message); }
    
    if(copyBtn) copyBtn.innerHTML = originalHtml;
};

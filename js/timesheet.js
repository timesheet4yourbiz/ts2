import { supabase } from './supabase.js';

let currentEmployeeId = null;
let currentDate = new Date(); 
let tagsDataList = []; 
let tasksDataList = []; 
let myChartBar = null;
let myChartDonut = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return window.location.href = '../pages/login.html';

        // --- MAINTENANCE MODE START ---
    //    const adminEmails = ['timesheet4yourbiz@gmail.com']; // Tambah email bos yang lain jika ada
        
   //     if (!adminEmails.includes(session.user.email)) {
   //         document.body.innerHTML = `
    //            <div style="display:flex; height:100vh; width:100%; justify-content:center; align-items:center; background-color:#f8fafc; font-family: 'Inter', sans-serif; text-align:center; padding: 20px;">
     //               <div>
       //                 <svg style="width:64px; height:64px; color:#f59e0b; margin: 0 auto 20px auto;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
           //             <h1 style="color:#0f172a; font-size:1.8rem; font-weight:800; margin-bottom:12px;">System Under Maintenance</h1>
          //              <p style="color:#64748b; font-size:1rem; max-width: 450px; margin: 0 auto 20px auto; line-height: 1.6;">
              //              We are currently upgrading our database to serve you better. The timesheet system is temporarily unavailable for updates. 
             //               <br><br>Please check back shortly. We apologize for any inconvenience.
           //             </p>
          //          </div>
          //      </div>
       //     `;
  //          return; // Ini penting untuk stop sistem dari load jadual timesheet
//        }
        // --- MAINTENANCE MODE END ---
        
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial) avatarInitial.textContent = session.user.email.charAt(0).toUpperCase();

        try {
            const { data: tagsData } = await supabase.from('tags').select('*').order('tag_name');
            tagsDataList = tagsData || [];
        } catch(e) {}

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
            const tb = document.getElementById('timesheetTableBody');
            if(tb) tb.innerHTML = '<tr><td colspan="13" class="text-center text-red-500 py-6 font-bold">Access Denied: Email is not registered as a valid employee.</td></tr>';
        }

        document.getElementById('prevWeekBtn')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 7); renderHeader(); loadData(); });
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 7); renderHeader(); loadData(); });

        const copyBtn = document.getElementById('copyLastWeekBtn');
        const copyMenu = document.getElementById('copyLastWeekMenu');
        if (copyBtn && copyMenu) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyMenu.style.display = copyMenu.style.display === 'block' ? 'none' : 'block';
            });
            document.addEventListener('click', (e) => {
                if (!copyBtn.contains(e.target) && !copyMenu.contains(e.target)) copyMenu.style.display = 'none';
            });
            document.getElementById('btnCopyActivitiesOnly')?.addEventListener('click', async () => {
                copyMenu.style.display = 'none'; await executeCopyLastWeek(false);
            });
            document.getElementById('btnCopyActivitiesAndTime')?.addEventListener('click', async () => {
                copyMenu.style.display = 'none'; await executeCopyLastWeek(true);
            });
        }

        const btnClearAll = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear all'));
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => {
                if (confirm("WARNING: Are you sure you want to clear all time records in this table? This action does not delete projects, it only resets the hours to zero.")) {
                    const inputs = document.querySelectorAll('.ts-input.bind-time');
                    inputs.forEach(input => {
                        input.value = '0:00';
                        input.classList.add('zero');
                        input.classList.remove('font-bold', 'text-blue-700', 'bg-blue-50');
                    });
                    alert("Table hours have been cleared. Please modify any cell to trigger auto-save.");
                }
            });
        }

        const toggleWeekends = document.querySelector('.toggle-switch');
        if (toggleWeekends) {
            toggleWeekends.addEventListener('click', (e) => {
                e.preventDefault(); 
                toggleWeekends.classList.toggle('active');
                
                const isShowing = toggleWeekends.classList.contains('active');
                
                const satCol = 10; 
                const sunCol = 11;

                const styleId = 'weekendToggleStyles';
                let styleEl = document.getElementById(styleId);
                
                if (!isShowing) {
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = styleId;
                        document.head.appendChild(styleEl);
                    }
                    styleEl.innerHTML = `
                        th:nth-child(\({satCol}), td:nth-child(\){satCol}),
                        th:nth-child(\({sunCol}), td:nth-child(\){sunCol}) {
                            display: none !important;
                        }
                    `;
                } else {
                    if (styleEl) styleEl.remove();
                }
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
    ['filterDateRange', 'tableDateRange', 'weekDateRangeTop', 'weekDateRange'].forEach(id => {
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
    popup.id = 'projectPickerPopup';
    popup.style.display = 'none'; 
    popup.style.position = 'absolute'; 
    popup.style.background = 'white';
    popup.style.border = '1px solid #cbd5e1'; 
    popup.style.borderRadius = '4px'; 
    popup.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    popup.style.width = '320px'; 
    popup.style.zIndex = '9999'; 
    popup.style.textAlign = 'left';
    document.body.appendChild(popup);

    document.addEventListener('click', (e) => { 
        if (popup.style.display === 'block' && !popup.contains(e.target) && !e.target.closest('#openPickerBtn')) {
            popup.style.display = 'none'; 
        }
    });
};

const togglePopup = async (e) => {
    if (popup.style.display === 'block') { popup.style.display = 'none'; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 5) + 'px'; 
    popup.style.left = (rect.left + window.scrollX) + 'px';
    popup.style.display = 'block';
    popup.innerHTML = '<div style="padding:15px; color:#64748b; font-size:0.85rem; text-align:center;">Loading list...</div>';
    
    const { data: projs } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
    
    let pLen = projs ? projs.length : 0;
    let pList = '<div style="padding: 10px; border-bottom: 1px solid #e2e8f0;">' +
        '<input id="tsProjectSearch" type="text" placeholder="🔍 Search Project or Client" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:4px; outline:none; box-sizing:border-box; font-size:0.85rem;">' +
        '</div>' +
        '<div style="padding: 10px 15px; font-size: 0.7rem; color: #a0aec0; text-transform: uppercase; font-weight: 600; display: flex; justify-content: space-between; background: #f8fafc;">' +
        '<span>NO CLIENT</span>' +
        '<span>' + pLen + ' PROJECTS ⌄</span>' +
        '</div>' +
        '<div style="max-height: 250px; overflow-y: auto;">';
    
    if (projs && projs.length > 0) {
        projs.forEach(p => {
            const tList = tasksDataList ? tasksDataList.filter(t => t.project_id === p.id) : [];
            const hasTasks = tList.length > 0;
            const txtTsk = hasTasks ? tList.length + ' Tasks ⌄' : 'Select';
            
            pList += '<div class="proj-header" data-id="' + p.id + '" data-hastasks="' + hasTasks + '" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom: 1px solid #f1f5f9; cursor:pointer;">' +
                    '<span class="proj-title-text" style="color:#475569; font-size:0.85rem; display:flex; align-items:center; gap:8px; font-weight:600;">' +
                        '<span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%;"></span>' +
                        p.project_name.toUpperCase() +
                    '</span>' +
                    '<span style="color:#0ea5e9; font-size:0.75rem; font-weight:600;">' + txtTsk + '</span>' +
                '</div>';

            if (hasTasks) {
                pList += '<div class="tasks-container" id="tasks-' + p.id + '" style="display:none; background:#f8fafc; border-bottom: 1px solid #f1f5f9;">';
                pList += '<div class="task-select-item" data-pid="' + p.id + '" data-tid="null" style="padding: 10px 15px 10px 30px; cursor:pointer; color:#0ea5e9; font-weight:600; font-size:0.8rem; border-top:1px dashed #e2e8f0;">(No Task)</div>';
                tList.forEach(t => {
                    pList += '<div class="task-select-item" data-pid="' + p.id + '" data-tid="' + t.id + '" style="padding: 10px 15px 10px 30px; cursor:pointer; color:#64748b; font-size:0.8rem; border-top:1px dashed #e2e8f0;">- ' + t.task_name + '</div>';
                });
                pList += '</div>';
            }
        });
    } else {
        pList += '<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.85rem;">No Projects Found</div>';
    }
    popup.innerHTML = pList + '</div>';

    const searchInput = document.getElementById('tsProjectSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.proj-header').forEach(header => {
                const titleText = header.querySelector('.proj-title-text').textContent.toLowerCase();
                const pid = header.getAttribute('data-id');
                const taskContainer = document.getElementById('tasks-' + pid);
                
                if (titleText.includes(term)) {
                    header.style.display = 'flex'; 
                } else {
                    header.style.display = 'none'; 
                    if (taskContainer) taskContainer.style.display = 'none'; 
                }
            });
        });
        setTimeout(() => searchInput.focus(), 50);
    }

    document.querySelectorAll('.proj-header').forEach(item => {
        item.addEventListener('click', async (e) => {
            const selPid = e.currentTarget.getAttribute('data-id');
            const hasTasks = e.currentTarget.getAttribute('data-hastasks') === 'true';
            
            if (hasTasks) {
                const tc = document.getElementById('tasks-' + selPid);
                tc.style.display = tc.style.display === 'none' ? 'block' : 'none';
            } else {
                const { days } = getWeekRange(currentDate);
                const cDate = days[0];
                const dateStr = cDate.getFullYear() + '-' + String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0'); 
                await saveEntry(dateStr, selPid, null, 0, true);
                popup.style.display = 'none';
                loadData();
            }
        });
    });

    document.querySelectorAll('.task-select-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const selPid = e.currentTarget.getAttribute('data-pid');
            const tidAttr = e.currentTarget.getAttribute('data-tid');
            const selTid = (tidAttr === 'null' || tidAttr === '') ? null : tidAttr;
            
            const { days } = getWeekRange(currentDate);
            const cDate = days[0];
            const dateStr = cDate.getFullYear() + '-' + String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0'); 
            await saveEntry(dateStr, selPid, selTid, 0, true);
            popup.style.display = 'none';
            loadData();
        });
    });
};

const saveEntry = async (dateStr, pid, taskId, sec, isInit = false, tagId = null, remark = null) => {
    const cleanTagId = (tagId === 'null' || tagId === '') ? null : tagId;
    const cleanTaskId = (taskId === 'null' || taskId === '') ? null : taskId;

    let query = supabase.from('time_entries').select('id').eq('employee_id', currentEmployeeId).eq('work_date', dateStr);
    if (pid) query = query.eq('project_id', pid); else query = query.is('project_id', null);
    if (cleanTaskId) query = query.eq('task_id', cleanTaskId); else query = query.is('task_id', null);
    
    const { data: ext } = await query;
    const exists = ext && ext.length > 0;

    if (isInit && exists) return;
    if (!isInit && sec === 0) { if (exists) await supabase.from('time_entries').delete().in('id', ext.map(e=>e.id)); return; }

    const payload = { duration_seconds: sec, tag_id: cleanTagId, task_id: cleanTaskId, notes: remark };
    if (exists) {
        await supabase.from('time_entries').update(payload).eq('id', ext[0].id);
    } else {
        await supabase.from('time_entries').insert([{
            employee_id: currentEmployeeId, project_id: pid, work_date: dateStr, start_time: dateStr + 'T09:00:00',
            duration_seconds: sec, tag_id: cleanTagId, task_id: cleanTaskId, notes: remark, status: 'STOPPED'
        }]);
    }
};

const loadData = async () => {
    const tbody = document.getElementById('timesheetTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="13" class="text-center py-6 text-gray-400 font-semibold">Loading table data...</td></tr>';

    const { start, end, days } = getWeekRange(currentDate);
    const sIso = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0,0,0)).toISOString();
    const eIso = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23,59,59)).toISOString();

    const { data } = await supabase.from('time_entries').select('*, project:projects(project_name), task:tasks(task_name)').eq('employee_id', currentEmployeeId).eq('status', 'STOPPED').gte('start_time', sIso).lte('start_time', eIso);

    const matrix = {}; let gTotal = 0; let dTotal = [0,0,0,0,0,0,0]; let activeDays = new Set();
    const projColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    let colorIdx = 0;

    (data || []).forEach(e => {
        const pid = e.project_id || 'null';
        const tid = e.task_id || 'null';
        const key = pid + '_' + tid;
        
        const pName = e.project ? e.project.project_name : 'General';
        const tName = e.task ? e.task.task_name : '';
        
        let dStr = '';
        if (e.work_date) {
            dStr = String(e.work_date).split('T')[0];
        } else if (e.start_time) {
            let dObj = new Date(e.start_time);
            dStr = dObj.getFullYear() + '-' + String(dObj.getMonth()+1).padStart(2,'0') + '-' + String(dObj.getDate()).padStart(2,'0');
        }

        if (!matrix[key]) {
            matrix[key] = { name: pName, taskName: tName, pid: pid, task: e.task_id||'', tag: e.tag_id||'', note: e.notes||'', arr: {}, color: projColors[colorIdx % projColors.length] };
            colorIdx++;
            days.forEach(d => matrix[key].arr[d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')] = 0);
        } else {
            if (!matrix[key].tag && e.tag_id) matrix[key].tag = e.tag_id;
            if (!matrix[key].note && e.notes) matrix[key].note = e.notes;
        }
        if (matrix[key].arr[dStr] !== undefined) {
            let dur = parseInt(e.duration_seconds) || 0;
            matrix[key].arr[dStr] += dur;
            if (dur > 0) activeDays.add(dStr);
        }
    });

let html = ''; let idx = 1; let chartLabels = []; let chartData = [];
    
    // Susun data dalam matriks mengikut abjad (A-Z)
    const sortedRows = Object.values(matrix).sort((a, b) => a.name.localeCompare(b.name));
    
    sortedRows.forEach(row => {
        let rTotal = 0;
        
        let tagOpts = '<option value="">- Select Tag -</option>';
        tagsDataList.forEach(t => { tagOpts += '<option value="' + t.id + '" ' + (row.tag==t.id?'selected':'') + '>' + (t.tag_name || t.name) + '</option>'; });

        const displayTask = row.taskName ? '<br><span style="color:#64748b; font-size: 0.75rem; font-weight: 500;">' + row.taskName + '</span>' : '';

        html += '<tr style="border-bottom: 1px solid #e2e8f0; background: white;" data-task="'+row.task+'">' +
            '<td style="text-align: center; font-weight: 500; color: #64748b;">' + (idx++) + '</td>' +
            '<td style="font-size: 0.85rem; color: #1e293b; font-weight: 600;"><span style="display:inline-block; width:8px; height:8px; background:'+row.color+'; border-radius:50%; margin-right:8px;"></span>' + row.name.toUpperCase() + displayTask + '</td>' +
            '<td><select class="ts-input font-semibold text-slate-700 bind-tag" data-pid="'+row.pid+'">' + tagOpts + '</select></td>' +
            '<td><input type="text" class="ts-input text-slate-700 font-medium bind-note" data-pid="'+row.pid+'" value="'+row.note+'" placeholder="Type remark..."></td>';

        days.forEach((d, i) => {
            const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const sec = row.arr[k]; rTotal += sec; dTotal[i] += sec;
            const val = sec > 0 ? formatHMS(sec) : '0:00';
            const zc = sec > 0 ? 'font-bold text-blue-700 bg-blue-50' : 'zero font-medium';
            html += '<td style="text-align: center;"><input type="text" class="ts-input bind-time '+zc+'" data-d="'+k+'" data-pid="'+row.pid+'" value="'+val+'"></td>';
        });

        gTotal += rTotal;
        chartLabels.push(row.name); chartData.push((rTotal/3600).toFixed(2));

        html += '<td style="font-weight: 700; color: #1e293b; font-size: 0.9rem; text-align: center;">' + formatHMS(rTotal) + '</td>' +
            '<td style="text-align: center;"><button class="text-gray-400 hover:text-red-500 font-bold transition-colors bind-del" data-pid="'+row.pid+'" title="Delete Row">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
            '</button></td></tr>';
    });

    
    html += '<tr style="border-bottom: 1px solid #e2e8f0; background: white;">' +
        '<td style="text-align: center; font-weight: 500; color: #64748b;"></td>' +
        '<td style="font-size: 0.85rem;">' +
            '<span id="openPickerBtn" style="color: #3b82f6; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>' +
                'Select project' +
            '</span>' +
        '</td>' +
        '<td><select class="ts-input font-semibold text-slate-700" disabled><option>- Select Tag -</option></select></td>' +
        '<td><input type="text" class="ts-input text-slate-700 font-medium" placeholder="Type remark..." disabled></td>';
        
    for(let i=0; i<7; i++) {
        html += '<td style="text-align: center;"><input type="text" class="ts-input zero" value="0:00" disabled></td>';
    }
    
    html += '<td style="font-weight: 700; color: #1e293b; font-size: 0.9rem; text-align: center;">0:00</td>' +
            '<td style="text-align: center;">' +
                '<button class="text-gray-400" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>' +
            '</td>' +
        '</tr>';

    tbody.innerHTML = html;

    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    daysArr.forEach((d, i) => { const tf = document.getElementById('tf'+d); if(tf) tf.textContent = dTotal[i]>0 ? formatHMS(dTotal[i]) : '0:00'; });
    const tfTotal = document.getElementById('tfTotal'); if(tfTotal) tfTotal.textContent = formatHMS(gTotal);

    const kTotal = document.getElementById('kpiTotalHrs'); if(kTotal) kTotal.textContent = formatHMS(gTotal);
    const kProj = document.getElementById('kpiProjects'); if(kProj) kProj.textContent = Object.keys(matrix).length;
    const kTask = document.getElementById('kpiTasks'); if(kTask) kTask.textContent = '-';
    const kDay = document.getElementById('kpiDays'); if(kDay) kDay.textContent = activeDays.size + ' / 7';

    updateCharts(chartLabels, chartData, Object.values(matrix));

    
    const openPickerBtn = document.getElementById('openPickerBtn');
    if (openPickerBtn) openPickerBtn.addEventListener('click', togglePopup);

    document.querySelectorAll('.bind-time').forEach(inp => {
        inp.addEventListener('focus', function(){ this.dataset.old = this.value; if(this.value==='0:00')this.value=''; });
        inp.addEventListener('blur', function(){ if(this.value.trim()==='') this.value='0:00'; });
        inp.addEventListener('change', async function(){
            let v = this.value.trim()||'0:00'; if(!v.includes(':')&&!v.includes('.')) v+=':00';
            const sec = parseTime(v); this.value = sec>0 ? formatHMS(sec) : '0:00';
            if(this.value === this.dataset.old) return;
            
            const tr = this.closest('tr');
            const tagVal = tr.querySelector('.bind-tag').value;
            const finalTag = (tagVal === '' || tagVal === 'null') ? null : tagVal;
            const taskAttr = tr.getAttribute('data-task');
            const finalTask = (taskAttr === 'null' || taskAttr === '') ? null : taskAttr;
            const note = tr.querySelector('.bind-note').value;
            
            this.style.opacity = '0.5';
            await saveEntry(this.dataset.d, this.dataset.pid==='null'?null:this.dataset.pid, finalTask, sec, false, finalTag, note);
            loadData();
        });
    });

    document.querySelectorAll('.bind-tag, .bind-note').forEach(inp => {
        inp.addEventListener('change', async function() {
            const tr = this.closest('tr');
            const pid = this.dataset.pid;
            const tagVal = tr.querySelector('.bind-tag').value;
            const finalTag = (tagVal === '' || tagVal === 'null') ? null : tagVal;
            const taskAttr = tr.getAttribute('data-task');
            const finalTask = (taskAttr === 'null' || taskAttr === '') ? null : taskAttr;
            const note = tr.querySelector('.bind-note').value;
            
            const { days } = getWeekRange(currentDate);
            const sStr = days[0].getFullYear() + '-' + String(days[0].getMonth()+1).padStart(2,'0') + '-' + String(days[0].getDate()).padStart(2,'0');
            const eStr = days[6].getFullYear() + '-' + String(days[6].getMonth()+1).padStart(2,'0') + '-' + String(days[6].getDate()).padStart(2,'0');
            
            this.style.opacity = '0.5';
            let q = supabase.from('time_entries').update({tag_id:finalTag, task_id:finalTask, notes:note}).eq('employee_id', currentEmployeeId).gte('work_date', sStr).lte('work_date', eStr);
            if(pid==='null') q=q.is('project_id', null); else q=q.eq('project_id', pid);
            if(finalTask===null) q=q.is('task_id', null); else q=q.eq('task_id', finalTask);
            await q;
            this.style.opacity = '1';
        });
    });

    document.querySelectorAll('.bind-del').forEach(btn => {
        btn.addEventListener('click', async function(){
            if(!confirm("Are you sure you want to delete this entire time record line?")) return;
            const pid = this.dataset.pid;
            const tr = this.closest('tr');
            const taskAttr = tr.getAttribute('data-task');
            const finalTask = (taskAttr === 'null' || taskAttr === '') ? null : taskAttr;

            const { days } = getWeekRange(currentDate);
            const sStr = days[0].getFullYear() + '-' + String(days[0].getMonth()+1).padStart(2,'0') + '-' + String(days[0].getDate()).padStart(2,'0');
            const eStr = days[6].getFullYear() + '-' + String(days[6].getMonth()+1).padStart(2,'0') + '-' + String(days[6].getDate()).padStart(2,'0');
            
            let q = supabase.from('time_entries').delete().eq('employee_id', currentEmployeeId).gte('work_date', sStr).lte('work_date', eStr);
            if(pid==='null') q=q.is('project_id', null); else q=q.eq('project_id', pid);
            if(finalTask===null) q=q.is('task_id', null); else q=q.eq('task_id', finalTask);
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
            alert('No records found from last week to copy.');
            if(copyBtn) copyBtn.innerHTML = originalHtml;
            return;
        }

        const matrix = {};
        lwData.forEach(entry => {
            const pid = entry.project_id || 'null';
            const tid = entry.task_id || 'null';
            const key = pid + '_' + tid;
            let dObj = entry.work_date ? new Date(entry.work_date) : new Date(entry.start_time);
            let dayIndex = dObj.getDay() - 1;
            if (dayIndex === -1) dayIndex = 6;

            if (!matrix[key]) matrix[key] = { pid: entry.project_id, tag: entry.tag_id, task: entry.task_id, note: entry.notes, dailyData: [0,0,0,0,0,0,0] };
            if (includeTime) matrix[key].dailyData[dayIndex] += (entry.duration_seconds || 0);
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
    } catch (err) { alert("Failed to copy: " + err.message); }
    
    if(copyBtn) copyBtn.innerHTML = originalHtml;
};

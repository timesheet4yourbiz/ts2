import { supabase } from './supabase.js';

let currentEmployeeId = null;
let isAdmin = false;
let currentDate = new Date(); 
let viewStart = new Date();
let viewEnd = new Date();
let weekDays = [];

let employeesData = [];
let projectsData = [];
let tasksData = [];
let entriesData = [];

let activeEntryId = null;
const START_HOUR = 8; 
const END_HOUR = 19;  
const ROW_HEIGHT = 60; // 60px per hour

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

        document.getElementById('logoutBtn')?.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

        if (!isAdmin) {
            document.getElementById('formEmpContainer').style.display = 'none';
        }

        setupCalendarBase();
        await loadDropdowns();
        calculateWeekRange();
        await fetchEntries();

        document.getElementById('btnPrevWeek')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 7); calculateWeekRange(); fetchEntries(); });
        document.getElementById('btnNextWeek')?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 7); calculateWeekRange(); fetchEntries(); });
        document.getElementById('btnToday')?.addEventListener('click', () => { currentDate = new Date(); calculateWeekRange(); fetchEntries(); });
        
        document.getElementById('filterEmp')?.addEventListener('change', fetchEntries);
        document.getElementById('filterProj')?.addEventListener('change', fetchEntries);

        setupModal();

        // Update current time line every minute
        setInterval(updateCurrentTimeLine, 60000);

    } catch (err) {
        console.error("Calendar Init Error:", err);
    }
});

function calculateWeekRange() {
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
    document.getElementById('currentPeriodText').textContent = dStr;

    renderCalendarHeaders();
}

function setupCalendarBase() {
    const timeCol = document.getElementById('calTimeCol');
    let timeHtml = '';
    for(let i = START_HOUR; i <= END_HOUR; i++) {
        const h = i.toString().padStart(2, '0') + ':00';
        timeHtml += '<div class="cal-time-slot">' + h + '</div>';
    }
    timeCol.innerHTML = timeHtml;
}

function renderCalendarHeaders() {
    const header = document.getElementById('calHeader');
    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    let html = '<div class="cal-header-cell flex items-center justify-center text-[10px]">GMT+8</div>';
    
    const todayStr = new Date().toDateString();

    weekDays.forEach((d, i) => {
        const isToday = d.toDateString() === todayStr;
        const cls = isToday ? 'cal-header-cell today' : 'cal-header-cell';
        html += '<div class="' + cls + '">' + daysArr[i] + 
                '<span class="cal-header-date">' + d.getDate() + '</span></div>';
    });

    header.innerHTML = html;
    updateCurrentTimeLine();
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

    if(fEmp) employeesData.forEach(e => fEmp.innerHTML += '<option value="'+e.id+'">'+(e.name || e.email)+'</option>');
    if(modEmp) employeesData.forEach(e => modEmp.innerHTML += '<option value="'+e.id+'">'+(e.name || e.email)+'</option>');
    if(modEmp && !isAdmin) modEmp.value = currentEmployeeId;

    if(fProj) projectsData.forEach(p => fProj.innerHTML += '<option value="'+p.id+'">'+p.project_name+'</option>');
    if(modProj) {
        modProj.innerHTML = '<option value="">- Select Project -</option>';
        projectsData.forEach(p => modProj.innerHTML += '<option value="'+p.id+'">'+p.project_name+'</option>');
    }

    if(modProj) {
        modProj.addEventListener('change', (e) => {
            const pid = e.target.value;
            const tSel = document.getElementById('formTask');
            tSel.innerHTML = '<option value="">No Task</option>';
            if(pid) {
                const pTasks = tasksData.filter(t => t.project_id === pid);
                pTasks.forEach(t => tSel.innerHTML += '<option value="'+t.id+'">'+t.task_name+'</option>');
            }
        });
    }
}

async function fetchEntries() {
    const startIso = new Date(Date.UTC(viewStart.getFullYear(), viewStart.getMonth(), viewStart.getDate(), 0,0,0)).toISOString();
    const endIso = new Date(Date.UTC(viewEnd.getFullYear(), viewEnd.getMonth(), viewEnd.getDate(), 23,59,59)).toISOString();

    const empFilter = document.getElementById('filterEmp').value;
    const projFilter = document.getElementById('filterProj').value;

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
    renderGridAndEvents();
    updateKPIs();
}

const colors = [
    { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' }, // Blue
    { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' }, // Green
    { bg: '#fdf4ff', border: '#d946ef', text: '#701a75' }, // Fuchsia
    { bg: '#fffbeb', border: '#f59e0b', text: '#78350f' }, // Amber
    { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d' }, // Red
];

function renderGridAndEvents() {
    const gridArea = document.getElementById('calGridArea');
    
    // Create base columns
    let html = '';
    for(let i=0; i<7; i++) {
        const dStr = weekDays[i].getFullYear() + '-' + String(weekDays[i].getMonth()+1).padStart(2,'0') + '-' + String(weekDays[i].getDate()).padStart(2,'0');
        html += '<div class="cal-day-col" data-date="' + dStr + '"></div>';
    }
    
    html += '<div id="currentTimeLine" class="current-time-line" style="display: none;"></div>';
    gridArea.innerHTML = html;

    // Plot events
    entriesData.forEach(entry => {
        let entryDate;
        if(entry.work_date) {
            const pts = entry.work_date.split('-');
            entryDate = new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2]));
        } else {
            entryDate = new Date(entry.start_time);
        }

        const dStr = entryDate.getFullYear() + '-' + String(entryDate.getMonth()+1).padStart(2,'0') + '-' + String(entryDate.getDate()).padStart(2,'0');
        const col = gridArea.querySelector(`.cal-day-col[data-date="${dStr}"]`);
        
        if (col) {
            let startDt = new Date(entry.start_time);
            let startH = startDt.getHours() + (startDt.getMinutes() / 60);
            
            // Default kepada 09:00 jika masa start_time adalah default 00:00 UTC (Sebab Timesheet lama tiada Start Time)
            if(startDt.getUTCHours() === 0 && startDt.getUTCMinutes() === 0 && startDt.getUTCSeconds() === 0) {
                startH = 9.0; 
            }
            
            const durHrs = (entry.duration_seconds || 3600) / 3600;
            
            // Pastikan event berada dalam grid 08:00 - 19:00
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
                
                const titleHtml = isAdmin ? `[\({eName}]\){pName}` : pName;
                const hMins = Math.floor(durHrs) + 'h ' + Math.round((durHrs % 1) * 60) + 'm';

                const evDiv = document.createElement('div');
                evDiv.className = 'cal-event';
                evDiv.style.top = topPx + 'px';
                evDiv.style.height = heightPx + 'px';
                evDiv.style.backgroundColor = colorObj.bg;
                evDiv.style.borderColor = colorObj.border;
                evDiv.style.color = colorObj.text;
                
                evDiv.innerHTML = `

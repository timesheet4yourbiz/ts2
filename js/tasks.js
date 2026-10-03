import { supabase } from './supabase.js';

let isAdmin = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return window.location.href = '../pages/login.html';
        
        // Pengekstrakan Nama & Initial Profil
        const avatarInitial = document.getElementById('avatarInitial');
        const profileName = document.getElementById('profileName');
        const userEmail = session.user.email;
        if (avatarInitial) avatarInitial.textContent = userEmail.charAt(0).toUpperCase();
        if (profileName) profileName.textContent = userEmail.split('@')[0].toUpperCase();

        // Semak Role
        const { data: profile } = await supabase.from('employees').select('system_role').eq('id', session.user.id).single();
        if (profile && profile.system_role === 'Admin') {
            isAdmin = true;
            const profileRole = document.getElementById('profileRole');
            if(profileRole) profileRole.textContent = 'Administrator';
        }

        const projectSelect = document.getElementById('projectSelect');
        const taskNameInput = document.getElementById('taskNameInput');
        const taskTagInput = document.getElementById('taskTagInput'); 
        const addTaskBtn = document.getElementById('addTaskBtn');

        await loadProjectsDropdown();
        await loadTasks();

        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', async () => {
                if(!isAdmin) return alert("Akses Terhad: Hanya Admin yang dibenarkan menambah task.");

                const projectId = projectSelect.value;
                const taskName = taskNameInput.value.trim();
                const taskTag = taskTagInput ? taskTagInput.value.trim() : '';

                if (!projectId || !taskName) return alert('Sila pilih projek dan masukkan nama tugasan.');

                addTaskBtn.disabled = true;
                addTaskBtn.textContent = 'SAVING...';

                const { error } = await supabase.from('tasks').insert([{ 
                    project_id: projectId, 
                    task_name: taskName,
                    tag: taskTag
                }]);
                
                if (error) {
                    alert('Ralat menambah tugasan: ' + error.message);
                } else {
                    taskNameInput.value = '';
                    if (taskTagInput) taskTagInput.value = '';
                    await loadTasks();
                }

                addTaskBtn.disabled = false;
                addTaskBtn.textContent = 'ADD TASK';
            });
        }

    } catch (err) {
        console.error("Tasks Init Error:", err);
    }
});

async function loadProjectsDropdown() {
    const projectSelect = document.getElementById('projectSelect');
    if(!projectSelect) return;

    const { data } = await supabase.from('projects').select('id, project_name, project_code').order('project_name');
    if (data) {
        projectSelect.innerHTML += data.map(p => 
            '<option value="' + p.id + '">' + (p.project_code ? p.project_code + ' - ' : '') + p.project_name.toUpperCase() + '</option>'
        ).join('');
    }
}

async function loadTasks() {
    const tasksTableBody = document.getElementById('tasksTableBody');
    if(!tasksTableBody) return;

    tasksTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-400 font-semibold">Loading tasks...</td></tr>';

    const { data, error } = await supabase.from('tasks').select('*, projects(project_name)').order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        tasksTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-400 font-semibold">No tasks found.</td></tr>';
        return;
    }

    let html = '';
    data.forEach((task, idx) => {
        const isCompleted = task.status === 'COMPLETED';
        const pName = task.projects ? task.projects.project_name.toUpperCase() : '-';
        
        const statusColor = isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100';
        const statusDot = isCompleted ? 'bg-emerald-500' : 'bg-amber-500';
        const statusText = isCompleted ? 'COMPLETED' : 'PENDING';
        
        const tagDisplay = task.tag 
            ? '<span class="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] font-bold tracking-wide">' + task.tag + '</span>' 
            : '<span class="text-slate-300 text-xs">-</span>';

        let actionHtml = '<span class="text-slate-300 text-xs font-semibold">View Only</span>';
        
        if (isAdmin) {
            actionHtml = '<div class="flex items-center justify-center gap-3">';
            if (!isCompleted) {
                actionHtml += '<button class="complete-btn text-emerald-500 hover:text-emerald-600 font-bold transition-colors text-sm" data-id="' + task.id + '" title="Mark as Done">✔ Done</button>';
            }
            actionHtml += '<button class="delete-btn text-red-400 hover:text-red-600 font-bold transition-colors text-sm" data-id="' + task.id + '" title="Delete Task">✖ Delete</button>';
            actionHtml += '</div>';
        }

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="text-center text-slate-500 text-xs font-bold">' + (idx + 1) + '</td>' +
            '<td class="text-slate-600 text-[11px] font-extrabold">' + pName + '</td>' +
            '<td class="font-semibold text-sm ' + (isCompleted ? 'line-through text-slate-400' : 'text-slate-800') + '">' + task.task_name + '</td>' +
            '<td>' + tagDisplay + '</td>' +
            '<td>' +
                '<span class="px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-wider flex items-center gap-1.5 w-max uppercase ' + statusColor + '">' +
                    '<div class="w-1.5 h-1.5 rounded-full ' + statusDot + '"></div>' +
                    statusText +
                '</span>' +
            '</td>' +
            '<td class="text-center">' + actionHtml + '</td>' +
        '</tr>';
    });

    tasksTableBody.innerHTML = html;

    if (isAdmin) {
        document.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await supabase.from('tasks').update({ status: 'COMPLETED' }).eq('id', e.target.dataset.id);
                loadTasks();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Anda pasti mahu memadam tugasan ini?')) {
                    await supabase.from('tasks').delete().eq('id', e.target.dataset.id);
                    loadTasks();
                }
            });
        });
    }
}

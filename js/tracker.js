import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';
        
        // Pengekstrakan Profile dibuat oleh sidebar.js, kita hanya perlukan user email untuk carian DB.
        const userEmail = session.user.email;

        const taskDescInput = document.getElementById('taskDescInput');
        const projectSelect = document.getElementById('projectSelect'); 
        const taskSelect = document.getElementById('taskSelect'); 
        const tagSelect = document.getElementById('tagSelect');
        const timerDisplay = document.getElementById('timerDisplay');
        const timerBtn = document.getElementById('timerBtn');
        const entriesContainer = document.getElementById('entriesContainer');

        let currentEmployeeId = null;
        let activeEntryId = null;
        let timerInterval = null;
        let startTime = null;

        // Dapatkan ID Employee semasa
        const { data: profile } = await supabase.from('employees').select('id').eq('email', userEmail).single();
        if (profile) {
            currentEmployeeId = profile.id;
            await loadProjects();
            await loadTags();
            await checkActiveTimer();
            await loadRecentEntries();
        } else {
            if(entriesContainer) {
                entriesContainer.innerHTML = '<div class="p-8 text-center text-red-500 font-bold bg-white rounded-xl shadow-sm border border-red-100">Akaun e-mel anda (' + userEmail + ') belum didaftarkan di modul Team. Sistem tidak dapat merekod masa.</div>';
            }
        }

        if (projectSelect && taskSelect) {
            projectSelect.addEventListener('change', async (e) => {
                const pid = e.target.value;
                if (!pid) {
                    taskSelect.classList.add('hidden');
                    taskSelect.innerHTML = '<option value="">Select Task</option>';
                    return;
                }
                
                taskSelect.classList.remove('hidden');
                taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
                
                const { data, err } = await supabase.from('tasks').select('id, task_name').eq('project_id', pid);
                
                if (err) {
                    taskSelect.innerHTML = '<option value="">Error loading</option>';
                    return;
                }
                
                if (data && data.length > 0) {
                    let opts = '<option value="">Select Task</option>';
                    data.forEach(t => {
                        opts += '<option value="' + t.id + '">' + t.task_name + '</option>';
                    });
                    taskSelect.innerHTML = opts;
                } else {
                    taskSelect.innerHTML = '<option value="">No Tasks</option>';
                }
            });
        }

        if(timerBtn) {
            timerBtn.addEventListener('click', async () => {
                timerBtn.disabled = true;
                if (activeEntryId) {
                    await stopTimer();
                } else {
                    await startTimer();
                }
                timerBtn.disabled = false;
            });
        }

        async function loadProjects() {
            const { data } = await supabase.from('projects').select('id, project_name').order('project_name', { ascending: true });
            if (data && projectSelect) {
                let opts = '<option value="">Select Project</option>';
                data.forEach(p => {
                    opts += '<option value="' + p.id + '">' + p.project_name + '</option>';
                });
                projectSelect.innerHTML = opts;
            }
        }

        async function loadTags() {
            const { data } = await supabase.from('tags').select('id, tag_name').order('tag_name', { ascending: true });
            if (data && tagSelect) {
                let opts = '<option value="">Tag</option>';
                data.forEach(t => {
                    opts += '<option value="' + t.id + '">' + t.tag_name + '</option>';
                });
                tagSelect.innerHTML = opts;
            }
        }

        async function checkActiveTimer() {
            const { data } = await supabase.from('time_entries').select('*').eq('employee_id', currentEmployeeId).eq('status', 'RUNNING').maybeSingle();
            if (data) {
                activeEntryId = data.id;
                startTime = new Date(data.start_time).getTime();
                
                if(taskDescInput) {
                    taskDescInput.value = data.description || '';
                    taskDescInput.disabled = true;
                }
                if (data.project_id && projectSelect) {
                    projectSelect.value = data.project_id;
                    projectSelect.disabled = true;
                    
                    const tasksReq = await supabase.from('tasks').select('id, task_name').eq('project_id', data.project_id);
                    if (tasksReq.data && tasksReq.data.length > 0 && taskSelect) {
                        taskSelect.classList.remove('hidden');
                        let opts = '<option value="">Select Task</option>';
                        tasksReq.data.forEach(t => {
                            opts += '<option value="' + t.id + '">' + t.task_name + '</option>';
                        });
                        taskSelect.innerHTML = opts;
                        if (data.task_id) taskSelect.value = data.task_id;
                    }
                }
                if (data.tag_id && tagSelect) {
                    tagSelect.value = data.tag_id;
                    tagSelect.disabled = true;
                }
                
                if(taskSelect) taskSelect.disabled = true;
                
                setButtonState('STOP');
                startClock();
            }
        }

        async function startTimer() {
            if (!currentEmployeeId) return alert("Ralat: ID Pekerja anda tidak dijumpai dalam pangkalan data.");
            
            const projectId = projectSelect ? projectSelect.value : null;
            const taskId = (taskSelect && !taskSelect.classList.contains('hidden')) ? taskSelect.value : null;
            const tagId = tagSelect ? tagSelect.value : null;
            const description = taskDescInput ? taskDescInput.value.trim() : '';
            
            const payload = {
                employee_id: currentEmployeeId,
                description: description || '(No description)',
                work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
                start_time: new Date().toISOString(),
                status: 'RUNNING',
                entry_type: 'Timer'
            };

            if (projectId) payload.project_id = projectId;
            if (taskId) payload.task_id = taskId;
            if (tagId) payload.tag_id = tagId;

            const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();

            if (error) return alert("Gagal mulakan timer: " + error.message);

            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            
            if(taskDescInput) taskDescInput.disabled = true;
            if(projectSelect) projectSelect.disabled = true;
            if(taskSelect) taskSelect.disabled = true;
            if(tagSelect) tagSelect.disabled = true;
            
            setButtonState('STOP');
            startClock();
        }

        async function stopTimer() {
            const nowIso = new Date().toISOString();
            const endTime = new Date(nowIso).getTime();
            const totalSeconds = Math.floor((endTime - startTime) / 1000);
            const totalMinutes = Math.floor(totalSeconds / 60);

            const { error } = await supabase.from('time_entries').update({
                end_time: nowIso, total_minutes: totalMinutes, duration_seconds: totalSeconds, status: 'STOPPED'
            }).eq('id', activeEntryId);

            if (error) return alert("Gagal hentikan timer: " + error.message);

            stopClock();
            activeEntryId = null;
            startTime = null;
            if(timerDisplay) timerDisplay.textContent = '0:00:00';
            
            if(taskDescInput) { taskDescInput.disabled = false; taskDescInput.value = ''; }
            if(projectSelect) { projectSelect.disabled = false; projectSelect.value = ''; }
            if(taskSelect) { taskSelect.disabled = false; taskSelect.value = ''; taskSelect.classList.add('hidden'); }
            if(tagSelect) { tagSelect.disabled = false; tagSelect.value = ''; }
            
            setButtonState('START');
            await loadRecentEntries();
        }

        function setButtonState(state) {
            if(!timerBtn) return;
            if (state === 'START') {
                timerBtn.textContent = 'START';
                timerBtn.style.backgroundColor = '#2563eb'; // blue-600
            } else {
                timerBtn.textContent = 'STOP';
                timerBtn.style.backgroundColor = '#ef4444'; // red-500
            }
        }

        function startClock() { timerInterval = setInterval(updateDisplay, 1000); updateDisplay(); }
        function stopClock() { clearInterval(timerInterval); }
        
        function updateDisplay() {
            if(!timerDisplay) return;
            const diff = Math.floor((Date.now() - startTime) / 1000);
            const h = Math.floor(diff / 3600);
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            timerDisplay.textContent = h + ':' + m + ':' + s;
        }

        // ==========================================
        // FUNGSI PAPARAN REKOD
        // ==========================================

        async function loadRecentEntries() {
            if (!entriesContainer) return;
            
            entriesContainer.innerHTML = '<div class="text-center p-10 text-slate-400 font-semibold">Loading entries...</div>';

            const { data, error } = await supabase
                .from('time_entries')
                .select('*, project:projects!fk_time_entries_project(project_name), task:tasks!fk_time_entries_task(task_name), tag:tags!fk_time_entries_tag(tag_name)')
                .eq('employee_id', currentEmployeeId)
                .eq('status', 'STOPPED')
                .order('start_time', { ascending: false });

            if (error || !data || data.length === 0) {
                entriesContainer.innerHTML = '<div class="p-10 text-center text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100 font-medium">No time entries found. Start the timer above!</div>';
                return;
            }

            const groupedData = data.reduce((acc, entry) => {
                const date = entry.work_date || new Date(entry.start_time).toLocaleDateString('en-CA');
                if (!acc[date]) acc[date] = { entries: [], totalSeconds: 0 };
                acc[date].entries.push(entry);
                acc[date].totalSeconds += (entry.duration_seconds || 0);
                return acc;
            }, {});

            let htmlContent = '';
            let grandTotalSeconds = 0;

            for (const [date, group] of Object.entries(groupedData)) {
                grandTotalSeconds += group.totalSeconds;
                
                const dateObj = new Date(date);
                const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                
                const dH = Math.floor(group.totalSeconds / 3600);
                const dM = String(Math.floor((group.totalSeconds % 3600) / 60)).padStart(2, '0');

                htmlContent += '<div class="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">' +
                    
                    '<div class="bg-slate-50 px-5 py-3 flex justify-between items-center text-sm text-slate-500 font-bold border-b border-slate-200">' +
                        '<span>' + dateString + '</span>' +
                        '<div class="flex items-center gap-2">' +
                            '<span>Total: <strong class="text-slate-700 text-base ml-1">' + dH + ':' + dM + '</strong></span>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="flex px-5 py-2.5 bg-white text-[10px] font-extrabold tracking-wider text-slate-400 uppercase border-b border-slate-100">' +
                        '<div class="flex-1">Description</div>' +
                        '<div class="w-64">Project & Task</div>' +
                        '<div class="w-32">Tag</div>' +
                        '<div class="w-10 text-center">📝</div>' +
                        '<div class="w-32 text-right">Time</div>' +
                        '<div class="w-16 text-right">Duration</div>' +
                        '<div class="w-16"></div>' +
                    '</div>' +
                    '<div class="divide-y divide-slate-50">';

                group.entries.forEach(entry => {
                    const sTime = new Date(entry.start_time).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true});
                    const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true}) : '-';
                    
                    const h = Math.floor((entry.duration_seconds || 0) / 3600);
                    const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                    
                    const pName = entry.project ? entry.project.project_name.toUpperCase() : 'NO PROJECT';
                    const tName = entry.task ? entry.task.task_name.toUpperCase() : '';
                    const tagName = entry.tag ? entry.tag.tag_name : '';
                    
                    const displayProjTask = tName ? pName + ' / ' + tName : pName;
                    const descValue = entry.description ? entry.description : '';
                    
                    const noteText = entry.notes || '';
                    const noteIconColor = noteText ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400';

                    htmlContent += '<div class="flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors group">' +
                                
                                '<input type="text" value="' + descValue + '" readonly class="flex-1 border-none outline-none text-slate-700 text-sm font-medium bg-transparent">' +
                                
                                '<div class="w-64 text-blue-600 font-bold text-xs flex items-center gap-2 truncate pr-4">' +
                                    '<div class="min-w-[6px] h-1.5 bg-blue-500 rounded-full"></div>' +
                                    '<span class="truncate">' + displayProjTask + '</span>' +
                                '</div>' +
                                
                                '<div class="w-32 text-slate-500 font-semibold text-xs flex items-center gap-1.5 truncate pr-2">' +
                                    (tagName ? '🏷️ <span class="truncate">' + tagName + '</span>' : '-') +
                                '</div>' +
                                
                                '<div class="w-10 text-center">' +
                                    '<button class="note-entry-btn transition-colors ' + noteIconColor + '" data-id="' + entry.id + '" data-note="' + noteText + '" title="' + (noteText ? noteText : 'Add note') + '">📝</button>' +
                                '</div>' +
                                
                                '<div class="w-32 text-right text-slate-500 font-medium text-xs pr-4">' +
                                    sTime + ' - ' + eTime +
                                '</div>' +
                                
                                '<div class="w-16 font-bold text-slate-800 text-right text-sm">' +
                                    h + ':' + m +
                                '</div>' +
                                
                                '<div class="w-16 flex items-center justify-end gap-3 pl-4 opacity-0 group-hover:opacity-100 transition-opacity">' +
                                    '<button class="text-slate-400 hover:text-emerald-500 font-bold" title="Continue">▶</button>' +
                                    '<button class="del-entry-btn text-slate-400 hover:text-red-500 font-bold text-lg" data-id="' + entry.id + '" title="Delete">⋮</button>' +
                                '</div>' +
                            '</div>';
                });

                htmlContent += '</div></div>';
            }

            const grandH = Math.floor(grandTotalSeconds / 3600);
            const grandM = String(Math.floor((grandTotalSeconds % 3600) / 60)).padStart(2, '0');
            
            entriesContainer.innerHTML = '<div class="flex justify-between text-slate-500 text-xs font-bold px-1 mb-3">' +
                    '<span>THIS WEEK</span>' +
                    '<span>Week total: <strong class="text-slate-700 text-sm ml-1">' + grandH + ':' + grandM + '</strong></span>' +
                '</div>' + htmlContent;

            document.querySelectorAll('.del-entry-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(confirm('Padam rekod masa ini?')) {
                        await supabase.from('time_entries').delete().eq('id', e.target.getAttribute('data-id'));
                        loadRecentEntries();
                    }
                });
            });

            document.querySelectorAll('.note-entry-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const entryId = e.currentTarget.getAttribute('data-id');
                    const currentNote = e.currentTarget.getAttribute('data-note');
                    
                    const newNote = prompt("Masukkan/Edit nota untuk rekod masa ini:", currentNote);
                    
                    if (newNote !== null) {
                        const { error } = await supabase.from('time_entries').update({ notes: newNote.trim() }).eq('id', entryId);
                        if (error) {
                            alert("Gagal simpan nota: " + error.message);
                        } else {
                            loadRecentEntries(); 
                        }
                    }
                });
            });
        }

    } catch (err) {
        console.error("Tracker Init Error:", err);
    }
});

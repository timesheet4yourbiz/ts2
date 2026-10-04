import { supabase } from './supabase.js';

let membersData = [];
let groupsData = [];
let isAdmin = false; 
let activeMemberId = null;
let activeGroupId = null;
let currentPage = 1;
const rowsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const { data: profile } = await supabase.from('employees').select('system_role').eq('id', session.user.id).maybeSingle();
        if (profile && profile.system_role) {
            isAdmin = profile.system_role.toLowerCase() === 'admin';
        }

        if (!isAdmin) {
            const btnAddMem = document.getElementById('btnAddMember');
            const btnAddGrp = document.getElementById('btnAddGroup');
            if (btnAddMem) btnAddMem.style.display = 'none';
            if (btnAddGrp) btnAddGrp.style.display = 'none';
        }

        setupTabs();
        setupFilters();
        setupExcelImport();
        
        setupMemberModal();
        setupGroupModal();

        await fetchMembers(); 
        await fetchGroups();

    } catch (error) {
        console.error("Team Module Init Error:", error);
    }
});

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const tabId = e.target.getAttribute('data-tab');
            const memView = document.getElementById('membersView');
            const grpView = document.getElementById('groupsView');
            if(memView) memView.style.display = tabId === 'membersView' ? 'block' : 'none';
            if(grpView) grpView.style.display = tabId === 'groupsView' ? 'block' : 'none';
        });
    });
}

async function fetchMembers() {
    const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, employee_no, phone, department, position, system_role, group_id, billable_rate, status, groups!group_id(group_name)')
        .order('name');

    if (!error) {
        membersData = data || [];
        updateKPIs();
        populateDepartmentFilter();
        populateManagerDropdown();
        filterMembers(); 
    }
}

function updateKPIs() {
    const tMembers = membersData.length;
    const tActive = membersData.filter(m => (m.status || '').toUpperCase() === 'ACTIVE').length;

    const elT = document.getElementById('kpiTotal');
    const elA = document.getElementById('kpiActive');
    
    if(elT) elT.textContent = tMembers;
    if(elA) elA.textContent = tActive;
}

function populateDepartmentFilter() {
    const deptSelect = document.getElementById('filterDept');
    if (!deptSelect) return;
    
    deptSelect.innerHTML = '<option value="all">All Departments</option>';
    const depts = [...new Set(membersData.map(m => m.department).filter(Boolean))].sort();
    
    depts.forEach(d => {
        deptSelect.innerHTML += '<option value="' + d + '">' + d + '</option>';
    });
}

function setupFilters() {
    const sInp = document.getElementById('searchMember');
    const rSel = document.getElementById('filterRole');
    const dSel = document.getElementById('filterDept');
    const stSel = document.getElementById('filterStatus');

    const trigger = () => { currentPage = 1; filterMembers(); };
    if(sInp) sInp.addEventListener('keyup', trigger);
    if(rSel) rSel.addEventListener('change', trigger);
    if(dSel) dSel.addEventListener('change', trigger);
    if(stSel) stSel.addEventListener('change', trigger);

    const btnP = document.getElementById('btnPrevPage');
    const btnN = document.getElementById('btnNextPage');
    if(btnP) btnP.addEventListener('click', () => { if (currentPage > 1) { currentPage--; filterMembers(); } });
    if(btnN) btnN.addEventListener('click', () => { currentPage++; filterMembers(); });
}

function filterMembers() {
    const sInp = document.getElementById('searchMember');
    const rSel = document.getElementById('filterRole');
    const dSel = document.getElementById('filterDept');
    const stSel = document.getElementById('filterStatus');
    
    const term = sInp ? sInp.value.toLowerCase() : '';
    const role = rSel ? rSel.value : 'all';
    const dept = dSel ? dSel.value : 'all';
    const stat = stSel ? stSel.value : 'all';

    const filtered = membersData.filter(m => {
        const matchName = (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term);
        // Semakan peranan kalis huruf besar/kecil
        const matchRole = role === 'all' || (m.system_role && m.system_role.toLowerCase() === role.toLowerCase());
        const matchDept = dept === 'all' || m.department === dept;
        const matchStat = stat === 'all' || (m.status||'').toUpperCase() === stat.toUpperCase();
        return matchName && matchRole && matchDept && matchStat;
    });

    renderMembersTable(filtered);
}

function renderMembersTable(data) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400 font-medium">No matching records found.</td></tr>';
        updatePagination(0, 0, 0, 0);
        return;
    }

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const paginated = data.slice(startIdx, startIdx + rowsPerPage);

    let html = '';
    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500'];

    paginated.forEach((m, idx) => {
        const globalIdx = startIdx + idx + 1;
        const name = m.name || 'Unknown';
        const init = name.substring(0, 2).toUpperCase();
        const empId = m.employee_no ? ' | ID: ' + m.employee_no : '';
        const color = colors[idx % colors.length];
        
        const isAct = (m.status || '').toUpperCase() === 'ACTIVE';
        const stHtml = isAct 
            ? '<span class="status-active"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ACTIVE</span>'
            : '<span class="status-inactive"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>INACTIVE</span>';
            
        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="p-4 text-center"><input type="checkbox" class="rounded border-slate-300"></td>' +
            '<td class="p-4 text-slate-500 font-bold">' + globalIdx + '</td>' +
            '<td class="p-4">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm ' + color + '">' + init + '</div>' +
                    '<div>' +
                        '<div class="font-bold text-slate-800 text-sm">' + name + '</div>' +
                        '<div class="text-[11px] font-semibold text-slate-400 mt-0.5">' + m.email + empId + '</div>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td class="p-4">' +
                '<div class="font-bold text-slate-700 text-xs">' + (m.system_role || 'Employee') + '</div>' +
                '<div class="text-[10px] font-bold text-slate-400 uppercase mt-1">' + (m.position || '-') + '</div>' +
            '</td>' +
            '<td class="p-4 font-bold text-slate-600 text-xs uppercase">' + (m.department || '-') + '</td>' +
            '<td class="p-4 font-bold text-slate-600 text-sm">' + (m.billable_rate ? parseFloat(m.billable_rate).toFixed(2) : '0.00') + '</td>' +
            '<td class="p-4">' + stHtml + '</td>' +
            '<td class="p-4 text-center">' +
                '<div class="flex justify-center gap-2">';
                
        if (isAdmin) {
            html += '<button class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors bind-edit" data-id="' + m.id + '">✏</button>' +
                    '<button class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-colors bind-del text-sm" data-id="' + m.id + '">🗑️</button>';
        } else {
            html += '🔒';
        }
                
        html += '</div>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    updatePagination(totalItems, totalPages, startIdx, startIdx + paginated.length);
    bindActionButtons();
}

function updatePagination(total, pages, start, end) {
    const info = document.getElementById('paginationInfo');
    const pNum = document.getElementById('pageNumbers');
    const bPrev = document.getElementById('btnPrevPage');
    const bNext = document.getElementById('btnNextPage');

    if (info) info.textContent = total > 0 ? 'Showing ' + (start + 1) + '-' + end + ' of ' + total + ' members' : 'Showing 0 members';
    if (pNum) pNum.textContent = 'Page ' + currentPage + ' of ' + pages;
    
    if (bPrev) { bPrev.disabled = currentPage === 1; bPrev.style.opacity = currentPage === 1 ? '0.5' : '1'; }
    if (bNext) { bNext.disabled = currentPage >= pages; bNext.style.opacity = currentPage >= pages ? '0.5' : '1'; }
}

function bindActionButtons() {
    document.querySelectorAll('.bind-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const member = membersData.find(m => m.id === id);
            if (!member) return;

            activeMemberId = id; 
            const mTitle = document.getElementById('modalTitle');
            if(mTitle) mTitle.textContent = "Edit Member Profile";
            
            const setVal = (fid, val) => { const el = document.getElementById(fid); if(el) el.value = val || ''; };
            
            setVal('formEmail', member.email);
            const fEmail = document.getElementById('formEmail');
            if(fEmail) fEmail.disabled = true; 
            
            setVal('formName', member.name); setVal('formEmpNo', member.employee_no); setVal('formPhone', member.phone);
            setVal('formDept', member.department); setVal('formPosition', member.position);
            
            let rSys = 'Employee';
            if(member.system_role) { rSys = member.system_role.charAt(0).toUpperCase() + member.system_role.slice(1).toLowerCase(); }
            setVal('formRole', rSys); 
            
            setVal('formGroup', member.group_id);
            setVal('formRate', member.billable_rate || '0.00'); 
            
            let sts = 'Active';
            if(member.status) { sts = member.status.charAt(0).toUpperCase() + member.status.slice(1).toLowerCase(); }
            setVal('formStatus', sts);

            const mModal = document.getElementById('memberModal');
            if(mModal) mModal.style.display = 'flex';
        });
    });

    document.querySelectorAll('.bind-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to delete this employee?')) return;
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await supabase.from('employees').delete().eq('id', id);
                fetchMembers();
            } catch (err) { alert('Delete failed: ' + err.message); }
        });
    });
}

function setupMemberModal() {
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');
    
    // PENYELESAIAN ISU BUTANG X
    const btnClose = document.getElementById('btnCloseModal');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    const btnAdd = document.getElementById('btnAddMember');
    if(btnAdd) {
        btnAdd.addEventListener('click', () => {
            activeMemberId = null; 
            const mTitle = document.getElementById('modalTitle');
            if(mTitle) mTitle.textContent = "Add New Member";
            const fEmail = document.getElementById('formEmail');
            if(fEmail) fEmail.disabled = false;
            if(form) form.reset(); 
            if(modal) modal.style.display = 'flex';
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveMember');
            if(btnSave) btnSave.disabled = true;

            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
            const emailInp = getVal('formEmail');

            const payload = {
                name: getVal('formName') || 'Unknown', 
                employee_no: getVal('formEmpNo'), 
                phone: getVal('formPhone'),
                department: getVal('formDept'), 
                position: getVal('formPosition'), 
                system_role: getVal('formRole') || 'Employee',
                group_id: getVal('formGroup'), 
                billable_rate: parseFloat(getVal('formRate') || 0), 
                status: (getVal('formStatus') || 'ACTIVE').toUpperCase()
            };

            try {
                if (activeMemberId) {
                    await supabase.from('employees').update(payload).eq('id', activeMemberId);
                } else {
                    if(btnSave) btnSave.textContent = "Sending Invite...";
                    const tempPwd = "Pwd" + Math.floor(Math.random() * 100000) + "A!";
                    const { data: auth, error: authErr } = await supabase.auth.signUp({ 
                        email: emailInp, password: tempPwd, options: { data: { full_name: payload.name } } 
                    });
                    if (authErr) throw authErr;
                    if (auth.user) {
                        payload.id = auth.user.id; 
                        payload.email = emailInp;
                        await supabase.from('employees').upsert([payload]);
                    }
                }
                if(modal) modal.style.display = 'none';
                fetchMembers(); 
            } catch (err) { 
                alert('Gagal: ' + err.message); 
            } finally { 
                if(btnSave) { btnSave.textContent = "Save Member"; btnSave.disabled = false; }
            }
        });
    }
}

function setupExcelImport() {
    const btnImp = document.getElementById('btnImportExcel');
    const fInp = document.getElementById('excelFileInput');

    if (btnImp && fInp) {
        btnImp.addEventListener('click', () => fInp.click());
        fInp.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    if(typeof XLSX === 'undefined') return alert('Library XLSX belum dimuat naik. Sila periksa sambungan internet.');
                    const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                    const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    
                    if (excelData.length === 0) return alert("Fail kosong!");
                    alert("Berjaya membaca " + excelData.length + " rekod. Mula mendaftar...");

                    for (const r of excelData) {
                        const gV = (...k) => { const m = Object.keys(r).find(x => k.includes(x.trim().toLowerCase())); return m ? r[m] : null; };
                        const email = gV('email', 'e-mail', 'emel');
                        if (!email) continue;

                        const { data: auth, error: authErr } = await supabase.auth.signUp({
                            email: email, password: gV('password', 'kata laluan') || 'Cranetrack2026', options: { data: { full_name: gV('name', 'nama') || 'User' } }
                        });

                        if (!authErr && auth.user) {
                            await supabase.from('employees').insert({
                                id: auth.user.id, email: email, name: gV('name', 'nama') || 'User',
                                department: gV('department', 'jabatan'), position: gV('position', 'jawatan'),
                                system_role: gV('role', 'peranan') || 'Employee', status: 'ACTIVE'
                            });
                        }
                    }
                    alert("Selesai import!"); fetchMembers();
                } catch (err) { alert("Ralat: " + err.message); }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = ''; 
        });
    }
}

async function fetchGroups() {
    const { data } = await supabase.from('groups').select('id, group_name, description, manager_id, status').order('group_name');
    groupsData = data || [];
    populateGroupDropdowns();
    renderGroupsTable();
}

function renderGroupsTable() {
    const tbody = document.getElementById('groupsTableBody');
    if(!tbody) return;
    
    const sGrp = document.getElementById('searchGroup');
    if(sGrp) {
        sGrp.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            Array.from(tbody.querySelectorAll('tr')).forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(term) ? '' : 'none');
        });
    }

    let html = '';
    groupsData.forEach(g => {
        const count = membersData.filter(m => m.group_id === g.id).length;
        const mgr = membersData.find(m => m.id === g.manager_id);
        const mName = mgr ? mgr.name : '<span class="text-slate-400 font-medium">- No Manager -</span>';
        const stHtml = g.status === 'Active' ? '<span class="status-active"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ACTIVE</span>' : '<span class="status-inactive"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>INACTIVE</span>';

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="p-4 font-bold text-slate-700">' + g.group_name + '</td>' +
            '<td class="p-4 text-sm font-bold text-slate-600">' + mName + '</td>' +
            '<td class="p-4"><span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">' + count + ' members</span></td>' +
            '<td class="p-4">' + stHtml + '</td>' +
            '<td class="p-4 text-center">' +
                (isAdmin ? '<button class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors bind-edit-grp" data-id="' + g.id + '">✏️</button>' : '🔒') +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center py-10 text-slate-400 font-medium">No groups found.</td></tr>';

    document.querySelectorAll('.bind-edit-grp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const group = groupsData.find(g => g.id === id);
            if (!group) return;
            activeGroupId = id;
            
            const gTitle = document.getElementById('groupModalTitle');
            if(gTitle) gTitle.textContent = "Edit Group";
            
            const gName = document.getElementById('formGroupName');
            if(gName) gName.value = group.group_name;
            
            const gDesc = document.getElementById('formGroupDesc');
            if(gDesc) gDesc.value = group.description;
            
            const gMgr = document.getElementById('formGroupManager');
            if(gMgr) gMgr.value = group.manager_id || '';
            
            const gSts = document.getElementById('formGroupStatus');
            if(gSts) gSts.value = group.status;
            
            const gModal = document.getElementById('groupModal');
            if(gModal) gModal.style.display = 'flex';
        });
    });
}

function setupGroupModal() {
    const modal = document.getElementById('groupModal');
    const form = document.getElementById('groupForm');
    
    const btnClose = document.getElementById('btnCloseGroupModal');
    if(btnClose) {
        btnClose.addEventListener('click', () => {
            if(modal) modal.style.display = 'none';
        });
    }
    
    const btnAdd = document.getElementById('btnAddGroup');
    if(btnAdd) {
        btnAdd.addEventListener('click', () => {
            activeGroupId = null; 
            const gTitle = document.getElementById('groupModalTitle');
            if(gTitle) gTitle.textContent = "Create New Group";
            if(form) form.reset(); 
            if(modal) modal.style.display = 'flex';
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const gName = document.getElementById('formGroupName');
            const gDesc = document.getElementById('formGroupDesc');
            const gMgr = document.getElementById('formGroupManager');
            const gSts = document.getElementById('formGroupStatus');

            const payload = {
                group_name: gName ? gName.value : '', 
                description: gDesc ? gDesc.value : '',
                manager_id: gMgr && gMgr.value ? gMgr.value : null, 
                status: gSts ? gSts.value : 'Active'
            };
            try {
                if (activeGroupId) await supabase.from('groups').update(payload).eq('id', activeGroupId);
                else await supabase.from('groups').insert([payload]);
                if(modal) modal.style.display = 'none'; 
                fetchGroups(); 
            } catch (err) { alert("Error: " + err.message); }
        });
    }
}

function populateGroupDropdowns() {
    const sel = document.getElementById('formGroup');
    if(sel) { 
        let html = '<option value="">- No Group -</option>'; 
        groupsData.forEach(g => {
            html += '<option value="' + g.id + '">' + g.group_name + '</option>';
        });
        sel.innerHTML = html;
    }
}

function populateManagerDropdown() {
    const sel = document.getElementById('formGroupManager');
    if(sel) { 
        let html = '<option value="">- Select Manager -</option>'; 
        membersData.filter(m => {
            const r = m.system_role ? m.system_role.toLowerCase() : '';
            return r === 'admin' || r === 'manager' || r === 'supervisor';
        }).forEach(m => {
            html += '<option value="' + m.id + '">' + m.name + '</option>';
        });
        sel.innerHTML = html;
    }
}

import { supabase } from './supabase.js';

let currentEmployeeId = null;
let currentDate = new Date(); 
let tagsDataList = []; 
let tasksDataList = []; // [TAMBAHAN BARU] Menyimpan senarai Task
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

        // 2. Tarik Senarai Task (Kosong / Global)
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
            document.getElementById('timesheetTableBody').innerHTML = '

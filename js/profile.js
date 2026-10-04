import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Semak Sesi Login
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const pEmail = document.getElementById('profileEmail');
        const pName = document.getElementById('profileDataName');
        const pRole = document.getElementById('profileDataRole');

        // Fallback lalai jika data gagal ditarik, supaya tak lekat di "Loading..."
        if (pEmail) pEmail.textContent = session.user.email;
        if (pName) pName.textContent = 'Not Set';
        if (pRole) pRole.textContent = 'User';

        // 2. Tarik Data Profil dari Supabase menggunakan Email dan maybeSingle()
        const { data: profile } = await supabase
            .from('employees')
            .select('name, email, system_role')
            .eq('email', session.user.email)
            .maybeSingle();

        if (profile) {
            if (pEmail) pEmail.textContent = profile.email || session.user.email;
            if (pName) pName.textContent = profile.name || 'Not Set';
            if (pRole) {
                pRole.textContent = profile.system_role === 'Admin' ? 'Administrator' : (profile.system_role || 'User');
                
                // Set warna lencana berdasarkan peranan (Admin = Kuning, User = Hijau)
                if (profile.system_role === 'Admin') {
                    pRole.className = 'px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 font-bold text-[10px] rounded-full uppercase tracking-wider';
                } else {
                    pRole.className = 'px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-[10px] rounded-full uppercase tracking-wider';
                }
            }
        }

    } catch (err) {
        console.error("Profile Init Error:", err);
    }
});

// Fungsi Tukar Password
const pwdForm = document.getElementById('changePwdForm');
if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnUpdatePwd');
        const pwd1 = document.getElementById('newPwd').value;
        const pwd2 = document.getElementById('confirmPwd').value;

        if (pwd1 !== pwd2) return alert("Passwords do not match!");

        if (btn) {
            btn.textContent = "Updating...";
            btn.disabled = true;
        }

        const { error } = await supabase.auth.updateUser({ password: pwd1 });

        if (btn) {
            btn.textContent = "UPDATE PASSWORD";
            btn.disabled = false;
        }

        if (error) {
            alert("Failed: " + error.message);
        } else {
            alert("Success! Password updated.");
            pwdForm.reset();
        }
    });
}

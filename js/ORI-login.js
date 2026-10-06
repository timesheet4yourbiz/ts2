import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    
    const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('logo_url, bg_url')
        .limit(1)
        .single();

    
    if (settingsData) {
        if (settingsData.logo_url) {
            document.getElementById('companyLogo').src = settingsData.logo_url;
        }
        if (settingsData.bg_url) {
            document.getElementById('loginBg').style.backgroundImage = `url('${settingsData.bg_url}')`;
        }
    }

    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'timesheet.html';
    }
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        loginBtn.textContent = 'Signing in...';
        loginBtn.disabled = true;
        errorMessage.style.display = 'none';

        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        if (error) {
            
            errorMessage.textContent = 'Invalid email or password. Please try again.';
            errorMessage.style.display = 'block';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        } else {
            
            const userId = data.user.id;
            const { data: empData } = await supabase
                .from('employees')
                .select('status')
                .eq('id', userId)
                .single();

            
            if (empData && empData.status === 'PENDING') {
                await supabase.auth.signOut();
                errorMessage.textContent = 'Access Denied: Your account is still PENDING Admin/HR approval.';
                errorMessage.style.display = 'block';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
                return;
            }

            
            window.location.href = 'timesheet.html';
        }
    });
});

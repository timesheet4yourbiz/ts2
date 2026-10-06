import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Make sure these IDs match your actual form elements
    const resetForm = document.getElementById('resetForm');
    const newPasswordInput = document.getElementById('newPassword');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        submitBtn.textContent = 'Updating...';
        submitBtn.disabled = true;
        messageBox.style.display = 'none';

        const newPassword = newPasswordInput.value;

        // This Supabase function securely updates the password 
        // using the token from the email link
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            messageBox.textContent = 'Error: ' + error.message;
            messageBox.style.display = 'block';
            messageBox.style.color = '#ef4444'; // Red for error
            submitBtn.textContent = 'Update Password';
            submitBtn.disabled = false;
        } else {
            messageBox.textContent = 'Password updated successfully! Redirecting to login...';
            messageBox.style.display = 'block';
            messageBox.style.color = '#10b981'; // Green for success
            
            // Redirect back to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    });
});

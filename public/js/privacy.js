document.addEventListener("DOMContentLoaded", () => {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) {
        window.location.href = "login1.html";
        return;
    }

    // Redirect if they have already accepted the privacy policy
    if (currentUser.role === "athlete" && currentUser.privacyAccepted === 1) {
        if (!currentUser.onboardingComplete) {
            window.location.href = "onboarding.html";
        } else {
            window.location.href = "index.html";
        }
        return;
    }

    const consentCheckbox = document.getElementById("consentCheckbox");
    const agreeBtn = document.getElementById("agreeBtn");
    const privacyForm = document.getElementById("privacyForm");
    const errorMessage = document.getElementById("error-message");
    const logoutBtn = document.getElementById("logoutLink");
    const navLogoutBtn = document.getElementById("navLogoutBtn");

    // Enable/disable agree button based on checkbox
    consentCheckbox.addEventListener("change", () => {
        agreeBtn.disabled = !consentCheckbox.checked;
    });

    // Form submit
    privacyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!consentCheckbox.checked) {
            errorMessage.textContent = "You must agree to the privacy policy to continue.";
            errorMessage.style.color = "red";
            return;
        }

        try {
            agreeBtn.textContent = "Saving...";
            agreeBtn.disabled = true;
            
            const response = await api.post("/privacy/accept");
            
            if (response.success) {
                // Update local storage
                currentUser.privacyAccepted = 1;
                localStorage.setItem("currentUser", JSON.stringify(currentUser));
                
                errorMessage.textContent = "Consent saved! Redirecting...";
                errorMessage.style.color = "limegreen";

                setTimeout(() => {
                    if (!currentUser.onboardingComplete) {
                        window.location.href = "onboarding.html";
                    } else {
                        window.location.href = "index.html";
                    }
                }, 800);
            } else {
                throw new Error(response.error || "Failed to accept privacy policy");
            }
        } catch (err) {
            agreeBtn.textContent = "I Agree & Continue";
            agreeBtn.disabled = false;
            errorMessage.textContent = err.message || "An error occurred. Please try again.";
            errorMessage.style.color = "red";
        }
    });

    // Handle logout action
    function handleLogout(e) {
        e.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "login1.html";
    }

    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    if (navLogoutBtn) navLogoutBtn.addEventListener("click", handleLogout);
});

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("trainer-signup-form");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const firstname = document.getElementById("firstname").value.trim();
        const lastname = document.getElementById("lastname").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const adminCode = document.getElementById("adminCode").value.trim();

        if (password !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            message.style.color = "#ef4444";
            return;
        }

        try {
            const response = await api.post("/auth/trainer/signup", {
                firstname, lastname, email, password, adminCode
            });

            message.textContent = "Trainer account created! Redirecting...";
            message.style.color = "limegreen";

            // Auto-login
            localStorage.setItem("token", response.token);
            localStorage.setItem("currentUser", JSON.stringify(response.user));

            setTimeout(() => {
                window.location.href = "team-dashboard.html";
            }, 1500);
        } catch (err) {
            message.textContent = err.message || "Signup failed. Check your admin code.";
            message.style.color = "#ef4444";
        }
    });
});

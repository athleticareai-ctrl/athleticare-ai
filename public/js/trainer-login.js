// ================= TRAINER LOGIN =================

document.addEventListener("DOMContentLoaded", () => {
    // Check for existing trainer session
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (token && user && user.role === 'trainer') {
        window.location.href = "team-dashboard.html";
        return;
    }

    const form = document.getElementById("trainer-form");
    const loginMessage = document.getElementById("loginMessage");
    const usernameInput = document.getElementById("trainerUsername");

    // Load remembered trainer email
    const rememberedTrainer = localStorage.getItem("rememberedTrainer");
    if (rememberedTrainer) {
        usernameInput.value = rememberedTrainer;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        let email = document.getElementById("trainerUsername").value.trim();
        const password = document.getElementById("trainerPassword").value;
        const accessCode = document.getElementById("trainerAccessCode").value.trim().toUpperCase();

        // Bridge: allow 'trainer' as a shortcut for 'trainer@school.edu'
        if (email === "trainer") {
            email = "trainer@school.edu";
        }

        try {
            // Success call to the backend
            const response = await api.post("/auth/login", { email, password });
            
            // Verify if user is actually a trainer
            if (response.user.role !== 'trainer') {
                throw new Error("Access denied. This portal is for Athletic Trainers only.");
            }

            // Verify access code
            if (response.user.accessCode !== accessCode) {
                throw new Error("Invalid Team Access Code for this account.");
            }

            // Success - store session
            localStorage.setItem("token", response.token);
            localStorage.setItem("currentUser", JSON.stringify(response.user));
            localStorage.setItem("rememberedTrainer", email);

            loginMessage.textContent = "Login successful! Redirecting...";
            loginMessage.style.color = "limegreen";

            setTimeout(() => {
                window.location.href = "team-dashboard.html";
            }, 1000);
        } catch (err) {
            loginMessage.textContent = err.message || "Invalid credentials. Please try again.";
            loginMessage.style.color = "#ef4444";

            // Shake animation
            form.style.animation = "shake 0.4s ease";
            setTimeout(() => {
                form.style.animation = "";
            }, 400);
        }
    });
});

// Add shake animation to CSS dynamically
const style = document.createElement("style");
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);


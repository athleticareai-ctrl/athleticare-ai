// ================= AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser) {
    window.location.href = "login1.html";
}

// ================= NAVBAR =================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "login1.html";
    });
}

// ================= STATE =================
let scheduleItems = [];
let selectedDays = [];

// ================= DOM ELEMENTS =================
const form = document.getElementById("scheduleForm");
const exerciseNameInput = document.getElementById("exerciseName");
const durationSelect = document.getElementById("duration");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const timeOfDayInput = document.getElementById("timeOfDay");
const notesInput = document.getElementById("notes");
const selectedDaysInput = document.getElementById("selectedDays");
const daysError = document.getElementById("daysError");
const dayBtns = document.querySelectorAll(".day-btn");
const scheduleList = document.getElementById("scheduleList");
const emptyState = document.getElementById("emptyState");
const downloadSection = document.getElementById("downloadSection");
const exerciseCount = document.getElementById("exerciseCount");
const downloadBtn = document.getElementById("downloadBtn");
const toast = document.getElementById("toast");

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
    await loadSchedule();
    renderSchedule();
});

async function loadSchedule() {
    try {
        scheduleItems = await api.get("/schedule");
    } catch (err) {
        console.error("Load schedule failed:", err);
    }
}

// ================= DAY BUTTONS =================
dayBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const day = btn.dataset.day;
        if (selectedDays.includes(day)) {
            selectedDays = selectedDays.filter(d => d !== day);
            btn.classList.remove("selected");
        } else {
            selectedDays.push(day);
            btn.classList.add("selected");
        }
        selectedDaysInput.value = selectedDays.join(",");
        if (selectedDays.length > 0) daysError.classList.remove("show");
    });
});

// ================= FORM SUBMISSION =================
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (selectedDays.length === 0) { daysError.classList.add("show"); return; }
    
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (new Date(endDate) < new Date(startDate)) {
        showToast("End date must be after start date", "error");
        return;
    }

    const item = {
        id: Date.now(),
        name: exerciseNameInput.value.trim(),
        duration: parseInt(durationSelect.value),
        startDate, endDate,
        days: [...selectedDays],
        time: timeOfDayInput.value,
        notes: notesInput.value.trim()
    };

    scheduleItems.push(item);
    try {
        await api.post("/schedule", { items: scheduleItems });
        resetForm();
        renderSchedule();
        showToast("Exercise added to schedule!", "success");
    } catch (err) {
        showToast("Failed to save schedule", "error");
    }
});

function renderSchedule() {
    if (scheduleItems.length === 0) {
        emptyState.classList.remove("hidden");
        scheduleList.innerHTML = "";
        downloadSection.classList.add("hidden");
        return;
    }
    emptyState.classList.add("hidden");
    exerciseCount.textContent = scheduleItems.length;
    downloadSection.classList.remove("hidden");
    
    scheduleList.innerHTML = scheduleItems.map(item => `
        <div class="schedule-item">
            <div class="schedule-item-header">
                <h3>${escapeHtml(item.name)}</h3>
                <span>${item.duration} min</span>
            </div>
            <div class="schedule-item-details">
                <div>Days: ${item.days.join(", ")}</div>
                <div>Time: ${item.time}</div>
            </div>
            <div class="schedule-item-actions">
                <button class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
            </div>
        </div>
    `).join("");
}

window.removeItem = async function(id) {
    scheduleItems = scheduleItems.filter(item => item.id !== id);
    try {
        await api.post("/schedule", { items: scheduleItems });
        renderSchedule();
        showToast("Exercise removed", "success");
    } catch (err) {
        showToast("Failed to update schedule", "error");
    }
};

function resetForm() {
    form.reset();
    selectedDays = [];
    dayBtns.forEach(b => b.classList.remove("selected"));
}

function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
function showToast(m, t="success") { toast.textContent = m; toast.className = `toast ${t} show`; setTimeout(() => toast.classList.remove("show"), 3000); }

// ICS logic (keep existing)
downloadBtn.addEventListener("click", () => {
    // ... existing generateICS and downloadICS logic ...
});

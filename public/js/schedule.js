// ================= AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    window.location.href = "login1.html";
}

// ================= NAVBAR =================
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login1.html";
});

// ================= SCHEDULE STORAGE =================
const SCHEDULE_KEY = `schedule_${currentUser.email}`;
let scheduleItems = JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || [];

// ================= DOM ELEMENTS =================
const form = document.getElementById("scheduleForm");
const exerciseNameInput = document.getElementById("exerciseName");
const durationSelect = document.getElementById("duration");
const timeOfDayInput = document.getElementById("timeOfDay");
const notesInput = document.getElementById("notes");
const selectedDaysInput = document.getElementById("selectedDays");
const daysError = document.getElementById("daysError");
const dayBtns = document.querySelectorAll(".day-btn");

const emptyState = document.getElementById("emptyState");
const scheduleList = document.getElementById("scheduleList");
const downloadSection = document.getElementById("downloadSection");
const exerciseCount = document.getElementById("exerciseCount");
const downloadBtn = document.getElementById("downloadBtn");

const toast = document.getElementById("toast");

// ================= STATE =================
let selectedDays = [];

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

        // Update hidden input
        selectedDaysInput.value = selectedDays.join(",");

        // Clear error if days selected
        if (selectedDays.length > 0) {
            daysError.classList.remove("show");
        }
    });
});

// ================= FORM SUBMISSION =================
form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Validate days
    if (selectedDays.length === 0) {
        daysError.classList.add("show");
        return;
    }

    // Create schedule item
    const item = {
        id: Date.now(),
        name: exerciseNameInput.value.trim(),
        duration: parseInt(durationSelect.value),
        days: [...selectedDays],
        time: timeOfDayInput.value,
        notes: notesInput.value.trim()
    };

    // Add to schedule
    scheduleItems.push(item);
    saveSchedule();

    // Reset form
    resetForm();

    // Update UI
    renderSchedule();

    // Show success toast
    showToast("Exercise added to schedule!", "success");
});

// ================= RESET FORM =================
function resetForm() {
    exerciseNameInput.value = "";
    durationSelect.value = "";
    timeOfDayInput.value = "";
    notesInput.value = "";
    selectedDays = [];
    selectedDaysInput.value = "";

    dayBtns.forEach(btn => {
        btn.classList.remove("selected");
    });

    daysError.classList.remove("show");
}

// ================= SAVE TO LOCALSTORAGE =================
function saveSchedule() {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleItems));
}

// ================= RENDER SCHEDULE =================
function renderSchedule() {
    if (scheduleItems.length === 0) {
        emptyState.classList.remove("hidden");
        scheduleList.innerHTML = "";
        downloadSection.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    scheduleList.innerHTML = "";
    exerciseCount.textContent = scheduleItems.length;
    downloadSection.classList.remove("hidden");

    scheduleList.innerHTML = scheduleItems.map(item => `
        <div class="schedule-item" data-id="${item.id}">
            <div class="schedule-item-header">
                <h3 class="schedule-item-title">${escapeHtml(item.name)}</h3>
                <span class="schedule-item-duration">${formatDuration(item.duration)}</span>
            </div>
            <div class="schedule-item-details">
                <div class="schedule-item-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    ${formatDays(item.days)}
                </div>
                <div class="schedule-item-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    ${formatTime(item.time)}
                </div>
            </div>
            ${item.notes ? `<div class="schedule-item-notes">${escapeHtml(item.notes)}</div>` : ""}
            <div class="schedule-item-actions">
                <button class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
            </div>
        </div>
    `).join("");
}

// ================= REMOVE ITEM =================
window.removeItem = function(id) {
    scheduleItems = scheduleItems.filter(item => item.id !== id);
    saveSchedule();
    renderSchedule();
    showToast("Exercise removed", "success");
};

// ================= FORMAT HELPERS =================
function formatDuration(minutes) {
    if (minutes >= 60) {
        const hours = minutes / 60;
        return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    return `${minutes} min`;
}

function formatDays(days) {
    const dayNames = {
        MO: "Mon",
        TU: "Tue",
        WE: "Wed",
        TH: "Thu",
        FR: "Fri",
        SA: "Sat",
        SU: "Sun"
    };
    return days.map(d => dayNames[d]).join(", ");
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ================= TOAST NOTIFICATION =================
function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// ================= ICS GENERATION =================
downloadBtn.addEventListener("click", () => {
    if (scheduleItems.length === 0) {
        showToast("Add exercises first!", "error");
        return;
    }

    const icsContent = generateICS();
    downloadICS(icsContent);
    showToast("Schedule downloaded!", "success");
});

function generateICS() {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AthletiCare AI//Scheduling//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ];

    // Get current date for DTSTART calculation
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Day mapping (ICS: SU=0, MO=1, TU=2, WE=3, TH=4, FR=5, SA=6)
    const dayToNum = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

    scheduleItems.forEach((item, index) => {
        item.days.forEach(day => {
            const targetDay = dayToNum[day];

            // Calculate days until next occurrence of this day
            let daysUntil = targetDay - currentDay;
            if (daysUntil < 0) daysUntil += 7;
            if (daysUntil === 0) daysUntil = 7; // If today, schedule for next week

            // Calculate start date
            const startDate = new Date(now);
            startDate.setDate(now.getDate() + daysUntil);

            // Parse time
            const [hours, minutes] = item.time.split(":").map(Number);
            startDate.setHours(hours, minutes, 0, 0);

            // Calculate end time
            const endDate = new Date(startDate);
            endDate.setMinutes(endDate.getMinutes() + item.duration);

            // Format dates for ICS (YYYYMMDDTHHMMSS)
            const formatICSDate = (date) => {
                return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            };

            // Unique ID for this event
            const uid = `exercise-${item.id}-${day}-${index}@athleticare.ai`;

            // Create event
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
            lines.push(`DTSTART:${formatICSDate(startDate)}`);
            lines.push(`DTEND:${formatICSDate(endDate)}`);
            lines.push(`SUMMARY:${escapeICS(item.name)}`);
            lines.push(`DESCRIPTION:${escapeICS(item.notes || "AthletiCare AI Exercise")}`);
            lines.push("RRULE:FREQ=WEEKLY");
            lines.push("TRANSP:OPAQUE");
            lines.push("STATUS:CONFIRMED");
            lines.push("END:VEVENT");
        });
    });

    lines.push("END:VCALENDAR");

    return lines.join("\r\n");
}

function escapeICS(text) {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
}

function downloadICS(content) {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `athleticare-schedule-${currentUser.firstname}.ics`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// ================= INITIALIZATION =================
renderSchedule();

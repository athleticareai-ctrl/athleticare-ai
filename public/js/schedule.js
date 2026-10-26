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

// the schedule is saved in this browser, one list per user
const storageKey = "schedule_" + (currentUser && currentUser.email ? currentUser.email : "guest");

const dayNames = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
const dayIndex = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

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

// ================= SAVE / LOAD =================
function loadSchedule() {
    try {
        scheduleItems = JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (err) {
        scheduleItems = [];
    }
}

function saveSchedule() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(scheduleItems));
        return true;
    } catch (err) {
        console.error("Save schedule failed:", err);
        return false;
    }
}

// ================= INITIALIZATION =================
loadSchedule();
renderSchedule();

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
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
        daysError.classList.add("show");
        return;
    }

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (endDate < startDate) {
        showToast("End date must be after start date", "error");
        return;
    }

    // keep days in Mon to Sun order no matter what order they were clicked
    const order = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
    const days = order.filter(d => selectedDays.includes(d));

    const item = {
        id: Date.now(),
        name: exerciseNameInput.value.trim(),
        duration: parseInt(durationSelect.value, 10),
        startDate,
        endDate,
        days,
        time: timeOfDayInput.value,
        notes: notesInput.value.trim()
    };

    scheduleItems.push(item);
    if (saveSchedule()) {
        resetForm();
        renderSchedule();
        showToast("Exercise added to schedule", "success");
    } else {
        scheduleItems.pop();
        showToast("Couldn't save. Check that your browser allows site storage.", "error");
    }
});

// ================= RENDER =================
function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

const calIcon = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

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
                <span class="schedule-item-title">${escapeHtml(item.name)}</span>
                <span class="schedule-item-duration">${item.duration} min</span>
            </div>
            <div class="schedule-item-details">
                <span class="schedule-item-detail">${calIcon}${item.days.map(d => dayNames[d]).join(", ")}</span>
                <span class="schedule-item-detail">${calIcon}${formatDate(item.startDate)} to ${formatDate(item.endDate)}</span>
                <span class="schedule-item-detail">${clockIcon}${formatTime(item.time)}</span>
            </div>
            ${item.notes ? `<div class="schedule-item-notes">${escapeHtml(item.notes)}</div>` : ""}
            <div class="schedule-item-actions">
                <button type="button" class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
            </div>
        </div>
    `).join("");
}

window.removeItem = function (id) {
    scheduleItems = scheduleItems.filter(item => item.id !== id);
    saveSchedule();
    renderSchedule();
    showToast("Exercise removed", "success");
};

function resetForm() {
    form.reset();
    selectedDays = [];
    selectedDaysInput.value = "";
    dayBtns.forEach(b => b.classList.remove("selected"));
}

function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}

function showToast(m, t = "success") {
    toast.textContent = m;
    toast.className = `toast ${t} show`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ================= CALENDAR FILE (.ics) =================

// text in .ics files has to escape commas, semicolons, and new lines
function icsText(s) {
    return String(s || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

function pad(n) {
    return String(n).padStart(2, "0");
}

// first date on or after the start date that lands on one of the chosen days
function firstOccurrence(item) {
    const [y, m, d] = item.startDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const wanted = item.days.map(day => dayIndex[day]);
    for (let i = 0; i < 7; i++) {
        if (wanted.includes(date.getDay())) break;
        date.setDate(date.getDate() + 1);
    }
    return date;
}

function buildICS(items) {
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AthletiCare AI//Recovery Schedule//EN",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:AthletiCare Recovery"
    ];

    items.forEach(item => {
        const first = firstOccurrence(item);
        const [hh, mm] = (item.time || "08:00").split(":");
        const start = `${first.getFullYear()}${pad(first.getMonth() + 1)}${pad(first.getDate())}T${pad(hh)}${pad(mm)}00`;
        const until = item.endDate.replace(/-/g, "") + "T235959";

        lines.push(
            "BEGIN:VEVENT",
            `UID:${item.id}@athleticareai.com`,
            `DTSTAMP:${stamp}`,
            `DTSTART:${start}`,
            `DURATION:PT${item.duration}M`,
            `RRULE:FREQ=WEEKLY;BYDAY=${item.days.join(",")};UNTIL=${until}`,
            `SUMMARY:${icsText(item.name)}`,
            `DESCRIPTION:${icsText(item.notes ? item.notes : "Recovery exercise from AthletiCare AI")}`,
            "BEGIN:VALARM",
            "TRIGGER:-PT15M",
            "ACTION:DISPLAY",
            `DESCRIPTION:${icsText(item.name)}`,
            "END:VALARM",
            "END:VEVENT"
        );
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
}

downloadBtn.addEventListener("click", () => {
    if (scheduleItems.length === 0) {
        showToast("Add an exercise first", "error");
        return;
    }
    const blob = new Blob([buildICS(scheduleItems)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "athleticare-recovery-schedule.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Schedule downloaded. Open the file to add it to your calendar.", "success");
});

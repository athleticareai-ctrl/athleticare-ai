// ================= AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    window.location.href = "about.html";
}

// ================= STORAGE (PER USER) =================
const CHAT_STORAGE_KEY = `chats_${currentUser.email}`;

// ================= NAVBAR =================
const navActions = document.getElementById("nav-actions");

navActions.innerHTML = `
  <span class="nav-user">Hi, ${currentUser.firstname}</span>
  <a href="#" id="logoutBtn">Logout</a>
`;

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login1.html";
});

// ================= STATE =================
let chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
let activeChatId = chats.length ? chats[0].id : null;

const chatList = document.getElementById("chatList");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");

// ================= HELPERS =================
function saveChats() {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
}

function summarizeTitle(text) {
    return text
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .split(" ")
        .slice(0, 4)
        .join(" ");
}

// ================= RENDER SIDEBAR =================
function renderChats() {
    chatList.innerHTML = "";

    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = "chat-item";

        if (chat.id === activeChatId) {
            li.classList.add("active");
        }

        li.textContent = chat.title;
        li.addEventListener("click", () => openChat(chat.id));

        chatList.appendChild(li);
    });
}

// ================= OPEN CHAT =================
function openChat(id) {
    activeChatId = id;
    chatMessages.innerHTML = "";

    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    chat.messages.forEach(m => {
        addMessage(m.role, m.text);
    });

    renderChats();
}

// ================= MESSAGE UI (SAFE) =================
function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;

    // ✅ Safe markdown rendering (never crashes)
    if (window.marked) {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ================= CREATE NEW CHAT =================
function createNewChat() {
    const newChat = {
        id: Date.now(),
        title: "New Injury Chat",
        messages: []
    };

    chats.unshift(newChat);
    activeChatId = newChat.id;

    saveChats();
    chatMessages.innerHTML = "";
    renderChats();
}

// ================= SEND MESSAGE =================
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    if (!activeChatId) {
        createNewChat();
    }

    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    if (chat.messages.length === 0) {
        chat.title = summarizeTitle(text);
    }

    chat.messages.push({ role: "user", text });
    addMessage("user", text);
    userInput.value = "";

    saveChats();
    renderChats();

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: chat.messages.map(m => ({
                    role: m.role === "bot" ? "assistant" : "user",
                    content: m.text
                }))
            })
        });

        const data = await response.json();

        if (!data.reply) {
            throw new Error("No AI reply");
        }

        chat.messages.push({ role: "bot", text: data.reply });
        addMessage("bot", data.reply);

        saveChats();
    } catch (err) {
        console.error("Chat error:", err);
        addMessage(
            "bot",
            "Sorry — I’m having trouble responding right now. Please try again."
        );
    }
}

// ================= EVENTS =================
sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

newChatBtn.addEventListener("click", createNewChat);

// ================= MOBILE SIDEBAR =================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

const overlay = document.createElement("div");
overlay.classList.add("overlay");
document.body.appendChild(overlay);

sidebarToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
});

overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
});

// ================= INIT =================
renderChats();
if (activeChatId) openChat(activeChatId);




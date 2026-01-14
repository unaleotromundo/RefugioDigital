// script.js
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

// El prompt del Maestro Uruguayo
const SYSTEM_PROMPT = `Actúa como un licenciado en Derecho por la Universidad de Buenos Aires, doctor en Filosofía (Universidad Complutense de Madrid, en Antropología (Universitat Rovira i Virgili de Tarragona, en Psicología (Universidad Ramon Llull, en Historia (Universidad de Lérida), Teología (Universidad de Murcia), Matemática Aplicada (Universidad de Alicante) y Educación (Universidad Ramon Llull). Y sobre todo Maestro y fundador de Escuelas de capacitacion de cábala hebrea. Hablame siempre como un uruguayo. utiliza los conceptos pero no nombres nunca la cabala ni los judíos, cuando dicen hola responde cortito y al pie. cuando hacen una pregunta expande tu respuesta lo que consideres necesario y termina las respuestas con una pregunta que invite a profundizar en algun aspecto importante del tema. no utilices dialectos como "bo" porque a los mayores no les gusta e intenta siempre hablar sin referirte a un genero femenino o masculino específicamente porque no sabemos quien está escribiendo.`;

let currentChatId = null;
let chatHistory = [];

// --- INICIALIZACIÓN ---
function init() {
    loadHistoryList();
    const savedChats = getSavedChats();
    if (savedChats.length > 0) {
        loadChat(savedChats[0].id);
    } else {
        createNewChat();
    }
}

// --- GESTIÓN DE SESIONES ---
function createNewChat() {
    currentChatId = Date.now();
    chatHistory = [];
    chatBox.innerHTML = '';
    appendBubble("Hola. Soy tu espejo digital. En este espacio no existen los juicios, solo la comprensión. ¿Qué necesitas soltar o entender hoy?", false, false);
    saveCurrentChat();
    loadHistoryList();
    toggleHistory(false);
}

function getSavedChats() {
    return JSON.parse(localStorage.getItem('refugio_chats') || '[]');
}

function saveCurrentChat() {
    let chats = getSavedChats();
    const chatIndex = chats.findIndex(c => c.id === currentChatId);
    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + "...";

    const chatData = {
        id: currentChatId,
        title: title,
        date: new Date().toLocaleDateString(),
        history: chatHistory
    };

    if (chatIndex > -1) chats[chatIndex] = chatData;
    else chats.unshift(chatData);

    localStorage.setItem('refugio_chats', JSON.stringify(chats));
}

function loadChat(id) {
    const chats = getSavedChats();
    const chat = chats.find(c => c.id === id);
    if (chat) {
        currentChatId = chat.id;
        chatHistory = chat.history;
        renderMessages();
        loadHistoryList();
        toggleHistory(false);
    }
}

function deleteChat(id, event) {
    event.stopPropagation();
    let chats = getSavedChats().filter(c => c.id !== id);
    localStorage.setItem('refugio_chats', JSON.stringify(chats));
    if (currentChatId === id) createNewChat();
    else loadHistoryList();
}

// --- INTERFAZ ---
function toggleHistory(show) {
    const sidebar = document.getElementById('history-sidebar');
    if (show) sidebar.classList.remove('-translate-x-full');
    else sidebar.classList.add('-translate-x-full');
}

function loadHistoryList() {
    const chats = getSavedChats();
    historyList.innerHTML = chats.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" onclick="loadChat(${chat.id})">
            <div class="title">${chat.title}</div>
            <div class="flex justify-between items-center opacity-60">
                <span class="text-[10px] font-bold">${chat.date}</span>
                <button onclick="deleteChat(${chat.id}, event)" class="text-[10px] text-red-500 font-bold hover:underline">Borrar</button>
            </div>
        </div>
    `).join('');
}

function renderMessages() {
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => {
        appendBubble(msg.parts[0].text, msg.role === "user", false);
    });
}

function appendBubble(text, isUser, save = true) {
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? "flex flex-col items-end w-full" : "flex flex-col items-start w-full";
    wrapper.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${!isUser ? 'italic' : ''}">${text.replace(/\n/g, '<br>')}</div>`;
    chatBox.appendChild(wrapper);

    if (save) {
        chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text: text }] });
        saveCurrentChat();
    }

    if (!isUser) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatBox.scrollTop = chatBox.scrollHeight;
}

// --- ENVÍO USANDO EL PROXY DE VERCEL (Igual que el Hub) ---
async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    appendBubble(userText, true);
    chatInput.value = '';

    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "flex flex-col items-start w-full";
    typingDiv.innerHTML = `<div class="bubble bubble-ai opacity-50">El espejo busca la luz...</div>`;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // PREPARAMOS LOS MENSAJES PARA TU API /api/gemini
        // Añadimos el SYSTEM_PROMPT al inicio y simulamos una respuesta para mantener el orden user-model
        const payloadContents = [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Soy tu espejo digital y te hablaré con la sabiduría solicitada. ¿Qué quieres reflexionar?" }] },
            ...chatHistory
        ];

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: payloadContents 
            })
        });

        const data = await response.json();

        if (document.getElementById(typingId)) document.getElementById(typingId).remove();

        if (data.success) {
            appendBubble(data.text, false);
        } else {
            throw new Error(data.error || "Error en el espejo");
        }

    } catch (e) {
        console.error("Error de conexión:", e);
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        appendBubble("El espejo se ha empañado. Respira hondo y vuelve a intentarlo en unos segundos.", false);
    }
}

// Eventos
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });

init();
// script.js
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

// CONFIGURACIÓN DE MODELO DICIEMBRE 2025
const MODELO_ACTUAL = 'gemini-3-flash-preview'; 

const SYSTEM_PROMPT = `Actuá como un sabio uruguayo, experto en psicología, filosofía y leyes. Sos "El Espejo Digital". 
Hablás de forma cálida, humana y directa. IMPORTANTE: Tenés memoria. Si el usuario ya te saludó, NO vuelvas a saludar. 
Mantené el hilo de la charla con sabiduría. No seas repetitivo.`;

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
    renderMessages();
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
        if (msg.parts[0].text !== SYSTEM_PROMPT) {
            appendBubble(msg.parts[0].text, msg.role === "user", false);
        }
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

// --- ENVÍO CON ROTACIÓN DE LLAVES ANTI-ERROR 429 ---
async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    appendBubble(userText, true);
    chatInput.value = '';

    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "flex flex-col items-start w-full";
    typingDiv.innerHTML = `<div class="bubble bubble-ai opacity-50">El espejo busca la luz para responderte...</div>`;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Obtener llaves y mezclarlas para rotar
    let keys = [...(CONFIG.GEMINI_API_KEYS || [])].sort(() => Math.random() - 0.5);
    let success = false;
    let aiResponse = "";

    // BUCLE DE REINTENTO: Prueba cada llave antes de rendirse
    for (let key of keys) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_ACTUAL}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                        ...chatHistory
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                aiResponse = data.candidates[0].content.parts[0].text;
                success = true;
                break; // Si funciona, rompemos el bucle y enviamos respuesta
            } else {
                const errData = await response.json();
                console.warn("Llave saturada o con error, probando la siguiente...", errData);
                // Si es un error 429, esperamos 1 segundo para no "quemar" la siguiente llave tan rápido
                if (response.status === 429) await new Promise(r => setTimeout(r, 1000));
                continue; 
            }
        } catch (e) {
            console.error("Error de red, probando siguiente llave...");
        }
    }

    if (document.getElementById(typingId)) document.getElementById(typingId).remove();

    if (success) {
        appendBubble(aiResponse, false);
    } else {
        appendBubble("El espejo se ha empañado con la bruma del camino. Respira hondo, espera un minuto y vuelve a intentarlo. No estás solo.", false);
    }
}

// Eventos
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });

init();
// script.js - Versión Refugio Completo (Historial Local + Respaldo Total en Supabase)
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

// Inicializar cliente Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const SYSTEM_PROMPT = `Actúa como un licenciado en Derecho por la Universidad de Buenos Aires, doctor en Filosofía (Universidad Complutense de Madrid, en Antropología (Universitat Rovira i Virgili de Tarragona, en Psicología (Universidad Ramon Llull, en Historia (Universidad de Lérida), Teología (Universidad de Murcia), Matemática Aplicada (Universidad de Alicante) y Educación (Universidad Ramon Llull). Y sobre todo Maestro y fundador de Escuelas de capacitacion de cábala hebrea. Hablame siempre como un uruguayo. utiliza los conceptos pero no nombres nunca la cabala ni los judíos, cuando dicen hola responde cortito y al pie. cuando hacen una pregunta expande tu respuesta lo que consideres necesario y termina las respuestas con una pregunta que invite a profundizar en algun aspecto importante del tema. no utilices dialectos como "bo" porque a los mayores no les gusta e intenta siempre hablar sin referirte a un genero femenino o masculino especificamente porque no sabemos quien está escribiendo. las personas llegan a vos porque quieren hacerte una pregunta sobre un problema o una situacion o para reflexionar sobre algo.`;

let currentChatId = null;
let chatHistory = []; // Aquí se guarda toda la conversación (User + AI)
let currentUser = null;

// --- INICIALIZACIÓN ---
async function init() {
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
        if (authError) throw authError;
        currentUser = authData.user;

        const localChats = getLocalChats();
        
        if (localChats.length > 0) {
            await loadChat(localChats[0].id);
        } else {
            await createNewChat();
        }
        
        await refreshHistoryUI();
    } catch (err) {
        console.error("Error en inicialización:", err);
        if (!currentChatId) createNewChat();
    }
}

// --- GESTIÓN DE DATOS LOCALES ---
function getLocalChats() {
    return JSON.parse(localStorage.getItem('refugio_chats') || '[]');
}

function saveLocalChat(chatData) {
    let localChats = getLocalChats();
    const index = localChats.findIndex(c => c.id === chatData.id);
    if (index > -1) {
        localChats[index] = chatData;
    } else {
        localChats.unshift(chatData);
    }
    localStorage.setItem('refugio_chats', JSON.stringify(localChats));
}

// --- GUARDADO COMPLETO (LOCAL + SUPABASE) ---
async function saveCurrentChat() {
    if (!currentChatId || chatHistory.length === 0) return;

    // Buscamos el primer mensaje del usuario para el título
    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + (firstMsg.length > 35 ? "..." : "");

    const chatData = {
        id: currentChatId,
        user_id: currentUser?.id,
        title: title,
        history: chatHistory, // Enviamos el array completo con preguntas y respuestas
        updated_at: new Date().toISOString()
    };

    // 1. Actualizar historial visual del usuario (LocalStorage)
    saveLocalChat(chatData);

    // 2. Respaldar en Supabase (Se guarda TODO el objeto history)
    if (currentUser) {
        const { error } = await supabaseClient.from('chats').upsert(chatData);
        if (error) console.error("Error al respaldar en Supabase:", error);
    }
    
    await refreshHistoryUI();
}

// --- FUNCIONES DEL CHAT ---
async function createNewChat() {
    currentChatId = Date.now();
    chatHistory = [];
    renderMessages();
    // Mensaje de bienvenida (no se guarda en BD para no ensuciar)
    appendBubble("Hola. Soy tu espejo digital. En este espacio no existen los juicios, solo la comprensión. ¿Qué necesitas soltar o entender hoy?", false, false);
    toggleHistory(false);
}

async function loadChat(id) {
    const localChats = getLocalChats();
    const chat = localChats.find(c => c.id == id);
    if (chat) {
        currentChatId = chat.id;
        chatHistory = chat.history || [];
        renderMessages();
        toggleHistory(false);
        refreshHistoryUI();
    }
}

async function deleteChat(id, event) {
    event.stopPropagation();
    if (!confirm("¿Deseas borrar esta reflexión para siempre?")) return;

    if (currentUser) {
        await supabaseClient.from('chats').delete().eq('id', id);
    }

    let localChats = getLocalChats().filter(c => c.id != id);
    localStorage.setItem('refugio_chats', JSON.stringify(localChats));

    if (currentChatId == id) {
        await createNewChat();
    } else {
        await refreshHistoryUI();
    }
}

function renderMessages() {
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => {
        // No renderizamos el prompt del sistema
        if (msg.role !== "system" && msg.parts[0].text !== SYSTEM_PROMPT) {
            appendBubble(msg.parts[0].text, msg.role === "user", false);
        }
    });
}

// Esta función es la que añade los globos y dispara el guardado
function appendBubble(text, isUser, shouldSave = true) {
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? "flex flex-col items-end w-full" : "flex flex-col items-start w-full";
    
    const formattedText = text.replace(/\n/g, '<br>');
    
    wrapper.innerHTML = `
        <div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${!isUser ? 'italic' : ''}">
            ${formattedText}
        </div>
    `;
    chatBox.appendChild(wrapper);

    if (shouldSave) {
        // Guardamos el mensaje en el array global
        chatHistory.push({ 
            role: isUser ? "user" : "model", 
            parts: [{ text: text }] 
        });
        // Disparamos el guardado en Supabase y LocalStorage
        saveCurrentChat();
    }

    if (!isUser) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatBox.scrollTop = chatBox.scrollHeight;
}

// --- ENVIAR A GEMINI ---
async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // 1. Añadimos la pregunta del usuario (esto ya dispara un saveCurrentChat)
    appendBubble(userText, true);
    chatInput.value = '';

    // Indicador de "escribiendo..."
    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "flex flex-col items-start w-full";
    typingDiv.innerHTML = `<div class="bubble bubble-ai opacity-50">El espejo busca la luz...</div>`;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                    ...chatHistory
                ]
            })
        });

        const data = await response.json();
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();

        if (data.success) {
            // 2. Añadimos la respuesta del Espejo (esto dispara otro saveCurrentChat con el diálogo completo)
            appendBubble(data.text, false);
        } else {
            appendBubble("Parece que el espejo está empañado. Intentá de nuevo en unos minutos.", false);
        }
    } catch (error) {
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        appendBubble("No pude conectar con el servidor. Revisá tu conexión.", false);
    }
}

// --- INTERFAZ Y EVENTOS ---
function refreshHistoryUI() {
    const chats = getLocalChats();
    historyList.innerHTML = chats.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" onclick="loadChat(${chat.id})">
            <div class="title">${chat.title}</div>
            <div class="flex justify-between items-center opacity-60">
                <span class="text-[10px] font-bold">${new Date(chat.updated_at).toLocaleDateString()}</span>
                <button onclick="deleteChat(${chat.id}, event)" class="text-[10px] text-red-500 font-bold hover:underline">Borrar</button>
            </div>
        </div>
    `).join('');
}

function toggleHistory(show) {
    const sidebar = document.getElementById('history-sidebar');
    if (show) sidebar.classList.remove('-translate-x-full');
    else sidebar.classList.add('-translate-x-full');
}

sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        send(); 
    } 
});

// Iniciar aplicación
init();
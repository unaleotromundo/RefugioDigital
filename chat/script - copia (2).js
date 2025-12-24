// script.js - Versión segura con API en servidor
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

// Inicializar cliente Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const SYSTEM_PROMPT = `Actúa como un licenciado en Derecho por la Universidad de Buenos Aires, doctor en Filosofía (Universidad Complutense de Madrid, en Antropología (Universitat Rovira i Virgili de Tarragona, en Psicología (Universidad Ramon Llull, en Historia (Universidad de Lérida), Teología (Universidad de Murcia), Matemática Aplicada (Universidad de Alicante) y Educación (Universidad Ramon Llull). Y sobre todo Maestro y fundador de Escuelas de capacitacion de cábala hebrea. Hablame siempre como un uruguayo. utiliza los conceptos pero no nombres nunca la cabala ni los judíos, cuando dicen hola responde cortito y al pie. cuando hacen una pregunta expande tu respuesta lo que consideres necesario y termina las respuestas con una pregunta que invite a profundizar en algun aspecto importante del tema. no utilices dialectos como "bo" porque a los mayores no les gusta e intenta siempre hablar sin referirte a un genero femenino o masculino especificamente porque no sabemos quien está escribiendo. las personas llegan a vos porque quieren hacerte una pregunta sobre un problema o una situacion o para reflexionar sobre algo.`;

let currentChatId = null;
let chatHistory = [];
let currentUser = null;

// --- INICIALIZACIÓN ---
async function init() {
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
        if (authError) throw authError;
        currentUser = authData.user;

        await refreshHistoryUI();
        
        const chats = await getSavedChats();
        if (chats.length > 0) {
            await loadChat(chats[0].id);
        } else {
            await createNewChat();
        }
    } catch (err) {
        console.error("Error en inicialización:", err);
        createNewChat();
    }
}

// --- GESTIÓN DE DATOS ---
async function getSavedChats() {
    if (currentUser) {
        const { data, error } = await supabaseClient
            .from('chats')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error) return data;
    }
    return JSON.parse(localStorage.getItem('refugio_chats') || '[]');
}

async function saveCurrentChat() {
    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + (firstMsg.length > 35 ? "..." : "");

    const chatData = {
        id: currentChatId,
        user_id: currentUser.id,
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    };

    if (currentUser) {
        await supabaseClient.from('chats').upsert(chatData);
    }

    let localChats = JSON.parse(localStorage.getItem('refugio_chats') || '[]');
    const index = localChats.findIndex(c => c.id === currentChatId);
    if (index > -1) localChats[index] = chatData;
    else localChats.unshift(chatData);
    localStorage.setItem('refugio_chats', JSON.stringify(localChats));
}

async function createNewChat() {
    currentChatId = Date.now();
    chatHistory = [];
    renderMessages();
    appendBubble("Hola. Soy tu espejo digital. En este espacio no existen los juicios, solo la comprensión. ¿Qué necesitas soltar o entender hoy?", false, false);
    await saveCurrentChat();
    await refreshHistoryUI();
    toggleHistory(false);
}

async function loadChat(id) {
    const chats = await getSavedChats();
    const chat = chats.find(c => c.id == id);
    if (chat) {
        currentChatId = chat.id;
        chatHistory = chat.history;
        renderMessages();
        await refreshHistoryUI();
        toggleHistory(false);
    }
}

async function deleteChat(id, event) {
    event.stopPropagation();
    if (!confirm("¿Deseas borrar esta reflexión para siempre?")) return;

    if (currentUser) {
        await supabaseClient.from('chats').delete().eq('id', id);
    }

    let localChats = JSON.parse(localStorage.getItem('refugio_chats') || '[]').filter(c => c.id != id);
    localStorage.setItem('refugio_chats', JSON.stringify(localChats));

    if (currentChatId == id) {
        await createNewChat();
    } else {
        await refreshHistoryUI();
    }
}

// --- INTERFAZ DE USUARIO ---
async function refreshHistoryUI() {
    const chats = await getSavedChats();
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

function renderMessages() {
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => {
        if (msg.role !== "system" && msg.parts[0].text !== SYSTEM_PROMPT) {
            appendBubble(msg.parts[0].text, msg.role === "user", false);
        }
    });
}

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
        chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text: text }] });
        saveCurrentChat();
    }

    if (!isUser) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatBox.scrollTop = chatBox.scrollHeight;
}

// --- COMUNICACIÓN CON GEMINI (AHORA A TRAVÉS DE VERCEL) ---
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
        // Llamar a la función serverless de Vercel
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                    ...chatHistory
                ]
            })
        });

        const data = await response.json();

        if (document.getElementById(typingId)) {
            document.getElementById(typingId).remove();
        }

        if (data.success) {
            appendBubble(data.text, false);
            await saveCurrentChat();
        } else {
            appendBubble("El espejo se siente pesado hoy. Las claves de acceso parecen estar agotadas. Por favor, contacta al administrador.", false);
        }
    } catch (error) {
        if (document.getElementById(typingId)) {
            document.getElementById(typingId).remove();
        }
        console.error("Error al conectar con el servidor:", error);
        appendBubble("No pude conectar con el servidor. Verifica tu conexión a internet.", false);
    }
}

// --- EVENTOS ---
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        send(); 
    } 
});

// Iniciar app
init();
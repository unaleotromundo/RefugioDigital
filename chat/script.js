// script.js - Sincronizado con el Panel de Estudio
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

// 1. Inicializar Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const SYSTEM_PROMPT = `Actúa como un licenciado en Derecho por la Universidad de Buenos Aires, doctor en Filosofía (Universidad Complutense de Madrid, en Antropología (Universitat Rovira i Virgili de Tarragona, en Psicología (Universidad Ramon Llull, en Historia (Universidad de Lérida), Teología (Universidad de Murcia), Matemática Aplicada (Universidad de Alicante) y Educación (Universidad Ramon Llull). Y sobre todo Maestro y fundador de Escuelas de capacitacion de cábala hebrea. Hablame siempre como un uruguayo. utiliza los conceptos pero no nombres nunca la cabala ni los judíos, cuando dicen hola responde cortito y al pie. cuando hacen una pregunta expande tu respuesta lo que consideres necesario y termina las respuestas con una pregunta que invite a profundizar en algun aspecto importante del tema. no utilices dialectos como "bo" porque a los mayores no les gusta e intenta siempre hablar sin referirte a un genero femenino o masculino especificamente porque no sabemos quien está escribiendo.`;

let currentChatId = null;
let chatHistory = [];
let currentUser = null;

// --- INICIALIZACIÓN ---
async function init() {
    try {
        // Loguear anónimamente para tener permiso de escritura
        const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
        if (authError) throw authError;
        currentUser = authData.user;
        console.log("Sesión iniciada como:", currentUser.id);

        await refreshHistoryUI();
        
        const chats = await getSavedChats();
        if (chats.length > 0) {
            await loadChat(chats[0].id);
        } else {
            await createNewChat();
        }
    } catch (err) {
        console.error("Error en inicialización:", err);
        // Fallback si falla Supabase
        currentChatId = Date.now();
        appendBubble("Hola. Soy tu espejo digital. ¿Qué necesitas entender hoy?", false, false);
    }
}

// --- GESTIÓN DE DATOS (SUPABASE + LOCAL) ---
async function getSavedChats() {
    // Intentar traer de Supabase primero para estar sincronizado con el visor
    if (currentUser) {
        const { data, error } = await supabaseClient
            .from('chats')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error && data.length > 0) return data;
    }
    // Si no hay internet o no hay datos, usar local
    return JSON.parse(localStorage.getItem('refugio_chats') || '[]');
}

async function saveCurrentChat() {
    if (!currentChatId) return;

    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + (firstMsg.length > 35 ? "..." : "");

    const chatData = {
        id: currentChatId, // Date.now() funciona bien con int8 en Supabase
        user_id: currentUser ? currentUser.id : null,
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    };

    // 1. Guardar en Supabase (Para el visor)
    if (currentUser) {
        const { error } = await supabaseClient
            .from('chats')
            .upsert(chatData, { onConflict: 'id' });
        
        if (error) console.error("Error al sincronizar con la nube:", error.message);
        else console.log("✅ Sincronizado con el Panel de Estudio");
    }

    // 2. Guardar en Local (Para rapidez del usuario)
    let localChats = JSON.parse(localStorage.getItem('refugio_chats') || '[]');
    const index = localChats.findIndex(c => c.id === currentChatId);
    if (index > -1) localChats[index] = chatData;
    else localChats.unshift(chatData);
    localStorage.setItem('refugio_chats', JSON.stringify(localChats));
}

async function createNewChat() {
    currentChatId = Date.now();
    chatHistory = [];
    chatBox.innerHTML = '';
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

// --- INTERFAZ ---
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

function renderMessages() {
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => {
        if (msg.role !== "system") {
            appendBubble(msg.parts[0].text, msg.role === "user", false);
        }
    });
}

function appendBubble(text, isUser, shouldSave = true) {
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? "flex flex-col items-end w-full" : "flex flex-col items-start w-full";
    wrapper.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${!isUser ? 'italic' : ''}">${text.replace(/\n/g, '<br>')}</div>`;
    chatBox.appendChild(wrapper);

    if (shouldSave) {
        chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text: text }] });
        saveCurrentChat();
    }

    if (!isUser) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatBox.scrollTop = chatBox.scrollHeight;
}

// --- ENVÍO A GEMINI ---
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
            appendBubble(data.text, false);
            await saveCurrentChat(); // Guardamos respuesta de la IA
        }
    } catch (e) {
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        appendBubble("El espejo se ha empañado. Inténtalo de nuevo.", false);
    }
}

// --- EVENTOS ---
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
function toggleHistory(show) {
    document.getElementById('history-sidebar').classList.toggle('-translate-x-full', !show);
}

init();
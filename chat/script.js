// Conversación y archivo personal
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const historyList = document.getElementById('history-list');

let supabaseClient = null;
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    }
} catch (error) {
    console.error("No se pudo iniciar la sincronización en la nube:", error);
}

const SYSTEM_PROMPT = `Respondé en español rioplatense claro y cercano. Conversá desde una posición horizontal: no afirmes tener títulos, experiencia personal ni respuestas definitivas. Escuchá lo que la persona plantea, reconocé la incertidumbre y ofrecé ideas como posibilidades, no como órdenes. Si saludan, respondé breve. Si preguntan algo, explicá lo necesario sin alargar por costumbre y, cuando aporte, cerrá con una pregunta abierta. No diagnostiques ni reemplaces atención profesional. Si aparece una situación de riesgo inmediato, alentá a buscar ayuda humana y servicios de emergencia de su zona.`;

let currentChatId = null;
let chatHistory = [];
let currentUser = null;

// --- INICIALIZACIÓN ---
async function init() {
    try {
        if (supabaseClient) {
            const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
            if (authError) throw authError;
            currentUser = authData.user;
            console.log("Sesión anónima iniciada.");
        }

        // Cargar solo los chats de ESTE usuario
        const chats = await getSavedChats();
        if (chats.length > 0) {
            await loadChat(chats[0].id);
        } else {
            await createNewChat();
        }
        await refreshHistoryUI();
    } catch (err) {
        console.error("Error en conexión:", err);
        // Fallback local si falla la red
        if (!currentChatId) await createNewChat();
    }
}

// --- GESTIÓN DE DATOS PRIVADOS ---
async function getSavedChats() {
    if (!currentUser) return JSON.parse(localStorage.getItem('refugio_chats') || '[]');

    try {
        // FILTRO DE PRIVACIDAD: Solo traemos chats donde user_id sea igual al ID del usuario actual
        const { data, error } = await supabaseClient
            .from('chats')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error al obtener historial privado:", e);
        return JSON.parse(localStorage.getItem('refugio_chats') || '[]');
    }
}

async function saveCurrentChat() {
    if (!currentChatId) return;

    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + (firstMsg.length > 35 ? "..." : "");

    const chatData = {
        id: currentChatId,
        user_id: currentUser?.id,
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    };

    if (supabaseClient && currentUser) {
        try {
            const { error } = await supabaseClient.from('chats').upsert(chatData, { onConflict: 'id' });
            if (error) throw error;
        } catch (error) {
            console.error("No se pudo sincronizar el chat; queda guardado en este dispositivo:", error);
        }
    }

    // 2. Respaldo en LocalStorage
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
    appendBubble("Hola. Podemos ir de a poco. ¿Qué te gustaría poner en palabras?", false, false);
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
    if (!confirm("¿Deseas borrar esta reflexión?")) return;

    try {
        if (currentUser) {
            await supabaseClient.from('chats').delete().eq('id', id).eq('user_id', currentUser.id);
        }
        let localChats = JSON.parse(localStorage.getItem('refugio_chats') || '[]').filter(c => c.id != id);
        localStorage.setItem('refugio_chats', JSON.stringify(localChats));

        if (currentChatId == id) await createNewChat();
        else await refreshHistoryUI();
    } catch (e) {
        console.error("Error al borrar:", e);
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
    const bubble = document.createElement('div');
    bubble.className = `bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${!isUser ? 'italic' : ''}`;
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);

    if (shouldSave) {
        chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text: text }] });
        saveCurrentChat();
    }

    if (!isUser) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatBox.scrollTop = chatBox.scrollHeight;
}

// --- CONEXIÓN CON EL MAESTRO (API) ---
async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    appendBubble(userText, true);
    chatInput.value = '';

    if (window.location.protocol === 'file:') {
        appendBubble("La conversación con IA necesita que abras Conexión desde el sitio publicado: https://refugiodigital.vercel.app/chat/. Esta copia local puede guardar el historial, pero no conectarse al servicio.", false, false);
        return;
    }

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

        const responseBody = await response.text();
        let data;
        try {
            data = JSON.parse(responseBody);
        } catch {
            throw new Error(`El servicio respondió con un formato inesperado (HTTP ${response.status}).`);
        }
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();

        if (!response.ok) {
            throw new Error(data.error || `El servicio respondió con HTTP ${response.status}.`);
        }

        if (data.success) {
            appendBubble(data.text, false);
        } else {
            throw new Error(data.error || "El servicio no pudo generar una respuesta.");
        }
    } catch (e) {
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        console.error("Error API:", e);
        appendBubble(`No pudimos conectar con el servicio de conversación. ${e.message} Tu mensaje queda en el historial de este dispositivo.`, false, false);
    }
}

// --- UTILIDADES ---
function toggleHistory(show) {
    document.getElementById('history-sidebar').classList.toggle('-translate-x-full', !show);
}

// Eventos
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

// Iniciar aplicación
init();
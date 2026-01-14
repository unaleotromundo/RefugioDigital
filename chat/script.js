// script.js - PRIVACIDAD TOTAL Y SINCRONIZACIÓN CON SUPABASE
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
        // Autenticación Anónima: Crea un ID único para este usuario/navegador
        const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
        if (authError) throw authError;
        currentUser = authData.user;
        console.log("Sesión privada iniciada.");

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
        if (!currentChatId) createNewChat();
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
    if (!currentChatId || !currentUser) return;

    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Nueva reflexión";
    const title = firstMsg.substring(0, 35) + (firstMsg.length > 35 ? "..." : "");

    const chatData = {
        id: currentChatId,
        user_id: currentUser.id, // Vinculamos el chat al usuario
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    };

    // 1. Sincronizar con Supabase
    try {
        await supabaseClient.from('chats').upsert(chatData, { onConflict: 'id' });
    } catch (e) {
        console.error("Error de sincronización nube:", e);
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
    wrapper.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${!isUser ? 'italic' : ''}">${text.replace(/\n/g, '<br>')}</div>`;
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
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        console.error("Error API:", e);
        appendBubble("El espejo se ha empañado. Prueba de nuevo en unos instantes.", false);
    }
}

// --- UTILIDADES ---
function toggleHistory(show) {
    document.getElementById('history-sidebar').classList.toggle('-translate-x-full', !show);
}

// Eventos
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

// Iniciar aplicación
init();
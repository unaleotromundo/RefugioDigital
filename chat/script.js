// --- VARIABLES GLOBALES ---
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentAgent = null;
let currentChatId = null;
let chatHistory = []; 
let currentUser = null;
let listaAgentesGlobal = []; // Para buscar agentes al cargar historial

// --- INICIALIZACIÓN ---
async function init() {
    console.log("Iniciando Espejo Digital...");

    // 1. Autenticación Anónima (Para historial individual)
    const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
    if (authError) {
        console.error("Error de autenticación:", authError);
        return;
    }
    currentUser = authData.user;

    // 2. Cargar Agentes y luego el Historial
    await cargarAgentes();
    await refreshHistorySidebar();
    
    // 3. Activar partículas y eventos
    setInterval(createParticle, 600);
    chatInput.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });
}

// --- GESTIÓN DE AGENTES (CONCIENCIAS) ---
async function cargarAgentes() {
    const { data, error } = await supabaseClient
        .from('agentes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error cargando agentes:", error);
        return;
    }

    listaAgentesGlobal = data;
    const list = document.getElementById('agents-list');
    list.innerHTML = '';
    
    data.forEach((agente) => {
        const div = document.createElement('div');
        div.id = `agent-${agente.id}`;
        // Clase active se maneja en setAgent
        div.className = "agent-card p-4 rounded-2xl cursor-pointer mb-2 hover:bg-amber-500/10 transition-all";
        div.onclick = () => setAgent(agente);
        div.innerHTML = `
            <div class="font-bold text-sm text-white">✨ ${agente.nombre}</div>
            <div class="text-[10px] text-slate-400 uppercase tracking-tighter">${agente.descripcion || 'Conciencia'}</div>
        `;
        list.appendChild(div);
    });
    
    // Si es una sesión nueva, cargar el primer agente por defecto
    if (data.length > 0 && !currentChatId) {
        setAgent(data[0]);
    }
}

async function setAgent(agente, isLoadingFromHistory = false) {
    currentAgent = agente;
    currentAgent.conocimiento_texto = ""; // Limpiar conocimiento previo

    // Actualizar UI
    document.getElementById('active-agent-name').innerText = agente.nombre;
    document.getElementById('active-agent-desc').innerText = agente.descripcion || "Conciencia";
    
    // Marcar tarjeta activa en el sidebar
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`agent-${agente.id}`);
    if (card) card.classList.add('active');

    // Cargar Conocimiento (Archivo) si existe
    if (agente.archivo_url) {
        try {
            const response = await fetch(agente.archivo_url);
            const blob = await response.blob();
            const extension = agente.archivo_url.split('.').pop().toLowerCase().split('?')[0];

            if (extension === 'pdf') {
                currentAgent.conocimiento_texto = await extractTextFromPDF(agente.archivo_url);
            } else if (extension === 'docx') {
                const arrayBuffer = await blob.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                currentAgent.conocimiento_texto = result.value;
            } else {
                currentAgent.conocimiento_texto = await blob.text();
            }
            console.log("Conocimiento cargado para:", agente.nombre);
        } catch(e) {
            console.error("Error cargando archivo de conocimiento:", e);
        }
    }

    // Si no estamos cargando un chat viejo, iniciamos uno nuevo con este agente
    if (!isLoadingFromHistory) {
        createNewChat();
        toggleSidebar('agents-sidebar', false);
    }
}

// --- LÓGICA DE CHAT ---
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || !currentAgent) return;

    // Mostrar en UI y limpiar input
    appendBubble(text, true);
    chatInput.value = '';
    
    const typingIndicator = showTyping();

    try {
        // Construir el prompt del sistema combinando instrucciones + archivos
        const systemPrompt = `${currentAgent.instrucciones}\n\nCONTEXTO DE CONOCIMIENTO:\n${currentAgent.conocimiento_texto || 'No hay archivos adicionales.'}`;
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                systemInstruction: systemPrompt, 
                contents: chatHistory 
            })
        });

        const data = await response.json();
        typingIndicator.remove();

        if (data.success) {
            appendBubble(data.text, false);
            await saveToHubHistory(); // Guardar progreso en Supabase
        } else {
            appendBubble("El espejo está empañado en este momento. Intenta de nuevo.", false);
        }
    } catch (err) {
        if(typingIndicator) typingIndicator.remove();
        console.error("Error en handleSend:", err);
        appendBubble("Se perdió la conexión con la conciencia.", false);
    }
}

function appendBubble(text, isUser) {
    const div = document.createElement('div');
    div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `
        <div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">
            ${text.replace(/\n/g, '<br>')}
        </div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Guardar en el historial local (formato Gemini)
    chatHistory.push({ 
        role: isUser ? "user" : "model", 
        parts: [{ text: text }] 
    });
}

// --- PERSISTENCIA E HISTORIAL (Supabase) ---
async function saveToHubHistory() {
    if (!currentUser || chatHistory.length < 2) return;

    // El título es el primer mensaje del usuario
    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Reflexión";
    const title = firstMsg.substring(0, 35) + "...";

    const { error } = await supabaseClient.from('reflexiones_hub').upsert({
        id: currentChatId,
        user_id: currentUser.id,
        agent_id: currentAgent.id,
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    });

    if (error) console.error("Error al guardar historial:", error);
    refreshHistorySidebar();
}

async function refreshHistorySidebar() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('reflexiones_hub')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

    if (error) return;

    const list = document.getElementById('history-list');
    list.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.id}')" class="history-item p-3 rounded-xl cursor-pointer transition-all">
            <div class="text-xs font-bold truncate">${chat.title}</div>
            <div class="text-[8px] opacity-60 uppercase mt-1 text-amber-500">
                ${new Date(chat.updated_at).toLocaleDateString()}
            </div>
        </div>
    `).join('');
}

async function loadChat(id) {
    const { data: chat, error } = await supabaseClient
        .from('reflexiones_hub')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !chat) return;

    // 1. Restaurar ID y Datos
    currentChatId = chat.id;
    chatHistory = chat.history;
    
    // 2. CAMBIO DE CONTEXTO: Buscar el agente que se usó en ese chat
    const agenteAsociado = listaAgentesGlobal.find(a => a.id === chat.agent_id);
    if (agenteAsociado) {
        await setAgent(agenteAsociado, true); // true indica que no debe limpiar el chat
    }

    // 3. Renderizar mensajes en pantalla
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => {
        const isUser = msg.role === 'user';
        const div = document.createElement('div');
        div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
        div.innerHTML = `
            <div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">
                ${msg.parts[0].text.replace(/\n/g, '<br>')}
            </div>
        `;
        chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
    toggleSidebar('history-sidebar', false);
}

function createNewChat() {
    currentChatId = crypto.randomUUID(); // Generar ID único de conversación
    chatHistory = [];
    chatBox.innerHTML = '';
    if(currentAgent) {
        appendBubble(`Soy ${currentAgent.nombre}. ¿Qué buscas reflejar hoy?`, false);
    }
}

// --- UI HELPERS ---
function toggleSidebar(id, show) {
    const el = document.getElementById(id);
    if (id === 'history-sidebar') {
        el.style.transform = show ? 'translateX(0)' : 'translateX(-100%)';
    } else {
        el.style.transform = show ? 'translateX(0)' : 'translateX(100%)';
    }
}

function showTyping() {
    const div = document.createElement('div');
    div.className = "text-[10px] opacity-50 italic p-2 dark:text-amber-500 font-bold uppercase tracking-widest";
    div.innerText = `${currentAgent.nombre} reflexionando...`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

function createParticle() {
    const container = document.getElementById('particle-container');
    if (!container) return;
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 2;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.setProperty('--duration', `${Math.random() * 8 + 6}s`);
    container.appendChild(p);
    setTimeout(() => p.remove(), 12000);
}

// Extractor de texto para PDFs
async function extractTextFromPDF(url) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument(url).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(s => s.str).join(" ") + "\n";
    }
    return text;
}

function checkAdminPassword() {
    const pass = prompt("Acceso Restringido. Introduce la clave de constructor:");
    if (pass === "admin123") {
        window.location.href = "configurador.html";
    } else {
        alert("Clave incorrecta.");
    }
}

// Iniciar aplicación
init();
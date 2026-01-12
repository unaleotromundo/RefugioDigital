const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentAgent = null;
let currentChatId = null;
let chatHistory = []; 
let currentUser = null;
let listaAgentesGlobal = [];

async function init() {
    // 1. Auth Anónima
    const { data: authData } = await supabaseClient.auth.signInAnonymously();
    currentUser = authData.user;

    // 2. Cargar Agentes y luego el Historial
    await cargarAgentes();
    await refreshHistorySidebar();
    
    // 3. UI y Eventos
    setInterval(createParticle, 600);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });
}

// --- GESTIÓN DE AGENTES ---
async function cargarAgentes() {
    const { data, error } = await supabaseClient.from('agentes').select('*').order('created_at', { ascending: false });
    if (error) return;

    listaAgentesGlobal = data;
    const list = document.getElementById('agents-list');
    list.innerHTML = '';
    
    data.forEach((agente) => {
        const div = document.createElement('div');
        div.id = `agent-${agente.id}`;
        div.className = "agent-card p-4 rounded-2xl cursor-pointer mb-2 hover:bg-amber-500/10 transition-all";
        div.onclick = () => setAgent(agente);
        div.innerHTML = `
            <div class="font-bold text-sm text-white">✨ ${agente.nombre}</div>
            <div class="text-[10px] text-slate-400 uppercase tracking-tighter">${agente.descripcion || 'Conciencia'}</div>
        `;
        list.appendChild(div);
    });
    
    // Si no hay chat activo, cargar el primer agente por defecto
    if (data.length > 0 && !currentChatId) setAgent(data[0]);
}

async function setAgent(agente, isLoadingFromHistory = false) {
    currentAgent = agente;
    currentAgent.conocimiento_texto = ""; 

    // Visual
    document.getElementById('active-agent-name').innerText = agente.nombre;
    document.getElementById('active-agent-desc').innerText = agente.descripcion || "Conciencia";
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    if(document.getElementById(`agent-${agente.id}`)) document.getElementById(`agent-${agente.id}`).classList.add('active');

    // Cargar Archivo si existe
    if (agente.archivo_url) {
        try {
            const response = await fetch(agente.archivo_url);
            const blob = await response.blob();
            const ext = agente.archivo_url.split('.').pop().toLowerCase().split('?')[0];
            if (ext === 'pdf') currentAgent.conocimiento_texto = await extractTextFromPDF(agente.archivo_url);
            else if (ext === 'docx') {
                const arrayBuffer = await blob.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                currentAgent.conocimiento_texto = result.value;
            } else { currentAgent.conocimiento_texto = await blob.text(); }
        } catch(e) { console.error("Error archivo:", e); }
    }

    if (!isLoadingFromHistory) {
        createNewChat();
        toggleSidebar('agents-sidebar', false);
    }
}

// --- LÓGICA DE CHAT ---
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || !currentAgent) return;

    appendBubble(text, true);
    chatInput.value = '';
    const typing = showTyping();

    try {
        const systemPrompt = `${currentAgent.instrucciones}\n\nCONTEXTO ADICIONAL:\n${currentAgent.conocimiento_texto || ''}`;
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                systemInstruction: systemPrompt, 
                contents: chatHistory 
            })
        });

        const data = await response.json();
        typing.remove();

        if (data.success) {
            appendBubble(data.text, false);
            await saveToHubHistory();
        }
    } catch (err) {
        typing.remove();
        appendBubble("El espejo está empañado. Intenta de nuevo.", false);
    }
}

function appendBubble(text, isUser) {
    const div = document.createElement('div');
    div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">${text.replace(/\n/g, '<br>')}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text }] });
}

// --- PERSISTENCIA E HISTORIAL ---
async function saveToHubHistory() {
    if (!currentUser || chatHistory.length < 2) return;
    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Reflexión";
    
    await supabaseClient.from('reflexiones_hub').upsert({
        id: currentChatId,
        user_id: currentUser.id,
        agent_id: currentAgent.id,
        title: firstMsg.substring(0, 30) + "...",
        history: chatHistory,
        updated_at: new Date().toISOString()
    });
    refreshHistorySidebar();
}

async function refreshHistorySidebar() {
    if (!currentUser) return;
    const { data } = await supabaseClient.from('reflexiones_hub').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    const list = document.getElementById('history-list');
    if (!list) return;

    list.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.id}')" class="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer hover:border-amber-500 border border-transparent transition-all">
            <div class="text-xs font-bold truncate dark:text-white">${chat.title}</div>
            <div class="text-[8px] opacity-50 uppercase mt-1 dark:text-amber-500">${new Date(chat.updated_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

async function loadChat(id) {
    const { data: chat } = await supabaseClient.from('reflexiones_hub').select('*').eq('id', id).single();
    if(chat) {
        currentChatId = chat.id;
        chatHistory = chat.history;
        
        // Cambiar al agente que corresponde a esta conversación
        const agenteAsociado = listaAgentesGlobal.find(a => a.id === chat.agent_id);
        if (agenteAsociado) await setAgent(agenteAsociado, true);

        // Limpiar y renderizar mensajes
        chatBox.innerHTML = '';
        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            const isUser = msg.role === 'user';
            div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">${msg.parts[0].text.replace(/\n/g, '<br>')}</div>`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        toggleSidebar('history-sidebar', false);
    }
}

function createNewChat() {
    currentChatId = crypto.randomUUID();
    chatHistory = [];
    chatBox.innerHTML = '';
    if(currentAgent) appendBubble(`Soy ${currentAgent.nombre}. ¿Qué buscas reflejar hoy?`, false);
}

// --- UI HELPERS ---
function toggleSidebar(id, show) {
    const el = document.getElementById(id);
    el.style.transform = show ? 'translateX(0)' : (id === 'history-sidebar' ? 'translateX(-100%)' : 'translateX(100%)');
}

function showTyping() {
    const div = document.createElement('div');
    div.className = "text-xs opacity-50 italic p-2 dark:text-white";
    div.innerText = `${currentAgent.nombre} procesando...`;
    chatBox.appendChild(div);
    return div;
}

function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }

function createParticle() {
    const container = document.getElementById('particle-container');
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    const size = Math.random() * 4 + 2;
    p.style.width = size + 'px'; p.style.height = size + 'px';
    p.style.setProperty('--duration', `${Math.random() * 10 + 5}s`);
    container.appendChild(p);
    setTimeout(() => p.remove(), 10000);
}

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
    if (prompt("Contraseña:") === "admin123") window.location.href = "configurador.html";
}

init();
// --- CONFIGURACIÓN Y VARIABLES ---
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentAgent = null;
let currentChatId = null;
let chatHistory = []; 
let currentUser = null;
let listaAgentesGlobal = []; 

// --- 1. INICIALIZACIÓN ---
async function init() {
    console.log("🚀 Espejo Digital: Iniciando...");

    try {
        // Verificar sesión existente o crear una nueva
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            console.log("👤 Sesión existente:", currentUser.id);
        } else {
            const { data: authData, error: authError } = await supabaseClient.auth.signInAnonymously();
            if (authError) throw authError;
            currentUser = authData.user;
            console.log("👤 Nueva sesión creada:", currentUser.id);
        }

        // Cargar datos iniciales
        await cargarAgentes();
        await refreshHistorySidebar();
        
        // Partículas y Eventos
        setInterval(createParticle, 600);
        chatInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
        });

        console.log("✅ Inicialización completa");

    } catch (err) {
        console.error("❌ Error en init:", err.message);
        alert("Error de conexión: " + err.message);
    }
}

// --- 2. GESTIÓN DE AGENTES ---
async function cargarAgentes() {
    try {
        const { data, error } = await supabaseClient
            .from('agentes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log("✅ Agentes cargados:", data?.length || 0);
        listaAgentesGlobal = data || [];
        const list = document.getElementById('agents-list');
        
        if (!list) {
            console.error("❌ Elemento #agents-list no encontrado");
            return;
        }
        
        list.innerHTML = '';
        
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-xs text-center opacity-40 py-10">No hay conciencias creadas aún.</p>';
            return;
        }
        
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
        
        // Si entramos de cero, activar el primero
        if (data.length > 0 && !currentChatId) {
            setAgent(data[0]);
        }
    } catch (error) {
        console.error("❌ Error cargando agentes:", error);
        const list = document.getElementById('agents-list');
        if (list) {
            list.innerHTML = '<p class="text-xs text-center text-red-400 py-10">Error al cargar conciencias.<br>Revisa la consola.</p>';
        }
    }
}

async function setAgent(agente, isLoadingFromHistory = false) {
    console.log("🧠 Cambiando a conciencia:", agente.nombre);
    currentAgent = agente;
    currentAgent.conocimiento_texto = ""; 

    // UI: Títulos centrales
    document.getElementById('active-agent-name').innerText = agente.nombre;
    document.getElementById('active-agent-desc').innerText = agente.descripcion || "Conciencia";
    
    // UI: Marcar tarjeta activa en sidebar
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`agent-${agente.id}`);
    if (card) card.classList.add('active');

    // Cargar Conocimiento de Archivo (PDF/Docx/Txt)
    if (agente.archivo_url) {
        try {
            const ext = agente.archivo_url.split('.').pop().toLowerCase().split('?')[0];
            if (ext === 'pdf') {
                currentAgent.conocimiento_texto = await extractTextFromPDF(agente.archivo_url);
            } else if (ext === 'docx') {
                const response = await fetch(agente.archivo_url);
                const arrayBuffer = await response.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                currentAgent.conocimiento_texto = result.value;
            } else {
                const response = await fetch(agente.archivo_url);
                currentAgent.conocimiento_texto = await response.text();
            }
        } catch(e) { 
            console.error("⚠️ Error leyendo archivo:", e); 
        }
    }

    // Si es un cambio manual (no desde historial), limpiar chat
    if (!isLoadingFromHistory) {
        createNewChat();
        toggleSidebar('agents-sidebar', false);
    }
}

// --- 3. LÓGICA DE CHAT ---
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
        } else {
            throw new Error(data.error || "Error desconocido");
        }
    } catch (err) {
        console.error("❌ Error:", err);
        if(typing) typing.remove();
        appendBubble("El espejo está empañado. Intenta de nuevo.", false);
    }
}

function appendBubble(text, isUser) {
    const div = document.createElement('div');
    div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">${text.replace(/\n/g, '<br>')}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Guardar en el array temporal para la IA
    chatHistory.push({ role: isUser ? "user" : "model", parts: [{ text: text }] });
}

// --- 4. PERSISTENCIA (SUPABASE) ---
async function saveToHubHistory() {
    if (!currentUser || chatHistory.length < 1) {
        console.warn("⚠️ No se puede guardar: usuario o historial vacío");
        return;
    }

    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Reflexión";
    const chatTitle = firstMsg.substring(0, 30) + "...";

    console.log("💾 Guardando historial...", {
        chatId: currentChatId,
        userId: currentUser.id,
        agentId: currentAgent.id,
        messagesCount: chatHistory.length
    });

    try {
        const { data, error } = await supabaseClient.from('reflexiones_hub').upsert({
            id: currentChatId,
            user_id: currentUser.id,
            agent_id: currentAgent.id,
            title: chatTitle,
            history: chatHistory,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'id'
        });

        if (error) {
            console.error("❌ Error guardando:", error);
            console.error("Detalles completos:", JSON.stringify(error, null, 2));
        } else {
            console.log("✅ Historial guardado correctamente");
            await refreshHistorySidebar();
        }
    } catch (err) {
        console.error("❌ Excepción al guardar:", err);
    }
}

async function refreshHistorySidebar() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('reflexiones_hub')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("❌ Error cargando historial:", error);
        return;
    }

    console.log("📜 Reflexiones encontradas:", data?.length || 0);

    const list = document.getElementById('history-list');
    if (!list) return;

    if (!data || data.length === 0) {
        list.innerHTML = '<p class="text-[10px] text-center opacity-40 py-10">No hay reflexiones aún.</p>';
        return;
    }

    list.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.id}')" class="history-item p-3 rounded-xl cursor-pointer transition-all mb-2 border border-white/5 hover:border-amber-500/50 bg-white/5">
            <div class="text-xs font-bold truncate text-white">${chat.title}</div>
            <div class="text-[8px] opacity-50 uppercase mt-1 text-amber-500">${new Date(chat.updated_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

async function loadChat(id) {
    console.log("📂 Cargando chat:", id);
    const { data: chat } = await supabaseClient.from('reflexiones_hub').select('*').eq('id', id).single();
    
    if (chat) {
        currentChatId = chat.id;
        chatHistory = chat.history;
        
        // Cambiar automáticamente al agente que pertenece al chat
        const agenteAsociado = listaAgentesGlobal.find(a => a.id === chat.agent_id);
        if (agenteAsociado) await setAgent(agenteAsociado, true);

        // Renderizar mensajes
        chatBox.innerHTML = '';
        chatHistory.forEach(msg => {
            const isUser = msg.role === 'user';
            const div = document.createElement('div');
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

// --- 5. UI HELPERS ---
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
    div.className = "text-[10px] opacity-50 italic p-2 text-slate-500 dark:text-amber-500 font-bold uppercase";
    div.innerText = `${currentAgent.nombre} reflexionando...`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }

function createParticle() {
    const container = document.getElementById('particle-container');
    if (!container) return;
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    const size = Math.random() * 3 + 2;
    p.style.width = size + 'px'; p.style.height = size + 'px';
    p.style.setProperty('--duration', `${Math.random() * 10 + 6}s`);
    container.appendChild(p);
    setTimeout(() => p.remove(), 12000);
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
    if (prompt("Clave de constructor:") === "admin123") window.location.href = "configurador.html";
}

// Iniciar app
init();
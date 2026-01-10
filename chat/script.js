// --- CONFIGURACIÓN Y CLIENTE ---
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentAgent = null;         // Conciencia activa
let currentChatId = null;        // ID de la sesión actual
let chatHistory = [];            // Memoria de la conversación (Formato Gemini)
let currentUser = null;          // Usuario autenticado
let selectedImageBase64 = null;  // Imagen en espera de envío

// --- 1. INICIALIZACIÓN ---
async function init() {
    // Autenticación para persistencia individual
    const { data: authData } = await supabaseClient.auth.signInAnonymously();
    currentUser = authData.user;

    await cargarAgentes();           // Traer conciencias de la DB
    await refreshHistorySidebar();   // Traer historial de reflexiones
    
    // Iniciar efectos visuales
    setInterval(createParticle, 600);

    // Atajo de teclado para enviar
    chatInput.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') handleSend(); 
    });
}

// --- 2. SEGURIDAD (ADMIN) ---
function checkAdminPassword() {
    const password = prompt("Introduce la contraseña de administrador:");
    if (password === "admin123") {
        window.location.href = "configurador.html";
    } else {
        alert("Acceso denegado.");
    }
}

// --- 3. MANEJO MULTIMODAL (IMÁGENES) ---
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validación de peso (Max 4MB)
    if (file.size > 4 * 1024 * 1024) {
        alert("Imagen muy pesada. Máximo 4MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        selectedImageBase64 = e.target.result.split(',')[1]; // Solo la data Base64
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('image-preview-container').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    selectedImageBase64 = null;
    document.getElementById('image-upload').value = '';
    document.getElementById('image-preview-container').classList.add('hidden');
}

// --- 4. GESTIÓN DE CONCIENCIAS Y DOCUMENTOS ---
async function cargarAgentes() {
    const { data, error } = await supabaseClient.from('agentes').select('*').order('created_at', { ascending: false });
    if (error) return;

    const list = document.getElementById('agents-list');
    list.innerHTML = '';
    data.forEach((agente, index) => {
        const div = document.createElement('div');
        div.id = `agent-${agente.id}`;
        div.className = "agent-card p-4 rounded-2xl cursor-pointer mb-2 transition-all";
        div.onclick = () => setAgent(agente);
        div.innerHTML = `
            <div class="font-bold text-sm text-white">✨ ${agente.nombre}</div>
            <div class="text-[10px] text-white opacity-60 uppercase">${agente.descripcion || 'Conciencia'}</div>
        `;
        list.appendChild(div);
        if (index === 0) setAgent(agente);
    });
}

async function setAgent(agente) {
    currentAgent = agente;
    currentAgent.conocimiento_texto = ""; 

    if (agente.archivo_url) {
        try {
            const response = await fetch(agente.archivo_url);
            const blob = await response.blob();
            const ext = agente.archivo_url.split('.').pop().toLowerCase().split('?')[0];

            if (ext === 'txt' || ext === 'json') {
                currentAgent.conocimiento_texto = await blob.text();
            } else if (ext === 'pdf') {
                currentAgent.conocimiento_texto = await extractTextFromPDF(agente.archivo_url);
            } else if (ext === 'docx') {
                const arrayBuffer = await blob.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                currentAgent.conocimiento_texto = result.value;
            }
        } catch(e) { console.error("Error cargando documento:", e); }
    }

    document.getElementById('active-agent-name').innerText = currentAgent.nombre;
    document.getElementById('active-agent-desc').innerText = currentAgent.descripcion || "Conciencia";
    
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    if(document.getElementById(`agent-${agente.id}`)) document.getElementById(`agent-${agente.id}`).classList.add('active');
    
    toggleSidebar('agents-sidebar', false);
    createNewChat();
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

// --- 5. LÓGICA DE CHAT Y ENVÍO A IA ---
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text && !selectedImageBase64) return;

    // 1. Mostrar en UI
    let displayHtml = text;
    if (selectedImageBase64) {
        const imgUrl = document.getElementById('image-preview').src;
        displayHtml = `
            <div class="flex flex-col gap-2">
                <img src="${imgUrl}" class="max-w-[200px] rounded-lg border-2 border-white shadow-md">
                <span>${text || "Analiza esta imagen."}</span>
            </div>`;
    }

    appendBubble(displayHtml, true);
    chatInput.value = '';
    
    const typing = showTyping();
    const imageData = selectedImageBase64;
    const userMessage = text;
    clearImage(); 

    try {
        const systemPrompt = `${currentAgent.instrucciones}\n\nCONTEXTO ADICIONAL:\n${currentAgent.conocimiento_texto || ''}`;
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                systemInstruction: systemPrompt, 
                contents: chatHistory,
                image: imageData, // El backend debe procesar este campo
                text: userMessage || "Analiza esta imagen."
            })
        });

        const data = await response.json();
        typing.remove();

        if (data.success) {
            appendBubble(data.text, false);
            await saveToHubHistory();
        }
    } catch (err) {
        if(typing) typing.remove();
        appendBubble("El espejo está empañado. Intenta de nuevo.", false);
    }
}

function appendBubble(text, isUser) {
    const div = document.createElement('div');
    div.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'}`;
    
    // Detectar si el texto tiene HTML (como una imagen) o es texto plano
    const isHtml = text.includes('<div') || text.includes('<img');
    const content = isHtml ? text : text.replace(/\n/g, '<br>');
    
    div.innerHTML = `<div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">${content}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Guardar en la memoria de la sesión para enviar a Gemini
    let historyText = text;
    if (isHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = text;
        historyText = `[Imagen adjunta] ${temp.innerText.trim()}`;
    }

    chatHistory.push({ 
        role: isUser ? "user" : "model", 
        parts: [{ text: historyText }] 
    });
}

// --- 6. PERSISTENCIA EN SUPABASE ---
async function saveToHubHistory() {
    if (!currentUser || chatHistory.length < 2) return;

    const firstMsg = chatHistory.find(m => m.role === "user")?.parts[0].text || "Reflexión";
    const title = firstMsg.substring(0, 35).replace("[Imagen adjunta]", "📷") + "...";

    await supabaseClient.from('reflexiones_hub').upsert({
        id: currentChatId,
        user_id: currentUser.id,
        agent_id: currentAgent.id,
        title: title,
        history: chatHistory,
        updated_at: new Date().toISOString()
    });
    refreshHistorySidebar();
}

async function refreshHistorySidebar() {
    if (!currentUser) return;
    const { data } = await supabaseClient.from('reflexiones_hub').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    
    const list = document.getElementById('history-list');
    if (list) {
        list.innerHTML = data.map(chat => `
            <div onclick="loadChat('${chat.id}')" class="history-item">
                <div class="text-xs font-bold truncate">${chat.title}</div>
                <div class="text-[8px] opacity-60 uppercase mt-1">${new Date(chat.updated_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    }
}

async function loadChat(id) {
    const { data } = await supabaseClient.from('reflexiones_hub').select('*').eq('id', id).single();
    if(data) {
        currentChatId = data.id;
        chatHistory = data.history;
        chatBox.innerHTML = '';
        chatHistory.forEach(msg => {
            const div = document.createElement('div');
            div.className = `flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `<div class="bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}">${msg.parts[0].text.replace(/\n/g, '<br>')}</div>`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        toggleSidebar('history-sidebar', false);
    }
}

function createNewChat() {
    currentChatId = Date.now();
    chatHistory = [];
    chatBox.innerHTML = '';
    if(currentAgent) {
        appendBubble(`Soy ${currentAgent.nombre}. ¿Qué buscas reflejar hoy?`, false);
    }
}

// --- 7. UI HELPERS ---
function toggleSidebar(id, show) {
    const el = document.getElementById(id);
    const isLeft = id === 'history-sidebar';
    el.style.transform = show ? 'translateX(0)' : (isLeft ? 'translateX(-100%)' : 'translateX(100%)');
}

function showTyping() {
    const div = document.createElement('div');
    div.className = "text-xs opacity-50 italic p-2 dark:text-white";
    div.innerText = `${currentAgent?.nombre || 'Espejo'} analizando...`;
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
    p.style.setProperty('--duration', `${Math.random() * 12 + 8}s`);
    p.style.setProperty('--opacity', Math.random());
    container.appendChild(p);
    setTimeout(() => p.remove(), 12000);
}

// INICIAR APLICACIÓN
init();
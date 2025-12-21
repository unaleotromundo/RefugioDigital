// script.js
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// MODELO Y MEMORIA
const MODELO_ACTUAL = 'gemini-3-flash-preview'; 
let chatHistory = []; // Aquí guardamos la memoria de la charla

// Instrucciones del sistema (Prompt)
const SYSTEM_PROMPT = `Actuá como un sabio uruguayo, experto en leyes, psicología y filosofía. 
Tu nombre es "El Espejo Digital". Hablás de forma cálida, humana y directa. 
IMPORTANTE: Mantené la continuidad de la charla. Si el usuario ya te saludó, NO vuelvas a saludar. 
Si te responde a una pregunta, seguí el hilo con sabiduría. No seas repetitivo. 
Terminá con una pregunta reflexiva solo si ayuda a profundizar.`;

function appendBubble(text, isUser) {
    const wrapper = document.createElement('div');
    if (isUser) {
        wrapper.className = "flex flex-col items-end w-full";
        wrapper.innerHTML = `<div class="bubble bubble-user shadow-lg">${text}</div>`;
        // Guardamos en la memoria
        chatHistory.push({ role: "user", parts: [{ text: text }] });
    } else {
        wrapper.className = "flex flex-col items-start w-full";
        wrapper.innerHTML = `<div class="bubble bubble-ai italic">${text.replace(/\n/g, '<br>')}</div>`;
        // Guardamos en la memoria
        chatHistory.push({ role: "model", parts: [{ text: text }] });
    }
    chatBox.appendChild(wrapper);

    // Mantenemos la memoria corta (últimos 10 mensajes) para no saturar la API
    if (chatHistory.length > 10) chatHistory.shift();

    if (!isUser) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    appendBubble(userText, true);
    chatInput.value = '';

    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "flex flex-col items-start w-full";
    typingDiv.innerHTML = `<div class="bubble bubble-ai opacity-50">El espejo reflexiona sobre tus palabras...</div>`;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    let keys = [...(CONFIG.GEMINI_API_KEYS || [])];
    let success = false;
    let aiResponse = "";

    for (let i = 0; i < keys.length; i++) {
        try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_ACTUAL}:generateContent?key=${keys[i]}`;
            
            // Preparamos el cuerpo con las instrucciones y el historial
            const requestBody = {
                contents: [
                    { role: "user", parts: [{ text: SYSTEM_PROMPT }] }, // Instrucción base
                    ...chatHistory // Historial completo de la charla
                ]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();
                aiResponse = data.candidates[0].content.parts[0].text;
                success = true;
                break; 
            } else {
                if (response.status === 429) await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.error("Error de red");
        }
    }

    const loadingElement = document.getElementById(typingId);
    if (loadingElement) loadingElement.remove();

    if (success) {
        appendBubble(aiResponse, false);
    } else {
        appendBubble("El espejo se ha empañado un momento por la cantidad de consultas. Aguardá unos segundos y volvé a decirme, que no pierdo el hilo.", false);
    }
}

sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        send();
    }
});
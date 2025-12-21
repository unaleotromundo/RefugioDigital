// script.js
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Función para añadir mensajes a la pantalla
function addMessage(text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(isUser ? 'user-message' : 'ai-message');
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll al final
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Mostrar mensaje del usuario
    addMessage(text, true);
    userInput.value = '';

    // Mostrar indicador de "escribiendo..."
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.classList.add('message', 'ai-message', 'loading');
    loadingDiv.innerText = "Gemini está pensando...";
    chatBox.appendChild(loadingDiv);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: text }] }]
            })
        });

        const data = await response.json();
        
        // Quitar indicador de carga
        document.getElementById(loadingId).remove();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            addMessage(aiResponse, false);
        } else {
            addMessage("Lo siento, hubo un error en la respuesta.", false);
        }
    } catch (error) {
        console.error("Error:", error);
        document.getElementById(loadingId).remove();
        addMessage("Error de conexión. Revisa tu consola.", false);
    }
}

// Eventos
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
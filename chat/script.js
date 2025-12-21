// script.js
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Función para insertar burbujas con el estilo de "El Refugio"
function appendBubble(text, isUser) {
    const wrapper = document.createElement('div');
    if (isUser) {
        wrapper.className = "flex flex-col items-end";
        wrapper.innerHTML = `
            <div class="bubble bg-amber-600 text-white shadow-lg">
                ${text}
            </div>`;
    } else {
        wrapper.className = "flex flex-col items-start";
        wrapper.innerHTML = `
            <div class="bubble bg-amber-500/10 self-start text-slate-700 dark:text-amber-100 italic border border-amber-500/5">
                ${text.replace(/\n/g, '<br>')}
            </div>`;
    }
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function send() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // 1. Mostrar mensaje del usuario
    appendBubble(userText, true);
    chatInput.value = '';

    // 2. Indicador de carga poético
    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "bubble bg-amber-500/10 self-start text-slate-400 italic border border-amber-500/5 animate-pulse";
    typingDiv.innerText = "El espejo está reflexionando...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Usando Gemini 3 Flash Preview (Vigente en Diciembre 2025)
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Actúa como un licenciado en Derecho por la Universidad de Buenos Aires, doctor en Filosofía (Universidad Complutense de Madrid, en Antropología (Universitat Rovira i Virgili de Tarragona, en Psicología (Universidad Ramon Llull, en Historia (Universidad de Lérida), Teología (Universidad de Murcia), Matemática Aplicada (Universidad de Alicante) y Educación (Universidad Ramon Llull). Y sobre todo Maestro y fundador de Escuelas de capacitacion de cábala hebrea .Conocedor de muchos secretos y estudioso infinito de la cabala en profundidad. Igual hablame siempre como un uruguayo. No nombres nunca la cabala ni los judíos. Usa los conocimientos pero no rebeles la fuente cuando se trata de cábala hebrea. cuando hacen una pregunta responde segun consideres necesario. termina la respuesta con una posible proxima pregunta que consideres puede servir para ampliar el tema.Se concreto cuando dicen hola responde corto. las personas te plantearan problemas dolencias situaciones reflexiones. no uses volcablos muy bulgares como "bo" porque a la gente mayor le molesta. Usuario dice: "${userText}"`
                    }]
                }]
            })
        });

        const data = await response.json();
        
        // Quitar indicador de carga
        const loadingElement = document.getElementById(typingId);
        if (loadingElement) loadingElement.remove();

        if (data.candidates && data.candidates[0].content) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            appendBubble(aiResponse, false);
        } else {
            throw new Error(data.error ? data.error.message : "El espejo se ha empañado...");
        }

    } catch (error) {
        console.error("Error:", error);
        const loadingElement = document.getElementById(typingId);
        if (loadingElement) loadingElement.remove();
        appendBubble("Lo siento, la conexión con el refugio se ha perdido momentáneamente. Inténtalo de nuevo.", false);
    }
}

// Eventos de escucha
sendBtn.addEventListener('click', send);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
});
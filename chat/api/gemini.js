// api/gemini.js

const GEMINI_API_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4
].filter(Boolean);

const MODELS = [
    "gemini-3-flash-preview",
    "gemini-3-pro",
    "gemini-3-flash-8b",
    "gemini-3-flash",
    "gemini-1.5-flash"
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // Recogemos los nuevos campos: systemInstruction e image
    const { contents, systemInstruction, image } = req.body;

    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Formato inválido' });
    }

    // --- PREPARACIÓN DEL CUERPO DE LA PETICIÓN ---
    let finalContents = JSON.parse(JSON.stringify(contents)); 
    
    // Si hay una imagen, la insertamos en el último mensaje del historial (el del usuario)
    if (image) {
        const lastMessage = finalContents[finalContents.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            // Reestructuramos las partes para que incluyan texto e imagen
            const originalText = lastMessage.parts[0].text;
            lastMessage.parts = [
                { text: originalText },
                {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: image
                    }
                }
            ];
        }
    }

    // Construimos el objeto que Gemini espera
    const requestPayload = {
        contents: finalContents
    };

    // Añadimos la instrucción de sistema si existe
    if (systemInstruction) {
        requestPayload.system_instruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    for (let modelName of MODELS) {
        let keys = [...GEMINI_API_KEYS].sort(() => Math.random() - 0.5);
        
        for (let key of keys) {
            const apiVersions = ['v1beta', 'v1'];
            
            for (let ver of apiVersions) {
                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${key}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestPayload) // Enviamos el payload completo
                        }
                    );

                    const data = await response.json();

                    if (response.ok && data.candidates) {
                        return res.status(200).json({
                            success: true,
                            text: data.candidates[0].content.parts[0].text,
                            model: modelName
                        });
                    } else if (data.error?.message.includes("leaked")) {
                        break; 
                    }
                } catch (error) {
                    console.error(`Error con ${modelName}:`, error.message);
                }
            }
        }
    }

    return res.status(500).json({ success: false, error: 'Error de conexión' });
}
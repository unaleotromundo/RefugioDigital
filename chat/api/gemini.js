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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { contents, systemInstruction, image } = req.body;

    // --- LOG DE ENTRADA ---
    console.log("--- NUEVA PETICIÓN RECIBIDA ---");
    console.log("¿Hay imagen?:", !!image);
    console.log("Número de mensajes en historial:", contents?.length);

    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Formato inválido' });
    }

    let finalContents = JSON.parse(JSON.stringify(contents)); 
    
    if (image) {
        const lastMessage = finalContents[finalContents.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            console.log("Insertando imagen en el último mensaje del usuario...");
            const originalText = lastMessage.parts[0].text;
            
            // Re-estructuramos para cumplir con el formato Multimodal de Google
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

    const requestPayload = {
        contents: finalContents
    };

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
                    console.log(`Probando modelo: ${modelName} (${ver}) con clave: ${key.slice(0, 6)}...`);
                    
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${key}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestPayload)
                        }
                    );

                    const data = await response.json();

                    if (response.ok && data.candidates) {
                        console.log("✅ Respuesta exitosa del modelo:", modelName);
                        return res.status(200).json({
                            success: true,
                            text: data.candidates[0].content.parts[0].text,
                            model: modelName
                        });
                    } else {
                        // Log del error específico de la API de Google
                        console.error(`❌ Error en ${modelName}:`, data.error?.message || "Error desconocido");
                    }
                } catch (error) {
                    console.error(`Critico en ${modelName}:`, error.message);
                }
            }
        }
    }

    return res.status(500).json({ success: false, error: 'Todas las rutas fallaron' });
}
// api/gemini.js
// Configurado para Visión Multimodal y Conciencias Dinámicas

const GEMINI_API_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4
].filter(Boolean);

const MODELS = [
    "gemini-1.5-flash", // El más estable para visión
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp" // O los modelos más recientes que tengas disponibles
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // Capturamos todos los campos enviados desde el Frontend
    const { contents, systemInstruction, image, text } = req.body;

    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Formato de historial inválido' });
    }

    // --- PREPARACIÓN DEL CONTENIDO MULTIMODAL ---
    let finalContents = [...contents];
    
    // Si hay una imagen, creamos un mensaje especial de "user" con la foto y el texto
    if (image) {
        finalContents.push({
            role: "user",
            parts: [
                {
                    inlineData: {
                        mimeType: "image/jpeg", // El navegador suele enviar Base64 compatible
                        data: image
                    }
                },
                { text: text || "Analiza esta imagen detalladamente." }
            ]
        });
    } else if (text) {
        // Si no hay imagen pero hay texto nuevo (no guardado aún en contents)
        finalContents.push({
            role: "user",
            parts: [{ text: text }]
        });
    }

    // --- PREPARACIÓN DE LAS INSTRUCCIONES DEL SISTEMA ---
    const systemInstructionConfig = systemInstruction ? {
        parts: [{ text: systemInstruction }]
    } : undefined;

    // Intentar con cada modelo y cada clave
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
                            body: JSON.stringify({ 
                                contents: finalContents,
                                systemInstruction: systemInstructionConfig // Aquí se inyecta la "Conciencia"
                            })
                        }
                    );

                    const data = await response.json();

                    if (response.ok && data.candidates) {
                        return res.status(200).json({
                            success: true,
                            text: data.candidates[0].content.parts[0].text,
                            model: modelName
                        });
                    } else if (data.error) {
                        console.error(`Error de API (${modelName}):`, data.error.message);
                        if (data.error.message.includes("API key")) break; // Siguiente clave
                    }
                } catch (error) {
                    console.error(`Error crítico con ${modelName}:`, error.message);
                }
            }
        }
    }

    return res.status(500).json({ 
        success: false, 
        error: 'No se pudo procesar la solicitud con ninguna clave o modelo' 
    });
}
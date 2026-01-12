// api/gemini.js
// Esta función se ejecuta en el servidor de Vercel, NO en el navegador

const GEMINI_API_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4
].filter(Boolean); // Elimina undefined

const MODELS = [
    "gemini-3-flash-preview",
    "gemini-3-pro",
    "gemini-3-flash-8b",
    "gemini-3-flash",
    "gemini-1.5-flash"
    "gemini-2.0-flash-exp", // Soporta visión
    "gemini-1.5-flash",     // Soporta visión
    "gemini-1.5-pro"        // Soporta visión
];

export default async function handler(req, res) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { contents, systemInstruction } = req.body;

    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Formato inválido' });
    }

    console.log("📥 Request recibida:", {
        messagesCount: contents.length,
        hasImages: contents.some(c => c.parts?.some(p => p.inline_data))
    });

    // Intentar con cada modelo y cada clave
    for (let modelName of MODELS) {
        let keys = [...GEMINI_API_KEYS].sort(() => Math.random() - 0.5);
        
        for (let key of keys) {
            const apiVersions = ['v1beta', 'v1'];
            
            for (let ver of apiVersions) {
                try {
                    const requestBody = {
                        contents: contents
                    };

                    // Agregar systemInstruction si existe
                    if (systemInstruction) {
                        requestBody.systemInstruction = {
                            parts: [{ text: systemInstruction }]
                        };
                    }

                    console.log(`🔄 Intentando con ${modelName} (${ver})...`);

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${key}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        }
                    );

                    const data = await response.json();

                    if (response.ok && data.candidates) {
                        console.log(`✅ Éxito con ${modelName}`);
                        return res.status(200).json({
                            success: true,
                            text: data.candidates[0].content.parts[0].text,
                            model: modelName
                        });
                    } else if (data.error?.message.includes("leaked")) {
                        console.error(`🔒 Clave bloqueada: ${key.slice(0, 10)}...`);
                        break; // Saltar a la siguiente clave
                    } else if (data.error?.message.includes("SAFETY")) {
                        console.warn("⚠️ Contenido bloqueado por seguridad");
                        return res.status(400).json({
                            success: false,
                            error: "El contenido fue bloqueado por políticas de seguridad"
                        });
                    } else {
                        console.warn(`⚠️ Error con ${modelName}:`, data.error?.message);
                    }
                } catch (error) {
                    console.error(`❌ Excepción con ${modelName}:`, error.message);
                }
            }
        }
    }

    // Si llegamos aquí, todas las claves fallaron
    console.error("❌ Todas las claves agotadas");
    return res.status(500).json({ 
        success: false, 
        error: 'Todas las claves API están agotadas o bloqueadas' 
    });
}
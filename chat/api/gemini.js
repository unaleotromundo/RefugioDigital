// api/gemini.js
const GEMINI_API_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4
].filter(Boolean);

// RESTAURADOS TUS MODELOS ORIGINALES
const MODELS = [
    "gemini-3-flash-preview",
    "gemini-3-pro",
    "gemini-3-flash-8b",
    "gemini-3-flash",
    "gemini-1.5-flash"
];

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { contents, systemInstruction, image, text } = req.body;

    // --- CONSTRUCCIÓN DEL MENSAJE MULTIMODAL ---
    // Si hay imagen, se mete en el mismo bloque que el texto para que la IA la vea.
    let currentParts = [];
    if (image) {
        currentParts.push({
            inlineData: { mimeType: "image/jpeg", data: image }
        });
    }
    currentParts.push({ text: text || "Analiza esta imagen profesionalmente." });

    const finalContents = [
        ...contents,
        { role: "user", parts: currentParts }
    ];

    const systemInstructionConfig = systemInstruction ? {
        parts: [{ text: systemInstruction }]
    } : undefined;

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
                                systemInstruction: systemInstructionConfig 
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
                    }
                } catch (error) {
                    console.error(`Error con ${modelName}:`, error.message);
                }
            }
        }
    }

    return res.status(500).json({ success: false, error: 'Error general de conexión' });
}
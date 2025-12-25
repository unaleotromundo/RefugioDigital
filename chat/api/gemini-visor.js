import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        // Usar la clave exclusiva del visor desde variables de entorno
        const apiKey = process.env.GEMINI_API_KEY_VISOR;
        
        if (!apiKey) {
            return res.status(500).json({ 
                success: false, 
                error: 'API key del visor no configurada' 
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const { contents } = req.body;
        
        const chat = model.startChat({
            history: contents.slice(0, -1),
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const lastMessage = contents[contents.length - 1];
        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({
            success: true,
            text: text
        });

    } catch (error) {
        console.error('Error en Gemini Visor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
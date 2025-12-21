const CONFIG = {
    // Tus llaves de siempre
    GEMINI_API_KEYS: [
        "AIzaSyAN6mg59bIRNupnj0UfITY7QRSTUYhR9F8",
        "AIzaSyBTQ9AB_iVnGpjGZ4d4EWUqVNhA3NLg5R4",
        "AIzaSyDMJfythzCyFPc4dTnAdyCkZmEL_Lhn5F0",
        "AIzaSyB-uzqHIiegsIGdi53ipaPbosaOF9kQgeA"
    ],
    // Lista de modelos por orden de prioridad
    MODELS: [
        "gemini-3-flash-preview",       // El más nuevo y equilibrado
        "gemini-3-pro",   // Máxima inteligencia (si está disponible)
        "gemini-3-flash-8b",       // Ultra rápido y estable
        "gemini-3-flash",         // Muy inteligente, buen respaldo
        "gemini-1.5-flash"     // El modelo de emergencia (más ligero)
    ],
    SUPABASE_URL: "https://jkhrpbpdewhkzgqqrwmp.supabase.co",
    SUPABASE_KEY: "sb_publishable_xj9waE1quyimP47S4gmtLg_lKs5eszo"
};
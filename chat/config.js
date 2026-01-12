const CONFIG = {
    SUPABASE_URL: "https://jkhrpbpdewhkzgqqrwmp.supabase.co",
    SUPABASE_KEY: "sb_publishable_xj9waE1quyimP47S4gmtLg_lKs5eszo",
ADMIN_PASSWORD: "admin123" // <--- Asegúrate de que esto esté aquí
};

// --- FUNCIONES DE GESTIÓN DE AGENTES CON PROTECCIÓN ---

function editAgent(id) {
    // Pedir clave antes de abrir el modal
    const pass = prompt("Clave de constructor para editar:");
    if (pass !== CONFIG.ADMIN_PASSWORD) {
        alert("Acceso denegado.");
        return;
    }

    const agente = listaAgentesGlobal.find(a => a.id === id);
    if (!agente) return;

    // Llenar los campos del modal
    document.getElementById('edit-id').value = agente.id;
    document.getElementById('edit-nombre').value = agente.nombre;
    document.getElementById('edit-descripcion').value = agente.descripcion || '';
    document.getElementById('edit-instrucciones').value = agente.instrucciones || '';
    
    // Mostrar el modal
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('edit-status').innerText = "";
}

async function actualizarAgente() {
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('edit-nombre').value;
    const descripcion = document.getElementById('edit-descripcion').value;
    const instrucciones = document.getElementById('edit-instrucciones').value;
    const btn = document.getElementById('btnActualizar');

    btn.innerText = "ACTUALIZANDO...";
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('agentes')
            .update({ 
                nombre: nombre, 
                descripcion: descripcion, 
                instrucciones: instrucciones 
            })
            .eq('id', id);

        if (error) throw error;

        document.getElementById('edit-status').innerText = "✅ Actualizado con éxito";
        
        await cargarAgentes();
        setTimeout(closeEditModal, 1000);
    } catch (err) {
        console.error(err);
        document.getElementById('edit-status').innerText = "❌ Error al guardar";
    } finally {
        btn.innerText = "ACTUALIZAR";
        btn.disabled = false;
    }
}

async function deleteAgent(id) {
    // Pedir clave antes de eliminar
    const pass = prompt("Clave de constructor para eliminar:");
    if (pass !== CONFIG.ADMIN_PASSWORD) {
        alert("Acceso denegado.");
        return;
    }

    const confirmacion = confirm("¿Estás seguro de que quieres eliminar esta conciencia? Esta acción no se puede deshacer.");
    if (!confirmacion) return;

    try {
        const { error } = await supabaseClient
            .from('agentes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        // Si borramos el agente activo, reseteamos la vista
        if (currentAgent && currentAgent.id === id) {
            currentAgent = null;
            document.getElementById('active-agent-name').innerText = "Selecciona";
            document.getElementById('active-agent-desc').innerText = "una conciencia";
            chatBox.innerHTML = "";
        }

        await cargarAgentes();
    } catch (err) {
        alert("Error al eliminar el agente");
        console.error(err);
    }
}
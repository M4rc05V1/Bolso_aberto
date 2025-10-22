
const API_URL = "http://localhost:3000";

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Se não houver token, redireciona imediatamente (segurança básica)
        window.location.href = 'login.html'; 
        return {};
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
    };
}

async function checarAcessoAdmin() {
    try {
        const res = await fetch(`${API_URL}/admin/status`, { 
            headers: getAuthHeaders() 
        });

        if (!res.ok) {
            // Se o servidor retorna erro (403 Proibido ou 401 Não Autorizado)
            alert("Acesso negado ou sessão expirada. Você será redirecionado.");
            window.location.href = 'index.html'; // Redireciona para o painel normal
            return false;
        }

        // Se deu OK (status 200), o usuário é admin
        return true;

    } catch (err) {
        // Erro de rede/conexão com o servidor
        console.error("Erro ao verificar status admin:", err);
        window.location.href = 'index.html'; 
        return false;
    }
}

// ================== PONTO DE PARTIDA ==================

document.addEventListener("DOMContentLoaded", async () => {
    // Checa a permissão antes de carregar o conteúdo da página
    const isAdmin = await checarAcessoAdmin();

    if (isAdmin) {
        console.log("Acesso Admin Liberado. Carregando dashboard.");
        
        // Exemplo: Boas-vindas
        const usuarioNome = localStorage.getItem("usuarioNome");
        const boasVindasEl = document.getElementById("boas-vindas-admin");
        if (usuarioNome && boasVindasEl) {
             boasVindasEl.textContent = `Bem-vindo, ${usuarioNome} (Admin)!`;
        }
        
        // 🚨 INICIALIZAÇÃO DO GERENCIAMENTO DE CATEGORIAS 🚨
        
        // 1. Carrega a lista de categorias e renderiza a tabela
        carregarCategoriasAdmin(); 
        
        // 2. Botão Nova Categoria (abre o modal no modo cadastro)
        const btnNovaCategoria = document.getElementById("btn-nova-categoria");
        if (btnNovaCategoria) {
            btnNovaCategoria.addEventListener("click", abrirModalNovaCategoria);
        }

        // 3. Submissão do Formulário de Categoria (POST ou PUT)
        const formCategoriaAdmin = document.getElementById("form-categoria-admin");
        if (formCategoriaAdmin) {
            formCategoriaAdmin.addEventListener("submit", salvarCategoria);
        }
        
        // 4. Listeners para fechar o modal (Botão X e Clique fora)
        const fecharModalBtn = document.querySelector(".fechar-admin[data-modal='modal-editar-categoria']");
        const modalCategoria = document.getElementById('modal-editar-categoria');
        
        if (fecharModalBtn) {
            fecharModalBtn.addEventListener('click', () => {
                fecharModalAdmin('modal-editar-categoria');
            });
        }
        
        if (modalCategoria) {
            window.addEventListener('click', (e) => {
                if (e.target === modalCategoria) {
                    fecharModalAdmin('modal-editar-categoria');
                }
            });
        }
        
        
        carregarUsuariosAdmin(); 
        
        
    } else {
        return; 
    }

    const btnSair = document.getElementById("btn-sair-admin");
    if (btnSair) {
        btnSair.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("usuarioNome");
            window.location.href = "login.html";
        });
    }
});
// ================== FUNÇÕES DE CATEGORIAS ==================

// 1. Renderiza a tabela de categorias
function renderTabelaCategorias(categorias) {
    const tbody = document.querySelector("#tabela-categorias tbody");
    tbody.innerHTML = ''; // Limpa o corpo da tabela

    if (categorias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">Nenhuma categoria cadastrada.</td></tr>`;
        return;
    }

    categorias.forEach(cat => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${cat.id}</td>
            <td>${cat.nome}</td>
            <td>
                <button class="btn-admin btn-editar-categoria" data-id="${cat.id}" data-nome="${cat.nome}">
                    Editar
                </button>
                <button class="btn-admin btn-excluir-categoria" data-id="${cat.id}">
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Anexa os listeners de ação
    document.querySelectorAll(".btn-editar-categoria").forEach(btn => {
        btn.addEventListener("click", abrirModalEdicaoCategoria);
    });
    document.querySelectorAll(".btn-excluir-categoria").forEach(btn => {
        btn.addEventListener("click", excluirCategoria);
    });
}


// 2. Carrega as categorias do Back-end
async function carregarCategoriasAdmin() {
    try {
        const res = await fetch(`${API_URL}/categorias`, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Erro ao carregar categorias.");
            return [];
        }
        const categorias = await res.json();
        renderTabelaCategorias(categorias);
        return categorias;
    } catch (err) {
        console.error("Erro de rede ao carregar categorias:", err);
        return [];
    }
}


// 3. Salva ou Atualiza a categoria (chamada pelo form submit)
async function salvarCategoria(event) {
    event.preventDefault();
    
    const form = event.currentTarget;
    const id = document.getElementById("categoria-id-admin").value;
    const nome = document.getElementById("nome-categoria-admin").value;
    
    const payload = { nome };
    
    let url = `${API_URL}/categorias`;
    let method = 'POST';
    let successMessage = 'Categoria criada com sucesso!';
    
    // Verifica se é Edição
    if (id) {
        url = `${API_URL}/categorias/${id}`;
        method = 'PUT';
        successMessage = 'Categoria atualizada com sucesso!';
    }
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
             alert(data.error || `Erro ao salvar: ${res.statusText}`);
             return;
        }

        alert(successMessage);
        fecharModalAdmin("modal-editar-categoria");
        form.reset();
        
        // Recarrega a lista de categorias no Admin e limpa o cache do painel
        localStorage.removeItem('categorias');
        carregarCategoriasAdmin(); 
        
    } catch (err) {
        console.error("Erro ao salvar categoria:", err);
        alert("Erro de conexão com o servidor.");
    }
}


// 4. Exclui a categoria
async function excluirCategoria(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Tem certeza que deseja EXCLUIR esta categoria? Isso afetará transações e metas!")) return;
    
    try {
        const res = await fetch(`${API_URL}/categorias/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Erro ao excluir categoria.");
            return;
        }

        alert("Categoria excluída com sucesso.");
        // Recarrega
        localStorage.removeItem('categorias');
        carregarCategoriasAdmin();

    } catch (err) {
        console.error("Erro ao excluir categoria:", err);
        alert("Erro de conexão com o servidor.");
    }
}


// 5. Funções Auxiliares de Modal
function abrirModalEdicaoCategoria(e) {
    const id = e.currentTarget.dataset.id;
    const nome = e.currentTarget.dataset.nome;
    
    document.querySelector("#modal-editar-categoria h2").textContent = "Editar Categoria";
    document.getElementById("categoria-id-admin").value = id;
    document.getElementById("nome-categoria-admin").value = nome;
    
    document.getElementById("modal-editar-categoria").style.display = 'block';
}

function abrirModalNovaCategoria() {
    document.querySelector("#modal-editar-categoria h2").textContent = "Nova Categoria";
    document.getElementById("form-categoria-admin").reset();
    document.getElementById("categoria-id-admin").value = ''; 
    document.getElementById("modal-editar-categoria").style.display = 'block';
}

function fecharModalAdmin(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
// public/scripts/admin.js (Novas Funções de Usuários)

// ================== FUNÇÕES DE USUÁRIOS ==================

// 1. Renderiza a tabela de usuários
function renderTabelaUsuarios(usuarios) {
    const tbody = document.querySelector("#tabela-usuarios tbody");
    tbody.innerHTML = ''; 

    if (usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const isSelf = user.id === parseInt(localStorage.getItem('usuarioId')); // Verifica se é o próprio usuário logado
        const isChecked = user.is_admin ? 'checked' : '';
        const isDisabled = isSelf ? 'disabled' : ''; // Não permite mudar o próprio status

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.nome}</td>
            <td>${user.email}</td>
            <td>
                <input type="checkbox" class="toggle-admin" data-id="${user.id}" ${isChecked} ${isDisabled}>
                ${user.is_admin ? 'Sim' : 'Não'}
            </td>
            <td>
                <button class="btn-admin btn-excluir-usuario" data-id="${user.id}" ${isDisabled}>
                    Apagar Conta
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Anexa listeners de exclusão e toggle
    document.querySelectorAll(".btn-excluir-usuario:not([disabled])").forEach(btn => {
        btn.addEventListener("click", excluirUsuario);
    });
    document.querySelectorAll(".toggle-admin:not([disabled])").forEach(input => {
        input.addEventListener("change", toggleStatusAdmin);
    });
}


// 2. Carrega todos os usuários do Back-end
async function carregarUsuariosAdmin() {
    try {
        const res = await fetch(`${API_URL}/admin/usuarios`, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Erro ao carregar usuários.");
            return [];
        }
        const usuarios = await res.json();
        renderTabelaUsuarios(usuarios);
        return usuarios;
    } catch (err) {
        console.error("Erro de rede ao carregar usuários:", err);
        return [];
    }
}


// 3. Exclui a conta do usuário
async function excluirUsuario(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm(`Tem certeza que deseja APAGAR o usuário ID ${id}? Esta ação é irreversível!`)) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/usuarios/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            // Se o status não for 200-299, é um erro.
            let errorMessage = "Erro interno ao apagar usuário.";
            
            // CLONAMOS a resposta antes de tentar ler
            const resClone = res.clone(); 
            
            try {
                // 1. Tenta ler a resposta de erro como JSON (resposta do seu servidor)
                const errorData = await res.json();
                errorMessage = errorData.error || errorMessage;
            } catch (jsonError) {
                // 2. Se falhar (ex: recebeu HTML), lê como texto
                const errorText = await resClone.text();
                console.error("Resposta não JSON do servidor:", errorText);
                // Exibe uma mensagem mais informativa se for o erro 500 original
                errorMessage = `Erro do Servidor (${res.status}): Verifique o console.`;
            }

            alert(errorMessage);
            return;
        }

        // Se a resposta for OK (status 200-299)
        let successMessage = "Usuário apagado com sucesso.";
        try {
            const data = await res.json();
            successMessage = data.message || successMessage;
        } catch (e) {
            /* Sem corpo JSON, mas status OK. Ignoramos. */
        }

        alert(successMessage);
        carregarUsuariosAdmin();

    } catch (err) {
        console.error("Erro de comunicação ou desconhecido:", err);
        alert("Erro de conexão com o servidor. Verifique se o Node está rodando.");
    }
}

// 4. Alterna o status de Administrador
async function toggleStatusAdmin(e) {
    const id = e.currentTarget.dataset.id;
    const isAdmin = e.currentTarget.checked;
    
    if (!confirm(`Tem certeza que deseja ${isAdmin ? 'TORNAR' : 'REMOVER'} o usuário ID ${id} como administrador?`)) {
        // Reverte a checkbox se o usuário cancelar
        e.currentTarget.checked = !isAdmin;
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/usuarios/toggle-admin/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ isAdmin: isAdmin })
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Erro ao atualizar status admin.");
            e.currentTarget.checked = !isAdmin; // Reverte
            return;
        }

        alert(`Status de admin de usuário ID ${id} atualizado para: ${isAdmin}`);
        // Recarrega apenas para atualizar o texto 'Sim/Não' na tabela
        carregarUsuariosAdmin(); 

    } catch (err) {
        console.error("Erro ao alterar status admin:", err);
        e.currentTarget.checked = !isAdmin; // Reverte
        alert("Erro de conexão com o servidor.");
    }
}

const API_URL = "https://bolso-aberto.onrender.com";

// =================== FUNÇÕES AUXILIARES ===================

function getAuthHeaders() {
    const token = localStorage.getItem('token'); 

    if (!token) {
        window.location.href = '/login.html'; 
        return {}; 
    }

    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
    };
}
// =================== RENDERIZAÇÃO ===================
// public/scripts/index.js (Adicione este objeto no topo)

const DICAS_FINANCEIRAS = {
    
   "Serviços de Stream": { 
        titulo: "O Peso dos 'Streamings' no Orçamento",
        conteudo: "Assinaturas como Netflix, Spotify e Amazon Prime parecem baratas isoladamente, mas juntas podem consumir até **8% da renda mensal** de uma pessoa. Dica: reveze entre os serviços. Assine um por mês e pause os outros. Essa rotação pode gerar uma economia de **até R$ 600 por ano** sem perder o entretenimento.",
        cor: "#2ecc71"
    },

    
    "Investimentos Pessoais": {
        titulo: "Evite o Impulso nas Compras Pessoais",
        conteudo: "Cerca de **40% dos brasileiros** admitem comprar por impulso, especialmente roupas e eletrônicos. Esses gastos podem ultrapassar **10% do salário** mensal. Dica: use a 'Regra das 48h' — espere dois dias antes de comprar algo que não é essencial. Na maioria das vezes, o desejo passa, e o dinheiro fica com você!",
        cor: "#3498DB"
    },
    
    "Transporte": {
        titulo: "Repensando o Custo de se Locomover",
        conteudo: "Manter um carro próprio no Brasil custa em média **R$ 1.500 por mês**, somando combustível, seguro e manutenção. Que tal usar transporte público, carona ou bicicleta algumas vezes por semana? Essa pequena mudança pode gerar uma economia anual de **até R$ 10.000**, que pode virar uma reserva financeira sólida.",
        cor: "#f39c12"
    },
    
    "Alimentação": {
    titulo: "O Impacto do Delivery e Fast-Food no Seu Orçamento",
    conteudo: "Hoje, os brasileiros gastam em média **15% da renda mensal** com alimentação fora de casa — e boa parte disso vem de **pedidos por aplicativos e redes de fast-food**. Aqueles lanches rápidos e entregas práticas somam valores que passam despercebidos. Dica: limite os pedidos de delivery a dias específicos e planeje suas refeições da semana. Economizar R$ 30 por pedido pode significar **mais de R$ 1.000 economizados ao ano**.",
    cor: "#e74c3c"
},
  
    "Outros": {
        titulo: "O Gasto 'Não Classificado' Pode Ser Seu Inimigo Oculto",
        conteudo: "A categoria 'Outros' não deveria passar de **5% do total de gastos mensais**. Se estiver muito acima disso, é sinal de que há falta de controle. Dica: revise as despesas dessa categoria e crie novos grupos como 'Educação', 'Saúde' ou 'Pets'. Assim, você entende melhor para onde o seu dinheiro realmente vai.",
        cor: "#95a5a6"
    }
};


function renderTabela(transacoes) {
    const tbody = document.querySelector("#tabela-gastos tbody");
    tbody.innerHTML = "";

    if (transacoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhuma transação encontrada.</td></tr>`;
        return;
    }

    transacoes.forEach(t => {
        const row = document.createElement("tr");
        const tipoClass = t.tipo === 'entrada' ? 'entrada' : 'gasto';
        const categoriaNome = t.categoria_nome || 'Sem categoria';
        const dataFormatada = t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-';

        row.innerHTML = `
            <td><span class="${tipoClass}">${t.tipo}</span></td>
            <td>${categoriaNome}</td>
            <td>R$ ${Number(t.valor).toFixed(2).replace('.', ',')}</td>
            <td>${t.detalhes || '-'}</td>
            <td>${dataFormatada}</td>
            <td>
                <button class="btn-editar" data-id="${t.id}">
                    Editar
                </button>
                <button class="btn-excluir" data-id="${t.id}">
                    <img src="/assets/img/excluir.svg" alt="Excluir">
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Adiciona listeners de exclusão
    document.querySelectorAll(".btn-excluir").forEach(btn => {
        btn.addEventListener("click", excluirMovimentacao);
    });
    
    // Adiciona listeners de edição após a tabela ser renderizada
    adicionarListenersEdicao();
}

function handleEdicaoClick(e) {
    const movimentacaoId = e.currentTarget.dataset.id;
    abrirModalEdicao(movimentacaoId);
}

function adicionarListenersEdicao() {
    // Remove listeners antigos e adiciona novos para evitar duplicação de eventos
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.removeEventListener('click', handleEdicaoClick); 
        btn.addEventListener('click', handleEdicaoClick);
    });
}

function renderGrafico(transacoes) {
    let totalEntradas = 0;
    let totalGastos = 0;

    transacoes.forEach(t => {
        const valorNumerico = parseFloat(t.valor); 
        if (isNaN(valorNumerico)) return; 
        
        if (t.tipo === 'entrada') {
            totalEntradas += valorNumerico;
        } else if (t.tipo === 'gasto') {
            totalGastos += valorNumerico;
        }
    });
    
    const labels = ['Entradas', 'Gastos'];
    const data = [totalEntradas, totalGastos]; 
    const backgroundColors = ['#1dbf73', '#E74C3C']; 
    
    const canvas = document.getElementById('gastosChart');
    if (window.gastosChart instanceof Chart) {
        window.gastosChart.destroy();
    }

    window.gastosChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors 
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Proporção de Entradas vs. Gastos' } 
            }
        }
    });
}

const formatarMoeda = (valor) => `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;

function renderMetas(metas) {
    const container = document.getElementById('metas-container');
    container.innerHTML = ''; 

    metas.forEach(meta => {
        const valorAlvo = meta.valor; 
        const valorProgresso = meta.gasto_atual; 
        
        const progresso = (valorProgresso / valorAlvo) * 100;
        const progressoFormatado = Math.min(100, progresso).toFixed(2);
        const saldoRestante = valorAlvo - valorProgresso;
        
        const corBarra = progresso > 100 ? '#E74C3C' : '#3498DB'; 
        
        const metaHTML = `
            <div class="meta-card" style="border-left: 6px solid ${corBarra};">
                <h3>Meta: ${meta.categoria_nome}</h3> <p>Alvo de Gasto: ${formatarMoeda(valorAlvo)}</p>
                <p>Gasto Atual: ${formatarMoeda(valorProgresso)}</p>
                
                <div class="barra">
                    <div class="progresso" style="width: ${progressoFormatado}%; background: ${corBarra};"></div>
                </div>
                
                <p>Progresso: ${progressoFormatado}%</p>
                
                ${saldoRestante >= 0 
                    ? `<p>Resta: ${formatarMoeda(saldoRestante)}</p>` 
                    : `<p class="aviso">Meta ULTRAPASSADA! (${formatarMoeda(Math.abs(saldoRestante))} a mais)</p>`
                }
                
                <button class="btn-excluir-meta" data-id="${meta.id}">Excluir Meta</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', metaHTML);
    });
    
    document.querySelectorAll('.btn-excluir-meta').forEach(btn => {
        btn.addEventListener('click', () => excluirMeta(btn.dataset.id));
    });
}
function renderComparativo(comparativo) {
    const container = document.getElementById('comparativo-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (comparativo.length === 0) {
        container.innerHTML = '<p class="info">Não há gastos neste ou no mês anterior para comparar.</p>';
        return;
    }

    comparativo.forEach(item => {
        const gastoM1 = parseFloat(item.gasto_m1);
        const crescimento = parseFloat(item.crescimento_percentual);
        
        let statusClass = 'neutro';
        let statusIcon = '➡️';
        let statusText = `Manteve-se.`;

        if (crescimento > 0.5) { // Cresceu mais de 0.5%
            statusClass = 'piorou'; 
            statusIcon = '📈';
            statusText = `Cresceu ${Math.abs(crescimento).toFixed(1)}%`;
        } else if (crescimento < -0.5) { // Diminuiu mais de 0.5%
            statusClass = 'melhorou'; 
            statusIcon = '📉';
            statusText = `Diminuiu ${Math.abs(crescimento).toFixed(1)}%`;
        }
        
        const comparativoHTML = `
            <div class="comparativo-card ${statusClass}">
                <div class="header-comparativo">
                    <h3>${item.categoria_nome}</h3>
                    <span class="gasto-m1">${formatarMoeda(gastoM1)}</span>
                </div>
                <p class="status-comparativo">
                    <span class="icon">${statusIcon}</span> 
                    ${statusText}
                </p>
                <p class="detalhe-comparativo">
                    Gasto no mês anterior: ${formatarMoeda(item.gasto_m0)}
                </p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', comparativoHTML);
    });
}

// =================== FUNÇÕES DE CARREGAMENTO (ASSÍNCRONAS) ===================

async function carregarResumo(dataInicial = null, dataFinal = null) {
    let url = `${API_URL}/resumo`;

    if (dataInicial && dataFinal) {
        url += `?data_inicial=${dataInicial}&data_final=${dataFinal}`;
    }

    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();

        document.getElementById("entradas").textContent = `R$ ${data.entradas.toFixed(2).replace('.', ',')}`;
        document.getElementById("saidas").textContent = `R$ ${data.saidas.toFixed(2).replace('.', ',')}`;
        document.getElementById("saldo").textContent = `R$ ${(data.entradas - data.saidas).toFixed(2).replace('.', ',')}`;
    } catch (err) {
        console.error("Erro ao carregar resumo:", err);
    }
}

async function carregarTransacoes(dataInicial = null, dataFinal = null) {
    let url = `${API_URL}/movimentacoes`;

    if (dataInicial && dataFinal) {
        url += `?data_inicial=${dataInicial}&data_final=${dataFinal}`;
    }
    
    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();
        
        const movimentacoes = Array.isArray(data.movimentacoes) ? data.movimentacoes : Array.isArray(data) ? data : [];
        
        renderTabela(movimentacoes);
        renderGrafico(movimentacoes);
        
        // 💡 Chamar o novo carregamento de categorias aqui também para filtrar!
        if (typeof carregarGastosPorCategoria === "function") {
            carregarGastosPorCategoria(dataInicial, dataFinal);
        }
        
        return movimentacoes;
        
    } catch (err) {
        console.error("Erro ao carregar transações:", err);
        return [];
    }
}

async function carregarCategorias(elementId) {
    try {
        // Busca SEMPRE no servidor
        const res = await fetch(`${API_URL}/categorias`, { headers: getAuthHeaders() });
        
        if (!res.ok) {
            console.error("Erro na resposta do servidor ao buscar categorias.");
            return;
        }
        
        const categorias = await res.json();
        
        const select = document.getElementById(elementId);
        if (!select) return;

        select.innerHTML = `<option value="">Selecione</option>`;
        
        categorias.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = cat.nome;
            select.appendChild(opt);
        });

    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
    }
}

async function carregarMetasStatus() {
    try {
        const res = await fetch(`${API_URL}/metas/status`, { headers: getAuthHeaders() });
        
        if (!res.ok) {
            console.error("Erro ao buscar metas:", res.status, await res.text());
            return;
        }

        const data = await res.json();
        
        if (Array.isArray(data)) {
            renderMetas(data); 
        } else {
            console.error("Resposta do servidor não é um array:", data);
        }

    } catch (err) {
        console.error("Erro ao carregar metas:", err);
    }
}
function exibirDica(nomeCategoria) {
    const dica = DICAS_FINANCEIRAS[nomeCategoria];
    const modalDicas = document.getElementById("dicas-modal");

    if (dica) {
        document.getElementById("dicas-titulo").textContent = nomeCategoria + ": " + dica.titulo;
        document.getElementById("dicas-conteudo").innerHTML = dica.conteudo; // Usar innerHTML para negrito
        
        // Mudar a cor da borda do cabeçalho
        document.querySelector(".modal-content-dicas h2").style.borderLeft = `5px solid ${dica.cor}`;
        
        modalDicas.style.display = "block";
    } else {
        // Se, por algum erro de digitação, a chave não for encontrada
        alert("Desculpe, não há uma dica específica para esta categoria ainda.");
    }
}
async function carregarComparativoCategorias() {
    // Esta rota usa datas fixas de Mês Atual vs. Mês Anterior, sem filtro de URL
    let url = `${API_URL}/resumo/comparativo`; 

    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();
        
        renderComparativo(data); 

    } catch (err) {
        console.error("Erro ao carregar comparativo de categorias:", err);
        document.getElementById('comparativo-container').innerHTML = '<p class="error">Não foi possível carregar os dados de comparação.</p>';
    }
}

// =================== LÓGICA DE MODAIS E EDIÇÃO ===================

function initTransacaoModal() {
    const modal = document.getElementById("modal");
    const btn = document.getElementById("btn-add");
    const fechar = document.getElementById("fechar");
    const formTransacao = document.getElementById("form-transacao");

    const tipoSelect = document.getElementById("tipo");
    const categoriaSelect = document.getElementById("categoria");

    tipoSelect.addEventListener("change", () => {
        if (tipoSelect.value === "entrada") {
            categoriaSelect.style.display = "none";
            categoriaSelect.required = false;
            categoriaSelect.value = "";
        } else {
            categoriaSelect.style.display = "block";
            categoriaSelect.required = true;
        }
    });

    btn.addEventListener("click", () => {
        // Reseta o modo do formulário
        formTransacao.dataset.modo = 'cadastro'; 
        document.querySelector('#modal h2').textContent = 'Nova Transação'; 
        
        formTransacao.reset();
        tipoSelect.dispatchEvent(new Event("change"));
        modal.style.display = "block";
    });

    fechar.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    formTransacao.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // --- LÓGICA DE EDIÇÃO/CADASTRO ---
        const form = e.currentTarget;
        const modo = form.dataset.modo || 'cadastro'; 
        const movimentacaoId = form.dataset.movimentacaoId;
        // ---------------------------------
        
        const tipo = tipoSelect.value;
        const valorInput = document.getElementById("valor").value.trim();
        const detalhes = document.getElementById("detalhes").value.trim();
        
        // 🚨 COLETA CRÍTICA: data 🚨
        const data = document.getElementById("data").value.trim(); 
        
        let categoria_id = null;
        const valor = parseFloat(valorInput.replace(",", "."));

        // VALIDAÇÕES
        if (!tipo) { alert("Selecione um tipo de transação."); return; }
        if (isNaN(valor) || valor <= 0) { alert("Informe um valor válido maior que zero."); return; }
        if (!data) { alert("A data da transação é obrigatória."); return; } // Validação da data
        
        if (tipo === "gasto") {
            categoria_id = categoriaSelect.value;
            if (!categoria_id) { alert("Categoria é obrigatória para gastos."); return; }
        }

        const payload = { tipo, valor, detalhes, categoria_id, data };

        // --- CONFIGURAÇÃO DA REQUISIÇÃO ---
        let url = `${API_URL}/movimentacoes`;
        let method = 'POST';
        let successMessage = 'Movimentação adicionada com sucesso!';

        if (modo === 'edicao' && movimentacaoId) {
            url = `${API_URL}/movimentacoes/${movimentacaoId}`;
            method = 'PUT';
            successMessage = 'Transação atualizada com sucesso!';
        }
        // ---------------------------------

        try {
            const res = await fetch(url, { 
                method: method,
                headers: getAuthHeaders(), // getAuthHeaders AGORA inclui Content-Type
                body: JSON.stringify(payload),
            });

            let data;
            try { data = await res.json(); } catch { data = {}; }

            if (!res.ok) {
                alert(data.error || `Erro ${res.status}: ${res.statusText}`);
                return;
            }

            alert(successMessage);
            
            // --- LIMPEZA E RESET DO MODO ---
            modal.style.display = "none";
            formTransacao.reset();
            tipoSelect.dispatchEvent(new Event("change"));

            // Limpa e reseta o modo de edição para o próximo cadastro
            form.dataset.modo = 'cadastro'; 
            document.querySelector('#modal h2').textContent = 'Nova Transação'; 
            // -----------------------------------
            
            // Recarrega todos os dados
            await carregarTransacoes(); // Já chama renderTabela e renderGrafico
            carregarResumo();
            if (typeof carregarMetasStatus === "function") {
                carregarMetasStatus();
            }

        } catch (err) {
            console.error("Erro ao adicionar/editar transação:", err);
            alert("Erro de conexão com o servidor. Verifique se o backend está rodando.");
        }
    });
}

async function abrirModalEdicao(movimentacaoId) {
    try {
        // 1. Busca os dados da transação
        const res = await fetch(`${API_URL}/movimentacoes/${movimentacaoId}`, {
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            alert("Erro ao carregar dados da transação.");
            return;
        }

        const transacao = await res.json();
        
        // Formata a data para o input HTML (YYYY-MM-DD). Se a data vier com fuso, garantimos o formato.
        const dataFormatada = new Date(transacao.data).toISOString().split('T')[0];
        
        // 2. Preenche o Modal
        const form = document.getElementById('form-transacao'); 
        
        document.getElementById('tipo').value = transacao.tipo;
        document.getElementById('categoria').value = transacao.categoria_id || ''; // Usa o ID da categoria
        document.getElementById('valor').value = transacao.valor;
        document.getElementById('detalhes').value = transacao.detalhes || '';
        document.getElementById('data').value = dataFormatada; 
        
        // Dispara o evento change para mostrar/esconder a categoria
        document.getElementById('tipo').dispatchEvent(new Event("change"));
        
        // 3. Configura o modo de Edição
        form.dataset.modo = 'edicao';
        form.dataset.movimentacaoId = movimentacaoId;
        
        // Atualiza o título e exibe o modal
        document.querySelector('#modal h2').textContent = 'Editar Transação'; 
        document.getElementById('modal').style.display = 'block'; 

    } catch (err) {
        console.error("Erro ao buscar dados para edição:", err);
    }
}

function initMetasModal() {
    const modalMeta = document.getElementById("modal-meta");
    const btnAddMeta = document.getElementById("btn-add-meta");
    const fecharMeta = document.getElementById("fechar-meta");
    const formMeta = document.getElementById("form-meta");

    btnAddMeta.addEventListener("click", () => {
        formMeta.reset();
        modalMeta.style.display = "block";
    });

    fecharMeta.addEventListener("click", () => {
        modalMeta.style.display = "none";
    });

    window.addEventListener('click', (e) => {
        if (e.target === modalMeta) modalMeta.style.display = "none";
    });
    
    // Agora chama a função de salvarMeta diretamente
    formMeta.addEventListener("submit", salvarMeta);
}
// =================== EXCLUSÃO E SALVAMENTO ===================

async function excluirMovimentacao(e) {
    const id = e.target.closest('button').dataset.id;
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    try {
        const res = await fetch(`${API_URL}/movimentacoes/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            alert("Erro ao excluir transação.");
            return;
        }

        carregarResumo();
        carregarTransacoes();
        carregarMetasStatus();

    } catch (err) {
        console.error("Erro ao excluir transação:", err);
        alert("Erro de conexão com o servidor.");
    }
}

async function excluirMeta(metaId) {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/metas/${metaId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Erro ao excluir meta.");
            return;
        }

        alert("Meta excluída com sucesso!");
        await carregarMetasStatus(); 

    } catch (err) {
        console.error("Erro ao excluir meta:", err);
        alert("Erro de conexão ao tentar excluir a meta.");
    }
}

async function salvarMeta(event) {
    event.preventDefault();

    const categoriaId = document.getElementById('meta-categoria').value;
    const valorMeta = document.getElementById('meta-valor').value; 
    
    const bodyMeta = {
        categoria_id: categoriaId,
        valor: parseFloat(valorMeta)
    };

    if (!categoriaId || isNaN(bodyMeta.valor)) {
        alert("Por favor, selecione a categoria e insira um valor válido.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/metas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(bodyMeta)
        });
        
        if (res.ok) {
            alert("Meta criada com sucesso!"); 
            document.getElementById('modal-meta').style.display = 'none';
            document.getElementById('form-meta').reset();
            await carregarMetasStatus(); 
            
        } else {
            const errorData = await res.json();
            alert(`Erro ao salvar meta: ${errorData.error || res.statusText}`);
        }
    } catch (err) {
        console.error("Erro ao salvar meta:", err);
        alert("Erro de conexão ao tentar salvar a meta.");
    }
}


// =================== AO CARREGAR A PÁGINA (PONTO DE PARTIDA) ===================
function initFiltrosData() {
    const btnAplicar = document.getElementById('btn-aplicar-filtro');
    const btnLimpar = document.getElementById('btn-limpar-filtro');
    const inputInicial = document.getElementById('data-inicial');
    const inputFinal = document.getElementById('data-final');

    const aplicarFiltro = () => {
        const dataInicial = inputInicial.value;
        const dataFinal = inputFinal.value;

        if (!dataInicial || !dataFinal) {
            alert("Por favor, selecione ambas as datas para aplicar o filtro.");
            return;
        }

        carregarResumo(dataInicial, dataFinal);
        carregarTransacoes(dataInicial, dataFinal);

        // Se já tiver implementado o comparativo de categorias:
        if (typeof carregarGastosPorCategoria === "function") {
             carregarGastosPorCategoria(dataInicial, dataFinal); 
        }
    };

    const limparFiltro = () => {
        inputInicial.value = '';
        inputFinal.value = '';

        carregarResumo();
        carregarTransacoes(); 

        // Se já tiver implementado o comparativo de categorias:
        if (typeof carregarGastosPorCategoria === "function") {
             carregarGastosPorCategoria(); 
        }
    };

    if (btnAplicar && btnLimpar) {
        btnAplicar.addEventListener('click', aplicarFiltro);
        btnLimpar.addEventListener('click', limparFiltro);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    // Checagem de autenticação
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Boas vindas
    const usuarioNome = localStorage.getItem("usuarioNome");
    if (usuarioNome) {
        document.getElementById("boas-vindas").textContent = `Olá, ${usuarioNome}!`;
    }

    // Inicialização dos modais
    initTransacaoModal();
    initMetasModal();
    initFiltrosData();
    document.querySelectorAll(".categoria-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const nomeCategoria = e.currentTarget.dataset.name; 
            
            if (nomeCategoria) {
                exibirDica(nomeCategoria);
            }
        });
    });

    // 2. Listeners para fechar o modal de dicas
    const fecharBtn = document.querySelector(".fechar-dicas");
    const modalDicas = document.getElementById("dicas-modal");

    if (fecharBtn) {
        fecharBtn.addEventListener("click", () => {
            modalDicas.style.display = "none";
        });
    }

    // Fechar ao clicar fora do modal
    if (modalDicas) {
        window.addEventListener('click', (e) => {
            if (e.target === modalDicas) {
                modalDicas.style.display = "none";
            }
        });
    }

    // 🚨 FIM DO NOVO CÓDIGO DE DICAS 🚨


    // Carregamento de dados
    carregarResumo();
    carregarTransacoes();
    carregarMetasStatus();
    carregarComparativoCategorias();

    carregarCategorias("categoria");
    carregarCategorias("meta-categoria");

    // Botão Sair
    const btnSair = document.getElementById("btn-sair");
    btnSair.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("usuarioNome");
        localStorage.removeItem("categorias"); // ✅ Limpando o cache de categorias
        window.location.href = "login.html";
    });
});
/* server.js */
import express from "express";
import { Pool } from 'pg';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 🔐 carrega as variáveis do arquivo .env
dotenv.config();

const app = express();
// REMOVER: app.use(express.json()); 


const allowedOrigins = [
    'https://bolsoaberto.netlify.app', 
    'http://localhost:3000', 
    'http://localhost:5500',
    null,      // Para cenários onde a origem é enviada como null
    undefined  // <-- NOVO! Para cenários onde a origem é undefined ou não existe
];
const corsOptions = {
    // A lógica de checagem continua perfeita
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

/// ================== POSTGRESQL (com Pool) ==================
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: false 
    } 
});

db.query('SELECT NOW()')
    .then(res => console.log('Conectado ao PostgreSQL com sucesso! Hora:', res.rows[0].now))
    .catch(err => console.error('Erro ao conectar ao PostgreSQL:', err));
// ================== ROTAS DE PÁGINAS ==================
app.get("/api/ping", (req, res) => {
    res.status(200).json({ status: "ok", service: "Bolso Aberto API", db: "Conectado" });
});

app.get("/", (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Bolso Aberto API está no ar e funcionando!'
    });
});

// ================== MIDDLEWARE DE AUTENTICAÇÃO ==================
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
        // Token não fornecido (401 Unauthorized)
        return res.status(401).json({ error: "Token não fornecido." }); 
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Token inválido/expirado (403 Forbidden)
            return res.status(403).json({ error: "Token inválido ou expirado." }); // CORRIGIDO PARA JSON!
        }
        req.user = user;
        next();
    });
}
function adminOnly(req, res, next) {
    if (req.user && req.user.is_admin) {
        next(); // Usuário é administrador, pode prosseguir
    } else {
        res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar este recurso." });
    }
}
// ================== AUTENTICAÇÃO ==================
app.post("/register", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Preencha todos os campos" });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);

    await db.query(
      "INSERT INTO usuarios (nome, email, senha, saldo_inicial) VALUES ($1, $2, $3, $4)",
      [nome, email, hash, 0]
    );

    res.json({ message: "Usuário registrado com sucesso!" });
  } catch (err) {
    console.error("Erro no registro:", err);
    
    if (err.code === "23505") { 
      return res.status(409).json({ error: "E-mail já cadastrado." });
    }
    res.status(500).json({ error: "Erro ao registrar usuário" });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const results = await db.query(
      "SELECT id, nome, senha, is_admin FROM usuarios WHERE email = $1", 
      [email]
    );

    if (results.rows.length === 0) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const usuario = results.rows[0]; 
    

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, is_admin: usuario.is_admin },
      process.env.JWT_SECRET, // Usando process.env para o JWT_SECRET
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login realizado com sucesso",
      token,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      is_admin: usuario.is_admin,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro no servidor" });
 }
});
// ================== CATEGORIAS ==================
app.get("/categorias", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const results = await db.query( 
            "SELECT id, nome FROM categorias WHERE usuario_id = $1 OR usuario_id IS NULL ORDER BY nome ASC",
            [userId]
        );
        res.json(results.rows); 
    } catch (err) {
        console.error("Erro ao buscar categorias:", err);
        res.status(500).json({ error: "Erro ao buscar categorias" });
    }
});

// ================== MOVIMENTAÇÕES ==================
app.post("/movimentacoes", authenticateToken, async (req, res) => {
    // ... (cheques e validações)

    try {
        // MUDANÇA: '?' para '$n' e adiciona 'RETURNING id'
        const result = await db.query( 
            "INSERT INTO movimentacoes (usuario_id, tipo, valor, detalhes, categoria_id, data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [userId, tipo, valor, detalhes || null, categoriaFinal, data]
        );
        res
            .status(201)
            // MUDANÇA: Acessa o ID inserido via 'result.rows[0].id'
            .json({ id: result.rows[0].id, message: "Movimentação adicionada com sucesso!" });
    } catch (err) {
        // ...
    }
});
app.put("/movimentacoes/:id", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const movimentacaoId = req.params.id;
    
    // Captura os dados
    const { tipo, categoria_id, valor, detalhes, data } = req.body; 

    // 1. Checagem de campos obrigatórios (tipo, valor, data são sempre obrigatórios)
    if (!tipo || !valor || !data) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: tipo, valor e data." });
    }
    
    // 2. CRÍTICO: Define o valor final da categoria para o SQL
    let categoriaFinal = categoria_id;

    // Se o tipo for 'gasto' e a categoria estiver faltando, é um erro.
    if (tipo === 'gasto' && !categoria_id) {
        return res.status(400).json({ error: "A categoria é obrigatória para gastos." });
    }
    
    // Se o tipo for 'entrada' (ou a categoria não foi fornecida), defina como NULL para o SQL
    if (tipo === 'entrada' || !categoria_id) {
        categoriaFinal = null;
    }
    // Para 'gasto', categoriaFinal já é o categoria_id que veio no body.

    try {
        // MUDANÇA: Removeu a desestruturação '[result]' e trocou '?' por '$n' (PostgreSQL)
        const result = await db.query( 
            `UPDATE movimentacoes SET 
                tipo = $1, 
                categoria_id = $2, 
                valor = $3, 
                detalhes = $4, 
                data = $5
             WHERE id = $6 AND usuario_id = $7`,
            [tipo, categoriaFinal, valor, detalhes || null, data, movimentacaoId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Transação não encontrada ou acesso negado." });
        }

        res.json({ message: "Transação atualizada com sucesso." });
    } catch (err) {
        console.error("Erro ao atualizar transação:", err);
        res.status(500).json({ error: "Erro interno ao atualizar transação." });
    }
});
app.delete("/movimentacoes/:id", authenticateToken, async (req, res) => {
    const { id } = req.params; 
    const userId = req.user.id; 

    try {
        const query = "DELETE FROM movimentacoes WHERE id = $1 AND usuario_id = $2"; 
        
        const result = await db.query(query, [id, userId]);

        if (result.rowCount === 0) { 
            return res.status(404).json({ error: "Movimentação não encontrada ou acesso negado." });
        }
        
        res.status(204).send(); 
    } catch (error) {
        console.error("Erro ao excluir movimentação:", error);
        res.status(500).json({ error: "Erro interno do servidor ao tentar excluir a movimentação." });
    }
});

app.get("/movimentacoes", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { data_inicial, data_final } = req.query;

    let dateFilter = '';
    const queryParams = [userId]; // userId é sempre o primeiro parâmetro ($1)
    let nextPlaceholder = 2; // O próximo parâmetro a ser usado será o $2

    if (data_inicial && data_final) {
        // MUDANÇA: Usamos $2 e $3 para as datas
        dateFilter = `AND m.data BETWEEN $${nextPlaceholder} AND $${nextPlaceholder + 1}`; 
        queryParams.push(data_inicial, data_final); // Adiciona datas ao array
    }
    
    try {
        // MUDANÇA: O 'WHERE m.usuario_id = ?' é trocado por 'WHERE m.usuario_id = $1'
        const results = await db.query( 
            `SELECT m.id, m.tipo, m.valor, m.detalhes, m.data, 
                 c.nome AS categoria_nome, c.id AS categoria_id
             FROM movimentacoes m 
             LEFT JOIN categorias c ON m.categoria_id = c.id
             WHERE m.usuario_id = $1 
             ${dateFilter} 
             ORDER BY m.data DESC`,
            queryParams // Os parâmetros são passados na ordem correta
        );
        res.json({ movimentacoes: results.rows });
    } catch (err) {
        console.error("Erro ao buscar movimentações:", err);
        res.status(500).json({ error: "Erro ao buscar movimentações" });
    }
});
app.get("/movimentacoes/:id", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const movimentacaoId = req.params.id;

    try {
        // MUDANÇA: '?' para '$1' e '$2'
        const results = await db.query( 
            "SELECT id, tipo, categoria_id, valor, detalhes, data FROM movimentacoes WHERE id = $1 AND usuario_id = $2",
            [movimentacaoId, userId]
        );
        
        if (results.rows.length === 0) {
            return res.status(404).json({ error: "Transação não encontrada." });
        }
        
        res.json(results.rows[0]); 
    } catch (err) {
        console.error("Erro ao buscar transação:", err);
        res.status(500).json({ error: "Erro interno." });
    }
});

// ================== RESUMO ==================
app.get("/resumo", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    // 💡 1. Captura os parâmetros de data da URL (query string)
    const { data_inicial, data_final } = req.query;

    let dateFilter = '';
    const queryParams = [userId]; // O userId é sempre o primeiro parâmetro ($1)

    // 💡 2. Se as datas existirem, monta a cláusula WHERE e adiciona os valores aos parâmetros
    if (data_inicial && data_final) {
        // MUDANÇA: '?' por '$2' e '$3'
        dateFilter = 'AND data BETWEEN $2 AND $3'; 
        queryParams.push(data_inicial, data_final);
    }

    try {
        // MUDANÇA: Remove a desestruturação '[results]'
        // MUDANÇA: Troca o '?' por '$1' no WHERE
        const results = await db.query( 
            `SELECT
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
                COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS saidas
             FROM movimentacoes
             WHERE usuario_id = $1 ${dateFilter}`, // MUDANÇA: '?' para '$1'
            queryParams // Os parâmetros são passados na ordem correta ($1, $2, $3...)
        );
        
        const entradas = Number(results.rows[0]?.entradas || 0);
        const saidas = Number(results.rows[0]?.saidas || 0);
        const saldo = entradas - saidas;

        res.json({
            entradas: entradas,
            saidas: saidas,
            saldo: saldo,
        });
    } catch (err) {
        console.error("Erro ao buscar resumo:", err);
        res.status(500).json({ error: "Erro ao buscar resumo" });
    }
});
app.get("/resumo/comparativo", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    
    // Usamos a data do servidor para definir Mês Atual (M1) e Mês Anterior (M0)
    const today = new Date();
    
    // Mês Atual (M1) - Ex: 01/10/2025 até 31/10/2025
    const startM1 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endM1 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Mês Anterior (M0) - Ex: 01/09/2025 até 30/09/2025
    const startM0 = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
    const endM0 = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
    
    // --- 2. FUNÇÃO DE CONSULTA REUTILIZÁVEL (MIGRADA) ---
    const getGastosPorCategoria = async (start_date, end_date) => {
        // MUDANÇA: Removeu a desestruturação '[results]'
        // MUDANÇA: '?' por '$1', '$2', '$3'
        const results = await db.query( 
            `SELECT 
                c.nome AS categoria_nome, 
                COALESCE(SUM(m.valor), 0) AS gasto_total
             FROM movimentacoes m
             JOIN categorias c ON m.categoria_id = c.id
             WHERE m.usuario_id = $1 
               AND m.tipo = 'gasto'
               AND m.data BETWEEN $2 AND $3
             GROUP BY c.nome`,
            [userId, start_date, end_date]
        );
        // MUDANÇA: Itera sobre 'results.rows'
        return results.rows.reduce((acc, curr) => {
            acc[curr.categoria_nome] = parseFloat(curr.gasto_total);
            return acc;
        }, {});
    };

    try {
        const gastosM1 = await getGastosPorCategoria(startM1, endM1);
        const gastosM0 = await getGastosPorCategoria(startM0, endM0);
        
        const comparativo = [];
        const todasCategorias = new Set([...Object.keys(gastosM1), ...Object.keys(gastosM0)]);
        
        todasCategorias.forEach(nome => {
            const gastoM1 = gastosM1[nome] || 0;
            const gastoM0 = gastosM0[nome] || 0;
            
            let crescimento = 0;
            
            if (gastoM0 > 0) {
                crescimento = ((gastoM1 - gastoM0) / gastoM0) * 100;
            } else if (gastoM1 > 0) {
                crescimento = 100; 
            }

            comparativo.push({
                categoria_nome: nome,
                gasto_m1: gastoM1.toFixed(2),
                gasto_m0: gastoM0.toFixed(2),
                crescimento_percentual: crescimento.toFixed(1),
            });
        });

        comparativo.sort((a, b) => parseFloat(b.gasto_m1) - parseFloat(a.gasto_m1));

        res.json(comparativo);
        
    } catch (err) {
        console.error("Erro ao buscar comparativo de categorias:", err);
        res.status(500).json({ error: "Erro ao buscar comparativo de categorias" });
    }
});
// ================= ROTAS DE GERENCIAMENTO DE USUÁRIOS (ADMIN) =================

// 1. LISTAR TODOS OS USUÁRIOS
app.get('/admin/usuarios', authenticateToken, adminOnly, async (req, res) => {
    try {
        const results = await db.query('SELECT id, nome, email, is_admin FROM usuarios'); 
        
        res.json(results.rows); 
    } catch (err) {
        console.error("Erro ao listar usuários:", err);
        res.status(500).json({ error: "Erro no servidor ao listar usuários." });
    }
});


// 2. APAGAR CONTA DE USUÁRIO
app.delete('/admin/usuarios/:id', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const userIdToDelete = parseInt(id);
    
    if (isNaN(userIdToDelete)) {
        return res.status(400).json({ error: 'ID de usuário inválido.' });
    }

    // MUDANÇA: 'client' é o nome padrão da conexão obtida do pool do pg
    let client; 

    try {
        // MUDANÇA: Obtém um cliente do pool (substitui db.getConnection())
        client = await db.connect(); 
        
        // MUDANÇA: Inicia a transação SQL
        await client.query('BEGIN');

        // --- EXCLUSÕES EM CASCATA ---
        
        // MUDANÇA: '?' para '$1'
        await client.query('DELETE FROM movimentacoes WHERE usuario_id = $1', [userIdToDelete]);
        
        // MUDANÇA: '?' para '$1'
        await client.query('DELETE FROM metas WHERE usuario_id = $1', [userIdToDelete]);


        const result = await client.query('DELETE FROM usuarios WHERE id = $1', [userIdToDelete]);

        if (result.rowCount === 0) { 
            await client.query('ROLLBACK'); // MUDANÇA: Rollback SQL
            // Não precisa de client.release() aqui, pois o finally cuida disso.
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        await client.query('COMMIT'); 
        
        res.json({ message: 'Usuário e todos os dados relacionados apagados com sucesso.' });

    } catch (err) {
        // Em caso de erro, desfaz a transação
        if (client) {
            await client.query('ROLLBACK'); // MUDANÇA: Rollback SQL
        }
        
        console.error("Erro ao apagar usuário e dados relacionados:", err);
        res.status(500).json({ error: 'Erro interno ao apagar o usuário.' });
        
    } finally {
        if (client) {
            client.release();
        }
    }
});



// 3. ALTERAR STATUS DE ADMIN (OPCIONAL, mas útil)
app.put('/admin/usuarios/toggle-admin/:id', authenticateToken, adminOnly, async (req, res) => {
    const userId = req.params.id;
    const { isAdmin } = req.body; // Espera receber { isAdmin: true/false }

    if (req.user.id === parseInt(userId)) {
        return res.status(403).json({ error: "Você não pode mudar seu próprio status de administrador por aqui." });
    }

    try {
    
        const result = await db.query('UPDATE usuarios SET is_admin = $1 WHERE id = $2', [isAdmin, userId]);

        // MUDANÇA: Checa 'result.rowCount' (o equivalente a affectedRows no pg)
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        res.status(200).json({ message: "Status de administrador atualizado com sucesso." });
    } catch (err) {
        console.error("Erro ao atualizar status admin:", err);
        res.status(500).json({ error: "Erro no servidor." });
    }
});

// ================== METAS ==================
app.post("/metas", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    // Remova 'mes' e 'ano' do desestruturamento:
    const { categoria_id, valor } = req.body; 

    // Remova a checagem de mes e ano:
    if (!categoria_id || !valor) {
        return res.status(400).json({ error: "Categoria e valor são obrigatórios." });
    }

    try {
        // MUDANÇA (SELECT): Remove a desestruturação e troca '?' por '$1' e '$2'. Usa 'results.rows'
        const existingResults = await db.query(
            "SELECT id FROM metas WHERE usuario_id = $1 AND categoria_id = $2",
            [userId, categoria_id]
        );
        const existing = existingResults.rows; // Pega o array de resultados

        if (existing.length > 0) {
            // MUDANÇA (UPDATE): Troca '?' por '$1' e '$2'.
            await db.query(
                "UPDATE metas SET valor = $1 WHERE id = $2",
                [valor, existing[0].id]
            );
            res.json({ message: "Meta atualizada com sucesso!" });
        } else {
            // MUDANÇA (INSERT): Troca '?' por '$n' e adiciona 'RETURNING id'.
            const result = await db.query(
                "INSERT INTO metas (usuario_id, categoria_id, valor) VALUES ($1, $2, $3) RETURNING id",
                [userId, categoria_id, valor]
            );
            // MUDANÇA: Acessa o ID inserido via 'result.rows[0].id'.
            res.status(201).json({ id: result.rows[0].id, message: "Meta criada com sucesso!" });
        }
    } catch (err) {
        console.error("Erro ao gerenciar meta:", err);
        res.status(500).json({ error: "Erro interno ao gerenciar meta." });
    }
});

app.get("/metas/status", authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT 
                m.id, 
                m.valor, 
                m.categoria_id, 
                c.nome AS categoria_nome,
                -- COALESCE(SUM(mov.valor), 0) é o GASTO ACUMULADO TOTAL
                COALESCE(SUM(CASE 
                    WHEN mov.tipo = 'gasto' 
                    THEN mov.valor 
                    ELSE 0 
                    END), 0) AS gasto_atual
            FROM metas m
            JOIN categorias c ON m.categoria_id = c.id
            LEFT JOIN movimentacoes mov ON mov.usuario_id = m.usuario_id 
                                        AND mov.categoria_id = m.categoria_id
            -- Filtra apenas pelo usuário
            WHERE m.usuario_id = $1  -- MUDANÇA: Troca '?' por '$1'
            GROUP BY m.id, m.valor, m.categoria_id, c.nome
        `;
        // MUDANÇA: Removeu a desestruturação '[metas]'
        const results = await db.query(query, [userId]); 
        
        // MUDANÇA: Acessa os dados em 'results.rows'
        const metas = results.rows; 

        const metasStatus = metas.map(meta => {
            const gastoAtual = parseFloat(meta.gasto_atual);
            const progresso = (gastoAtual / meta.valor) * 100;
            
            return {
                id: meta.id,
                categoria_nome: meta.categoria_nome,
                valor: parseFloat(meta.valor), // Valor Alvo
                gasto_atual: gastoAtual,      // Valor de Progresso
                progresso: progresso,
                ultrapassada: gastoAtual > meta.valor,
            };
        });

        res.json(metasStatus);
    } catch (err) {
        console.error("Erro ao buscar status das metas:", err);
        res.status(500).json({ error: "Erro interno ao buscar status das metas." });
    }
});
app.delete("/metas/:id", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    // CRÍTICO: Capturar o ID da URL usando req.params.id
    const metaId = req.params.id; 

    try {
        // MUDANÇA: Remove a desestruturação '[result]'
        // MUDANÇA: Troca '?' por '$1' e '$2'
        const result = await db.query( 
            "DELETE FROM metas WHERE id = $1 AND usuario_id = $2",
            [metaId, userId]
        );

        // MUDANÇA: Checa 'result.rowCount'
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Meta não encontrada ou acesso negado." });
        }

        res.json({ message: "Meta excluída com sucesso." });
    } catch (err) {
        console.error("Erro ao deletar meta:", err);
        res.status(500).json({ error: "Erro interno ao deletar meta." });
    }
});
// ================== INICIAR SERVIDOR ==================
app.listen(process.env.PORT || 3000, () => {
  const port = process.env.PORT || 3000;
  console.log(`✅ Servidor rodando na porta ${port}`);
});
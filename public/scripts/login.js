const loginForm = document.getElementById("login-form");
const API_URL = "http://localhost:3000";

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, senha }),
        });

        const data = await res.json();

       if (res.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("usuarioNome", data.usuarioNome);
            localStorage.setItem("usuarioId", data.usuarioId); // <-- NOVO: Armazena o ID

            if (data.is_admin) {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html";
            }
        } else {
            alert(data.error || "Erro ao fazer login. Tente novamente.");
        }
    } catch (err) {
        console.error("Erro no login:", err);
        alert("Erro de conexão com o servidor. Verifique se o backend está rodando.");
    }
});
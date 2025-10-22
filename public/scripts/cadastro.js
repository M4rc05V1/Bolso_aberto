// public/scripts/cadastro.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-cadastro");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if (!nome || !email || !senha) {
      alert("Preencha todos os campos!");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Cadastro realizado com sucesso!");
        window.location.href = "login.html"; 
      } else {
        alert("❌ Erro: " + (data.error || "Não foi possível cadastrar"));
      }
    } catch (err) {
      console.error("Erro no cadastro:", err);
      alert("❌ Falha ao se conectar com o servidor");
    }
  });
});

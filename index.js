const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// 🔑 Chave privada
const privateKeyPath = path.join(__dirname, "private.key");
const privateKey = fs.readFileSync(privateKeyPath);

// Configuração DocuSign
const account_id = "69784ef8-1393-4d49-927c-af9a1caed068";
const template_id = "2aebf175-843a-470a-89ae-b956a397dfd7";
const auth_server = "account.docusign.com";
const integrationKey = "32b34d39-c4ea-4174-9820-699a1ef7f26";
const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";

function gerarJWT() {
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: auth_server,
    scope: "signature impersonation",
  };
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "10m" });
}

// Funções auxiliares
function dateFormated(val) {
  return new Date(parseInt(val)).toLocaleDateString("pt-BR");
}
function currencyFormated(val) {
  return parseFloat(val).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Endpoint que o HubSpot vai chamar
app.post("/enviar-envelope", (req, res) => {
  // Responde imediatamente para evitar timeout
  res.json({ success: true });

  // Processa o envio do envelope em segundo plano
  setImmediate(async () => {
    try {
      const body = req.body;

      // Dados do contato
      const nome = body.firstname;
      const nome_completo = body.nome_completo;
      const email = body.email;
      const nacionalidade = body.nacionalidade;
      const estado_civil = body.relationship_status;
      const regime_de_casamento = body.regime_de_casamento;
      const rg = body.rg;
      const cpf_cnpj = body.cpf_cnpj;
      const rua = body.address;
      const cidade = body.city;
      const estado = body.state;
      const zip = body.zip;
      const bairro__distrito = body.bairro__distrito;
      const numero__endereco_ = body.numero__endereco_;
      const complemento = body.complemento;
      const Data_inicial_mutuo = dateFormated(body.data_inicial__controle_financeiro_);
      const Data_final_mutuo = dateFormated(body.data_final__controle_financeiro_);
      const Valor_total_mutuo = currencyFormated(body.r__mutuo_total);
      const Valor_parcela_mutuo = currencyFormated(body.remuneracao_mensal);
      const vencimento__controle_mutuo_ = body.vencimento__controle_mutuo_;
      const profissao = body.job_function;

      const endereco_completo = `${rua} - ${cidade}/${estado}`;

      // 1 - Gera JWT
      const assertion = gerarJWT();

      // 2 - Troca por Access Token
      const tokenResponse = await axios.post(`https://${auth_server}/oauth/token`, {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      });
      const docusign_access_token = tokenResponse.data.access_token;

      // Assunto e descrição do e-mail
      const assunto = `Termo de Adesão | ${nome_completo}`;
      const descricao = "<p>Olá Sócio, segue o termo...</p>";

      // Dados do envelope
      const signature_data = {
        emailSubject: assunto,
        emailBlurb: descricao,
        status: "sent",
        templateId: template_id,
        templateRoles: [
          {
            roleName: "Sócio Aderente",
            email,
            name: nome,
            tabs: {
              textTabs: [
                { tabLabel: "Nacionalidade", value: nacionalidade },
                { tabLabel: "EstadoCivil", value: estado_civil },
                { tabLabel: "Regime de Casamento", value: regime_de_casamento },
                { tabLabel: "Naturalidade", value: body.naturalidade },
                { tabLabel: "RG", value: rg },
                { tabLabel: "Orgao_Emissor", value: body.orgao_emissor_do_rg },
                { tabLabel: "NomeCompletoHS", value: nome_completo },
                { tabLabel: "CPF", value: cpf_cnpj },
                { tabLabel: "Email", value: email },
                { tabLabel: "Valor_total_mutuo", value: Valor_total_mutuo },
                { tabLabel: "Valor_parcela_mutuo", value: Valor_parcela_mutuo },
                { tabLabel: "Data_inicial_mutuo", value: Data_inicial_mutuo },
                { tabLabel: "Data_final_mutuo", value: Data_final_mutuo },
                { tabLabel: "vencimento__controle_mutuo_", value: vencimento__controle_mutuo_ },
                { tabLabel: "profissao", value: profissao },
                { tabLabel: "Endereco", value: endereco_completo },
                { tabLabel: "Rua_Endereço", value: rua },
                { tabLabel: "Número_Endereço", value: numero__endereco_ },
                { tabLabel: "Bairro_Endereço", value: bairro__distrito },
                { tabLabel: "complemento", value: complemento },
                { tabLabel: "Cidade", value: cidade },
                { tabLabel: "Estado", value: estado },
                { tabLabel: "CEP", value: zip }
              ],
            },
          },
          {
            roleName: "Testemunha 1",
            email: "eferreira@acquavero.com.br",
            name: "Edna Ferreira da Silva Marcolino",
          },
          {
            roleName: "Testemunha 2",
            email: "rcarvalho@avinoffice.com.br",
            name: "Raquel Mathias Carvalho Guerreiro",
          }
        ],
      };

      // 3 - Envia o envelope
      await axios.post(
        `https://na3.docusign.net/restapi/v2.1/accounts/${account_id}/envelopes`,
        signature_data,
        { headers: { Authorization: `Bearer ${docusign_access_token}`, "Content-Type": "application/json" } }
      );

      console.log("Envelope enviado para", email);
    } catch (err) {
      console.error("Erro ao enviar envelope:", err.response?.data || err.message);
    }
  });
});

// Porta que o Render usa
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

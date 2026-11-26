// Guarda as informações usadas pelas funções da página.
const telaLogin = document.querySelector('#auth');
const telaPainel = document.querySelector('#dashboard');
const formularioLogin = document.querySelector('#auth-form');

let usuario = null;
let tabelas = [];
let tabelaAtual = null;
let idEmEdicao = null;
let criandoConta = false;
let registros = [];

// Faz uma chamada para o servidor e mostra erros de forma simples.
async function chamarServidor(url, opcoes = {}) {
  const resposta = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.error || 'Aconteceu um erro.');
  }

  return dados;
}

function mostrarMensagem(texto, deuErro = false) {
  const aviso = document.querySelector('#toast');
  aviso.textContent = texto;
  aviso.className = deuErro ? 'uk-alert-danger' : 'uk-alert-success';
  aviso.hidden = false;

  setTimeout(() => {
    aviso.hidden = true;
  }, 3000);
}

function mostrarLogin() {
  telaLogin.hidden = false;
  telaPainel.hidden = true;
  document.querySelector('#user-area').innerHTML = '';
}

function nomeDoCampo(campo) {
  return campo
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace('Id', ' (ID)');
}

// Evita que um texto digitado pelo usuário vire código HTML na página.
function limparTexto(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, caractere => {
    const simbolos = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return simbolos[caractere];
  });
}

// Desenha as abas e as tabelas disponíveis para a pessoa conectada.
async function mostrarPainel() {
  telaLogin.hidden = true;
  telaPainel.hidden = false;

  document.querySelector('#user-area').innerHTML =
    `${limparTexto(usuario.name)} <button id="sair" class="uk-button uk-button-text">Sair</button>`;

  document.querySelector('#welcome').textContent = usuario.role === 'admin'
    ? 'Você entrou como administrador.'
    : 'Você pode consultar os produtos.';

  document.querySelector('#sair').addEventListener('click', sairDaConta);

  tabelas = await chamarServidor('/api/resources');

  const listaAbas = document.querySelector('#tabs');
  const listaPaginas = document.querySelector('#pages');

  listaAbas.innerHTML = '';
  listaPaginas.innerHTML = '';

  tabelas.forEach((tabela, indice) => {
    listaAbas.innerHTML += `
      <li class="${indice === 0 ? 'uk-active' : ''}">
        <a href="#">${limparTexto(tabela.nome)}</a>
      </li>`;

    listaPaginas.innerHTML += `
      <li>
        <div class="table-wrap">
          <table class="uk-table uk-table-divider">
            <thead id="cabecalho-${tabela.chave}"></thead>
            <tbody id="linhas-${tabela.chave}"></tbody>
          </table>
        </div>
      </li>`;
  });

  UIkit.tab(listaAbas);
  UIkit.switcher(listaPaginas);

  tabelaAtual = tabelas[0];
  document.querySelector('#add-record').hidden = usuario.role !== 'admin';

  // Ao escolher uma aba, carregamos os dados daquela tabela.
  document.querySelectorAll('#tabs a').forEach((aba, indice) => {
    aba.addEventListener('click', () => {
      tabelaAtual = tabelas[indice];
      carregarRegistros();
    });
  });

  await carregarRegistros();
}

async function carregarRegistros() {
  if (!tabelaAtual) return;

  registros = await chamarServidor(`/api/${tabelaAtual.chave}`);

  const cabecalho = document.querySelector(`#cabecalho-${tabelaAtual.chave}`);
  const linhas = document.querySelector(`#linhas-${tabelaAtual.chave}`);
  const campos = tabelaAtual.campos;

  cabecalho.innerHTML = `
    <tr>
      <th>ID</th>
      ${campos.map(campo => `<th>${limparTexto(nomeDoCampo(campo))}</th>`).join('')}
      ${usuario.role === 'admin' ? '<th>Ações</th>' : ''}
    </tr>`;

  if (registros.length === 0) {
    linhas.innerHTML = '<tr><td>Nenhum registro cadastrado.</td></tr>';
    return;
  }

  linhas.innerHTML = registros.map(registro => `
    <tr>
      <td>${registro.id}</td>
      ${campos.map(campo => `<td>${limparTexto(registro[campo])}</td>`).join('')}
      ${usuario.role === 'admin' ? `
        <td>
          <button class="uk-button uk-button-text editar" data-id="${registro.id}">Editar</button>
          <button class="uk-button uk-button-text excluir" data-id="${registro.id}">Excluir</button>
        </td>` : ''}
    </tr>`).join('');

  document.querySelectorAll('.editar').forEach(botao => {
    botao.addEventListener('click', () => abrirFormulario(Number(botao.dataset.id)));
  });

  document.querySelectorAll('.excluir').forEach(botao => {
    botao.addEventListener('click', () => excluirRegistro(botao.dataset.id));
  });
}

function abrirFormulario(id = null) {
  idEmEdicao = id;
  const registro = registros.find(item => item.id === id) || {};
  const campos = [...tabelaAtual.campos];

  // Ao criar um usuário, também precisamos pedir a senha.
  if (tabelaAtual.chave === 'users' && id === null) {
    campos.push('password');
  }

  document.querySelector('#modal-title').textContent = id
    ? 'Editar registro'
    : 'Novo registro';

  document.querySelector('#record-fields').innerHTML = campos.map(campo => `
    <div class="uk-margin">
      <label class="uk-form-label" for="campo-${campo}">${limparTexto(nomeDoCampo(campo))}</label>
      <input class="uk-input" id="campo-${campo}" name="${campo}"
        type="${tipoDoCampo(campo)}" value="${limparTexto(registro[campo])}"
        ${campo === 'password' ? 'required' : ''}>
    </div>`).join('');

  UIkit.modal('#edit-modal').show();
}

function tipoDoCampo(campo) {
  if (campo === 'password') return 'password';
  if (campo === 'email') return 'email';
  if (['price', 'total', 'unitPrice', 'stock', 'quantity'].includes(campo)) return 'number';
  if (campo === 'orderDate') return 'date';
  return 'text';
}

async function excluirRegistro(id) {
  if (!confirm('Tem certeza que deseja excluir?')) return;

  try {
    await chamarServidor(`/api/${tabelaAtual.chave}/${id}`, { method: 'DELETE' });
    mostrarMensagem('Registro excluído.');
    await carregarRegistros();
  } catch (erro) {
    mostrarMensagem(erro.message, true);
  }
}

async function sairDaConta() {
  await chamarServidor('/api/logout', { method: 'POST' });
  usuario = null;
  mostrarLogin();
}

// Alterna entre a tela de entrar e a de criar conta.
document.querySelector('#show-login').addEventListener('click', () => {
  criandoConta = false;
  document.querySelector('#name-field').hidden = true;
});

document.querySelector('#show-register').addEventListener('click', () => {
  criandoConta = true;
  document.querySelector('#name-field').hidden = false;
});

// Envia o formulário para entrar ou criar uma conta.
formularioLogin.addEventListener('submit', async evento => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(formularioLogin));
  const rota = criandoConta ? '/api/register' : '/api/login';

  try {
    usuario = await chamarServidor(rota, {
      method: 'POST',
      body: JSON.stringify(dados)
    });
    await mostrarPainel();
  } catch (erro) {
    document.querySelector('#auth-message').textContent = erro.message;
  }
});

// Abre o formulário para adicionar um registro.
document.querySelector('#add-record').addEventListener('click', () => {
  abrirFormulario();
});

// Salva um registro novo ou atualiza o que está sendo editado.
document.querySelector('#record-form').addEventListener('submit', async evento => {
  evento.preventDefault();

  const dados = Object.fromEntries(new FormData(evento.target));
  const rota = idEmEdicao
    ? `/api/${tabelaAtual.chave}/${idEmEdicao}`
    : `/api/${tabelaAtual.chave}`;
  const metodo = idEmEdicao ? 'PUT' : 'POST';

  try {
    await chamarServidor(rota, {
      method: metodo,
      body: JSON.stringify(dados)
    });

    UIkit.modal('#edit-modal').hide();
    mostrarMensagem('Registro salvo.');
    await carregarRegistros();
  } catch (erro) {
    mostrarMensagem(erro.message, true);
  }
});

// Se a pessoa já entrou, abre direto o painel.
chamarServidor('/api/me')
  .then(pessoa => {
    if (pessoa) {
      usuario = pessoa;
      mostrarPainel();
    }
  })
  .catch(() => {});

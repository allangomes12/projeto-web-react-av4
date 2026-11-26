import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [produtos, setProdutos] = useState([]);
  const [mensagem, setMensagem] = useState('Carregando produtos...');

  useEffect(() => {
    fetch('/api/products')
      .then(resposta => resposta.json())
      .then(dados => {
        if (dados.error) {
          setMensagem('Entre no sistema principal primeiro.');
          return;
        }

        setProdutos(dados);
        setMensagem('');
      })
      .catch(() => setMensagem('Não foi possível carregar os produtos.'));
  }, []);

  return (
    <main className="uk-container uk-margin-large-top">
      <a href="http://localhost:3000" className="uk-button uk-button-text">
        Voltar ao sistema principal
      </a>

      <h1 className="uk-heading-small">Produtos da loja</h1>
      <p className="uk-text-muted">Lista feita com React.</p>

      {mensagem && <p>{mensagem}</p>}

      <div className="uk-grid-small uk-child-width-1-3@m" uk-grid="true">
        {produtos.map(produto => (
          <article key={produto.id} className="uk-card uk-card-default uk-card-body">
            <h2 className="uk-card-title">{produto.name}</h2>
            <p>{produto.description || 'Sem descrição.'}</p>
            <strong>R$ {Number(produto.price).toFixed(2)}</strong>
            <p>Estoque: {produto.stock}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

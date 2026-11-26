// Importa as ferramentas que o servidor vai usar.
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

// Conecta o Sequelize ao banco PostgreSQL do Supabase.
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

// MODELS: cada model representa uma tabela do banco.
const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'user' }
});

const Profile = sequelize.define('Profile', {
  phone: DataTypes.STRING,
  address: DataTypes.STRING
});

const Category = sequelize.define('Category', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT
});

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  description: DataTypes.TEXT
});

const Supplier = sequelize.define('Supplier', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: DataTypes.STRING,
  phone: DataTypes.STRING
});

const Customer = sequelize.define('Customer', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: DataTypes.STRING,
  phone: DataTypes.STRING
});

const Order = sequelize.define('Order', {
  orderDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.STRING, defaultValue: 'aberto' },
  total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
});

const OrderItem = sequelize.define('OrderItem', {
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
});

// ASSOCIAÇÕES entre as tabelas.
User.hasOne(Profile);
Profile.belongsTo(User);

Category.hasMany(Product);
Product.belongsTo(Category);

Supplier.hasMany(Product);
Product.belongsTo(Supplier);

Customer.hasMany(Order);
Order.belongsTo(Customer);

Order.belongsToMany(Product, { through: OrderItem });
Product.belongsToMany(Order, { through: OrderItem });

// A lista ajuda o mesmo código a montar as telas CRUD para cada tabela.
const tabelas = {
  users: {
    model: User,
    nome: 'Usuários',
    campos: ['name', 'email', 'role'],
    somenteAdmin: true
  },
  profiles: {
    model: Profile,
    nome: 'Perfis',
    campos: ['phone', 'address', 'UserId'],
    somenteAdmin: true
  },
  categories: {
    model: Category,
    nome: 'Categorias',
    campos: ['name', 'description'],
    somenteAdmin: true
  },
  products: {
    model: Product,
    nome: 'Produtos',
    campos: ['name', 'price', 'stock', 'description', 'CategoryId', 'SupplierId'],
    somenteAdmin: false
  },
  suppliers: {
    model: Supplier,
    nome: 'Fornecedores',
    campos: ['name', 'email', 'phone'],
    somenteAdmin: true
  },
  customers: {
    model: Customer,
    nome: 'Clientes',
    campos: ['name', 'email', 'phone'],
    somenteAdmin: true
  },
  orders: {
    model: Order,
    nome: 'Pedidos',
    campos: ['orderDate', 'status', 'total', 'CustomerId'],
    somenteAdmin: true
  },
  orderItems: {
    model: OrderItem,
    nome: 'Itens do pedido',
    campos: ['quantity', 'unitPrice', 'OrderId', 'ProductId'],
    somenteAdmin: true
  }
};

const app = express();
app.use(express.json());
app.use(express.static('public'));

// A sessão mantém o usuário conectado entre as páginas.
app.use(session({
  secret: process.env.SESSION_SECRET || 'chave-de-desenvolvimento',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

// Verifica se o usuário entrou no sistema.
function verificarLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'Entre no sistema primeiro.' });
  }
  next();
}

// Verifica se o usuário é administrador.
function verificarAdmin(req, res, next) {
  if (req.session.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Esta ação é só para administradores.' });
  }
  next();
}

// Cria uma conta comum.
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Preencha tudo. A senha precisa ter 6 caracteres.' });
    }

    const senhaCriptografada = await bcrypt.hash(password, 10);
    const usuario = await User.create({
      name,
      email,
      password: senhaCriptografada,
      role: 'user'
    });

    req.session.usuario = {
      id: usuario.id,
      name: usuario.name,
      role: usuario.role
    };

    res.status(201).json(req.session.usuario);
  } catch (error) {
    res.status(400).json({ error: 'Não foi possível criar a conta. Confira o e-mail.' });
  }
});

// Confere o e-mail e a senha para entrar.
app.post('/api/login', async (req, res) => {
  const usuario = await User.findOne({ where: { email: req.body.email } });

  if (!usuario || !await bcrypt.compare(req.body.password || '', usuario.password)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  req.session.usuario = {
    id: usuario.id,
    name: usuario.name,
    role: usuario.role
  };

  res.json(req.session.usuario);
});

// O navegador usa essa rota para saber quem está conectado.
app.get('/api/me', (req, res) => {
  res.json(req.session.usuario || null);
});

// Sai da conta.
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Informa à página quais tabelas o usuário pode ver.
app.get('/api/resources', verificarLogin, (req, res) => {
  const lista = Object.entries(tabelas)
    .filter(([chave, tabela]) => {
      return req.session.usuario.role === 'admin' || !tabela.somenteAdmin;
    })
    .map(([chave, tabela]) => ({
      chave,
      nome: tabela.nome,
      campos: tabela.campos
    }));

  res.json(lista);
});

// Cria as rotas de listar, adicionar, editar e excluir para cada tabela.
for (const chave in tabelas) {
  const tabela = tabelas[chave];

  // LISTAR registros.
  app.get(`/api/${chave}`, verificarLogin, async (req, res) => {
    if (tabela.somenteAdmin && req.session.usuario.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
    const opcoes = { order: [['id', 'DESC']] };
    if (chave === 'users') {
      opcoes.attributes = { exclude: ['password'] };
    }
    const registros = await tabela.model.findAll(opcoes);
    res.json(registros);
  });

  // ADICIONAR registro.
  app.post(`/api/${chave}`, verificarLogin, verificarAdmin, async (req, res) => {
    try {
      const dados = {};
      tabela.campos.forEach(campo => {
        dados[campo] = req.body[campo] ?? null;
      });

      if (chave === 'users') {
        dados.password = await bcrypt.hash(req.body.password, 10);
      }

      const registro = await tabela.model.create(dados);
      res.status(201).json(registro);
    } catch (error) {
      res.status(400).json({ error: 'Confira os dados preenchidos.' });
    }
  });

  // EDITAR registro.
  app.put(`/api/${chave}/:id`, verificarLogin, verificarAdmin, async (req, res) => {
    try {
      const registro = await tabela.model.findByPk(req.params.id);

      if (!registro) {
        return res.status(404).json({ error: 'Registro não encontrado.' });
      }

      tabela.campos.forEach(campo => {
        if (req.body[campo] !== undefined) {
          registro[campo] = req.body[campo];
        }
      });

      if (chave === 'users' && req.body.password) {
        registro.password = await bcrypt.hash(req.body.password, 10);
      }

      await registro.save();
      res.json(registro);
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível editar. Confira os dados.' });
    }
  });

  // EXCLUIR registro.
  app.delete(`/api/${chave}/:id`, verificarLogin, verificarAdmin, async (req, res) => {
    const registro = await tabela.model.findByPk(req.params.id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    await registro.destroy();
    res.json({ ok: true });
  });
}

// Inicia o servidor depois de conectar e criar as tabelas.
async function iniciarServidor() {
  await sequelize.authenticate();
  await sequelize.sync();

  // Cria o administrador inicial usando os dados do arquivo .env.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const administrador = await User.findOne({
      where: { email: process.env.ADMIN_EMAIL }
    });

    if (!administrador) {
      await User.create({
        name: 'Administrador',
        email: process.env.ADMIN_EMAIL,
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
        role: 'admin'
      });
    }
  }

  const porta = process.env.PORT || 3000;
  app.listen(porta, () => {
    console.log(`Site aberto em http://localhost:${porta}`);
  });
}

iniciarServidor().catch(error => {
  console.log('Erro ao conectar ao banco:', error.message);
});

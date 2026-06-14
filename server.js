const express = require('express');
const path = require('path');
const { lerLaudoComGroq } = require('./js/groq-client');

const app = express();
const port = process.env.PORT || 3000;
const root = path.join(__dirname);

app.use(express.json({ limit: '6mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.post('/api/groq/ler-laudo', async (req, res) => {
  const { imageDataUrl } = req.body || {};
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Envie uma imagem válida para leitura.' });
  }

  try {
    const leitura = await lerLaudoComGroq(imageDataUrl);
    return res.json(leitura);
  } catch (error) {
    console.error('Falha ao ler laudo com a Groq:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.use(express.static(root, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(root, 'pages', 'app.html'));
});

app.get('/creditos', (req, res) => {
  res.sendFile(path.join(root, 'pages', 'creditos.html'));
});

app.listen(port, () => {
  console.log(`Minhoca Vision rodando em http://localhost:${port}`);
});

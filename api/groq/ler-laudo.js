const { lerLaudoComGroq } = require('../../js/groq-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { imageDataUrl } = req.body || {};
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Envie uma imagem válida para leitura.' });
  }

  try {
    const leitura = await lerLaudoComGroq(imageDataUrl);
    return res.status(200).json(leitura);
  } catch (error) {
    console.error('Falha ao ler laudo com a Groq:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const EXTRACTION_PROMPT = [
  'Leia esta imagem de um laudo laboratorial de solo brasileiro.',
  'Extraia TODO o texto da imagem. Mantenha a formatacao original. Nao resuma. Se houver tabelas, reproduza em Markdown.',
  'Extraia somente valores que estejam visiveis. Nao invente nem estime valores.',
  'Identifique também o estado brasileiro de origem do laudo usando laboratório, endereço, município, cabeçalho, logotipo ou texto visível.',
  'Não deduza o estado apenas por aparência. Quando não houver evidência suficiente, use null.',
  'Retorne um objeto JSON com exatamente estas chaves:',
  'argila, ph, smp, p, k, mo, al, ca, mg, hAl, ctc, v, m, estado, evidenciaEstado, confiancaEstado.',
  'Use null quando um campo nao estiver legivel ou nao aparecer.',
  'Em estado, use somente a sigla UF com duas letras. Em confiancaEstado, use alta, media ou baixa.',
  'Mantenha apenas o valor numerico de cada campo, usando ponto como separador decimal.'
].join(' ');

const PARAMETER_KEYS = ['argila', 'ph', 'smp', 'p', 'k', 'mo', 'al', 'ca', 'mg', 'hAl', 'ctc', 'v', 'm'];

function chaveCanonicaParametro(chave) {
  const limpo = String(chave || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!limpo) return null;
  if (limpo === 'argila') return 'argila';
  if (limpo === 'ph' || limpo === 'phh2o' || limpo === 'phagua' || limpo === 'phcacl2') return 'ph';
  if (limpo === 'smp' || limpo === 'indicesmp') return 'smp';
  if (limpo === 'p' || limpo === 'fosforo') return 'p';
  if (limpo === 'k' || limpo === 'potassio') return 'k';
  if (limpo === 'mo' || limpo === 'materiaorganica') return 'mo';
  if (limpo === 'al' || limpo === 'aluminio') return 'al';
  if (limpo === 'ca' || limpo === 'calcio') return 'ca';
  if (limpo === 'mg' || limpo === 'magnesio') return 'mg';
  if (limpo === 'hal' || limpo === 'hmaisal' || limpo === 'hacidezpotencial') return 'hAl';
  if (limpo === 'ctc' || limpo === 'ctcph7' || limpo === 'ctctotal') return 'ctc';
  if (limpo === 'v' || limpo === 'vpercentual' || limpo === 'satbases') return 'v';
  if (limpo === 'm' || limpo === 'mpercentual' || limpo === 'satal') return 'm';
  return null;
}

function numeroSeguro(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }

  if (typeof valor === 'string') {
    const normalizado = valor
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
      .trim();
    if (!normalizado) return null;
    const numero = Number.parseFloat(normalizado);
    return Number.isFinite(numero) ? numero : null;
  }

  if (valor && typeof valor === 'object') {
    if ('value' in valor) return numeroSeguro(valor.value);
    if ('valor' in valor) return numeroSeguro(valor.valor);
  }

  return null;
}

function extrairParametros(content) {
  const parametros = {};
  PARAMETER_KEYS.forEach((key) => {
    parametros[key] = null;
  });

  const fontes = [content?.parametros, content?.parameters, content?.dados, content].filter(
    (item) => item && typeof item === 'object'
  );

  fontes.forEach((fonte) => {
    Object.entries(fonte).forEach(([chave, valor]) => {
      const canonica = chaveCanonicaParametro(chave);
      if (!canonica || parametros[canonica] !== null) return;
      parametros[canonica] = numeroSeguro(valor);
    });
  });

  return parametros;
}

function coletarParesRecursivos(content, acumulador = []) {
  if (!content || typeof content !== 'object') return acumulador;

  if (Array.isArray(content)) {
    content.forEach((item) => coletarParesRecursivos(item, acumulador));
    return acumulador;
  }

  Object.entries(content).forEach(([chave, valor]) => {
    acumulador.push([chave, valor]);
    if (valor && typeof valor === 'object') coletarParesRecursivos(valor, acumulador);
  });
  return acumulador;
}

function extrairParametrosRecursivos(content) {
  const parametros = {};
  PARAMETER_KEYS.forEach((key) => {
    parametros[key] = null;
  });

  coletarParesRecursivos(content).forEach(([chave, valor]) => {
    const canonica = chaveCanonicaParametro(chave);
    if (!canonica || parametros[canonica] !== null) return;
    parametros[canonica] = numeroSeguro(valor);
  });

  return parametros;
}

function extrairParametrosDeTextoLivre(content) {
  const texto = JSON.stringify(content || {}).replace(/,/g, '.');
  const capturar = (regex) => {
    const m = texto.match(regex);
    if (!m) return null;
    const valor = Number.parseFloat(String(m[1] || '').replace(',', '.'));
    return Number.isFinite(valor) ? valor : null;
  };

  return {
    argila: capturar(/"?(?:argila)"?\s*[:=]\s*"?([\d.]+)/i),
    ph: capturar(/"?(?:ph|phh2o|phagua)"?\s*[:=]\s*"?([\d.]+)/i),
    smp: capturar(/"?(?:smp|indicesmp)"?\s*[:=]\s*"?([\d.]+)/i),
    p: capturar(/"?(?:p|fosforo)"?\s*[:=]\s*"?([\d.]+)/i),
    k: capturar(/"?(?:k|potassio)"?\s*[:=]\s*"?([\d.]+)/i),
    mo: capturar(/"?(?:mo|materiaorganica)"?\s*[:=]\s*"?([\d.]+)/i),
    al: capturar(/"?(?:al|aluminio)"?\s*[:=]\s*"?([\d.]+)/i),
    ca: capturar(/"?(?:ca|calcio)"?\s*[:=]\s*"?([\d.]+)/i),
    mg: capturar(/"?(?:mg|magnesio)"?\s*[:=]\s*"?([\d.]+)/i),
    hAl: capturar(/"?(?:hal|h\+?al|hmaisal|acidezpotencial)"?\s*[:=]\s*"?([\d.]+)/i),
    ctc: capturar(/"?(?:ctc|ctcph7|ctctotal)"?\s*[:=]\s*"?([\d.]+)/i),
    v: capturar(/"?(?:v|satbases|vpercentual)"?\s*[:=]\s*"?([\d.]+)/i),
    m: capturar(/"?(?:m|satal|mpercentual)"?\s*[:=]\s*"?([\d.]+)/i)
  };
}

function combinarParametros(...grupos) {
  const parametros = {};
  PARAMETER_KEYS.forEach((key) => {
    parametros[key] = null;
  });

  grupos.forEach((grupo) => {
    PARAMETER_KEYS.forEach((key) => {
      if (parametros[key] !== null) return;
      const valor = numeroSeguro(grupo?.[key]);
      if (valor !== null) parametros[key] = valor;
    });
  });

  return parametros;
}

function normalizarLeitura(content) {
  const parametrosDiretos = extrairParametros(content || {});
  const parametrosRecursivos = extrairParametrosRecursivos(content || {});
  const parametrosTextoLivre = extrairParametrosDeTextoLivre(content || {});
  const parametros = combinarParametros(parametrosDiretos, parametrosRecursivos, parametrosTextoLivre);

  const estadoBruto = content?.estado || content?.uf || content?.estadoOrigem || content?.state || null;
  const estado = typeof estadoBruto === 'string' ? estadoBruto.trim().toUpperCase() : null;
  const evidenciaBruta = content?.evidenciaEstado || content?.evidencia || content?.fonteEstado || '';
  const confiancaBruta = content?.confiancaEstado || content?.confianca || 'baixa';

  return {
    parametros,
    localizacao: {
      estado: /^[A-Z]{2}$/.test(estado || '') ? estado : null,
      evidencia: typeof evidenciaBruta === 'string' ? evidenciaBruta.trim() : '',
      confianca: typeof confiancaBruta === 'string' ? confiancaBruta.trim().toLowerCase() : 'baixa'
    }
  };
}

async function lerLaudoComGroq(imageDataUrl) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error = new Error('A variável GROQ_API_KEY não está configurada no servidor.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      temperature: 0,
      max_completion_tokens: 700,
      response_format: { type: 'json_object' }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `A Groq respondeu com status ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('A Groq não retornou conteúdo para a imagem.');
    error.statusCode = 502;
    throw error;
  }

  try {
    return normalizarLeitura(JSON.parse(content));
  } catch {
    const error = new Error('A Groq retornou uma resposta que não é JSON válido.');
    error.statusCode = 502;
    throw error;
  }
}

module.exports = { lerLaudoComGroq };

const loginForm = document.getElementById('loginForm');
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const userBadge = document.getElementById('userBadge');
const greeting = document.getElementById('greeting');
const userLocation = document.getElementById('userLocation');
const imageInput = document.getElementById('imageInput');
const cameraInput = document.getElementById('cameraInput');
const selectedImageName = document.getElementById('selectedImageName');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewText = document.getElementById('imagePreviewText');
const startAnalysis = document.getElementById('startAnalysis');
const soilReportText = document.getElementById('soilReportText');
const ocrStatus = document.getElementById('ocrStatus');
const cropSelect = document.getElementById('cropSelect');
const progressFill = document.getElementById('progressFill');
const resultSection = document.getElementById('resultSection');
const descriptionText = document.getElementById('descriptionText');
const simpleSummaryList = document.getElementById('simpleSummaryList');
const diagnosisText = document.getElementById('diagnosisText');
const recommendationList = document.getElementById('recommendationList');
const technicalReportText = document.getElementById('technicalReportText');
const detectedElementsList = document.getElementById('detectedElementsList');
const npkSummaryList = document.getElementById('npkSummaryList');
const ANALYSIS_CATEGORY = 'Laudo laboratorial de solo';
const OCR_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const OCR_LOCAL_LANG = 'por';
const OCR_LANG_SOURCES = [
  { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0', gzip: true },
  { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int', gzip: true },
  { langPath: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main', gzip: false }
];

let achievements = JSON.parse(localStorage.getItem('minhocaAchievements') || '[]');
let userData = JSON.parse(localStorage.getItem('minhocaUser') || 'null');
let selectedImageFile = null;

const recommendations = {
  Solo: [
    'Aumentar adubação orgânica.',
    'Verificar compactação do solo e fazer revolvimento leve.',
    'Controlar pH e matéria orgânica.'
  ],
  Irrigação: [
    'Ajustar frequência e volume de água.',
    'Evitar acúmulo de água e encharcamento.',
    'Instalar irrigação por gotejamento quando possível.'
  ],
  Resíduos: [
    'Remover lixo e resíduos do campo.',
    'Destinar corretamente materiais orgânicos e plásticos.',
    'Criar ponto de coleta para descarte sustentável.'
  ],
  Plantações: [
    'Observar folhas amareladas e ajustar nutrição.',
    'Monitorar manchas e sinais de pragas.',
    'Garantir espaçamento adequado entre plantas.'
  ]
};

function updateSelectedImage(file, sourceInput) {
  if (!file) {
    selectedImageFile = null;
    imagePreview.removeAttribute('src');
    imagePreview.parentElement.classList.remove('has-image');
    imagePreviewText.textContent = 'Imagem escolhida';
    selectedImageName.textContent = 'Nenhuma imagem escolhida';
    startAnalysis.textContent = 'Interpretar laudo';
    return;
  }

  selectedImageFile = file;
  selectedImageName.textContent = file.name || 'Imagem selecionada';
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.parentElement.classList.add('has-image');
  imagePreviewText.textContent = '';

  if (sourceInput === imageInput) cameraInput.value = '';
  if (sourceInput === cameraInput) imageInput.value = '';
  startAnalysis.textContent = 'Ler valores da foto';
  ocrStatus.textContent = 'Imagem pronta. Clique em interpretar para ler os valores do laudo.';
}

imageInput.addEventListener('change', () => {
  updateSelectedImage(imageInput.files[0], imageInput);
});

cameraInput.addEventListener('change', () => {
  updateSelectedImage(cameraInput.files[0], cameraInput);
});

function saveUser(data) {
  localStorage.setItem('minhocaUser', JSON.stringify(data));
}

function saveAchievements() {
  localStorage.setItem('minhocaAchievements', JSON.stringify(achievements));
}

function renderDashboard() {
  if (!userData) return;
  greeting.textContent = `Olá, ${userData.name}!`;
  userLocation.textContent = `Cidade: ${userData.city}`;
  userBadge.classList.remove('hidden');
}

function parametrosGroqParaTexto(parametros) {
  const chaves = ['argila', 'ph', 'smp', 'p', 'k', 'mo', 'al', 'ca', 'mg', 'hAl', 'ctc', 'v', 'm'];
  return chaves
    .map((chave) => {
      const normalizado = normalizarParametroFinal(chave, Number.parseFloat(String(parametros?.[chave] ?? '').replace(',', '.')));
      return `${chave}: ${normalizado ?? ''}`;
    })
    .join('\n');
}

async function reconhecerComFallbackOCR(Tesseract, imagem, opcoes) {
  let ultimoErro = null;
  for (const fonte of OCR_LANG_SOURCES) {
    try {
      return await Tesseract.recognize(imagem, OCR_LOCAL_LANG, {
        ...opcoes,
        langPath: fonte.langPath,
        gzip: fonte.gzip
      });
    } catch (error) {
      ultimoErro = error;
      console.warn(`Falha no OCR com ${fonte.langPath}. Tentando próxima fonte...`);
    }
  }

  throw ultimoErro || new Error('Falha ao carregar o modelo OCR em todas as fontes configuradas.');
}

async function extractImageStats(imageFile) {
  const bitmap = await createImageBitmap(imageFile);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();

  const pixels = context.getImageData(0, 0, size, size).data;
  let green = 0;
  let brown = 0;
  let blue = 0;
  let yellow = 0;
  let gray = 0;
  let bright = 0;
  let dark = 0;
  let contrast = 0;
  let saturation = 0;
  let previousLuma = null;

  for (let i = 0; i < pixels.length; i += 4) {
    const red = pixels[i];
    const greenChannel = pixels[i + 1];
    const blueChannel = pixels[i + 2];
    const luma = (red + greenChannel + blueChannel) / 3;
    const maxChannel = Math.max(red, greenChannel, blueChannel);
    const minChannel = Math.min(red, greenChannel, blueChannel);

    if (greenChannel > red * 1.12 && greenChannel > blueChannel * 1.12) green += 1;
    if (red > greenChannel * 0.85 && greenChannel > blueChannel * 0.75 && red > blueChannel * 1.25) brown += 1;
    if (blueChannel > red * 1.15 && blueChannel > greenChannel * 1.05) blue += 1;
    if (red > 135 && greenChannel > 115 && blueChannel < 95) yellow += 1;
    if (maxChannel - minChannel < 28) gray += 1;
    if (luma > 190) bright += 1;
    if (luma < 70) dark += 1;
    if (previousLuma !== null) contrast += Math.abs(luma - previousLuma);
    saturation += maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    previousLuma = luma;
  }

  const total = size * size;
  return {
    greenRatio: green / total,
    brownRatio: brown / total,
    blueRatio: blue / total,
    yellowRatio: yellow / total,
    grayRatio: gray / total,
    brightRatio: bright / total,
    darkRatio: dark / total,
    texture: contrast / total,
    saturation: saturation / total
  };
}

function categoryKey(category) {
  const normalized = category.toLowerCase();
  if (normalized.includes('solo')) return 'solo';
  if (normalized.includes('irriga')) return 'irrigacao';
  if (normalized.includes('res')) return 'residuos';
  if (normalized.includes('planta')) return 'plantacoes';
  return 'geral';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(value) {
  return Math.round(value * 100);
}

function confidenceFromSignals(...signals) {
  const strength = signals.reduce((total, signal) => total + Math.abs(signal), 0) / signals.length;
  return clamp(Math.round(58 + strength * 42), 58, 92);
}

function textoParecer(parecer) {
  return parecer.startsWith('Parecer geral:') ? parecer : `Parecer geral: ${parecer}`;
}

function describeImageStats(stats) {
  const leitura = [];
  const elementos = [];
  const limitacoes = [];

  if (stats.brownRatio > 0.3) {
    leitura.push(`predominância de solo ou material orgânico em tons terrosos (${percent(stats.brownRatio)}%)`);
    elementos.push('solo aparente');
  } else if (stats.brownRatio > 0.16) {
    leitura.push('presença moderada de áreas terrosas');
    elementos.push('áreas de solo');
  }

  if (stats.brightRatio > 0.34) {
    leitura.push(`muitas áreas claras (${percent(stats.brightRatio)}%), sugerindo solo exposto, palha clara ou iluminação forte`);
    elementos.push('superfície clara/exposta');
  } else if (stats.brightRatio > 0.22) {
    leitura.push(`algumas áreas claras (${percent(stats.brightRatio)}%)`);
  }

  if (stats.yellowRatio > 0.14) {
    leitura.push(`tons amarelados ou secos (${percent(stats.yellowRatio)}%), que podem representar palha, folhas secas ou vegetação com estresse`);
    elementos.push('possível palha ou folha seca');
  }

  if (stats.greenRatio > 0.36) {
    leitura.push(`boa presença de vegetação verde (${percent(stats.greenRatio)}%)`);
    elementos.push('vegetação verde');
  } else if (stats.greenRatio > 0.18) {
    leitura.push(`cobertura vegetal parcial (${percent(stats.greenRatio)}% de tons verdes)`);
    elementos.push('vegetação esparsa');
  } else {
    leitura.push('baixa presença de vegetação verde visível');
    elementos.push('pouca cobertura vegetal aparente');
  }

  if (stats.blueRatio > 0.12) {
    leitura.push('pontos azulados que podem estar ligados a água, sombra fria ou reflexo');
    elementos.push('possível água/reflexo');
  }

  if (stats.darkRatio > 0.34) {
    leitura.push(`áreas escuras relevantes (${percent(stats.darkRatio)}%), que podem indicar sombra, solo úmido ou matéria orgânica escura`);
    elementos.push('áreas escuras');
  }

  if (stats.texture > 34) {
    leitura.push('textura bem irregular, com variação visual entre os pontos da imagem');
  } else if (stats.texture < 14) {
    leitura.push('textura visual uniforme, com poucos contrastes');
    limitacoes.push('a baixa variação visual limita a identificação de objetos pequenos');
  }

  if (stats.brightRatio > 0.38 && stats.texture > 28) {
    elementos.push('possível objeto claro ou resíduo, como plástico/embalagem, se houver formato definido na foto');
  }

  if (stats.grayRatio > 0.32 && stats.texture > 30) {
    elementos.push('possível material acinzentado ou objeto artificial');
  }

  if (!leitura.length) {
    leitura.push('padrão visual misto, sem predominância forte de cor ou textura');
  }

  const textoElementos = elementos.length ? ` Elementos prováveis: ${elementos.join(', ')}.` : '';
  const textoLimitacoes = limitacoes.length ? ` Limitação: ${limitacoes.join('; ')}.` : '';

  return `A imagem mostra ${leitura.join(', ')}.${textoElementos}${textoLimitacoes}`;
}

function identificarElementosVisuais(stats, category, modelLabel = '') {
  const elementos = [];
  const key = categoryKey(category);
  const label = modelLabel.toLowerCase();

  if (modelLabel && !modelLabel.includes('Padrão local')) {
    elementos.push({
      nome: modelLabel,
      evidencia: 'rótulo retornado pelo modelo de classificação local',
      confianca: 'Médio'
    });
  }

  if (stats.greenRatio > 0.36) {
    elementos.push({
      nome: key === 'plantacoes' ? 'plantação ou cultura agrícola com boa cobertura verde' : 'vegetação verde',
      evidencia: `${percent(stats.greenRatio)}% de predominância verde na imagem`,
      confianca: 'Médio'
    });
  } else if (stats.greenRatio > 0.18) {
    elementos.push({
      nome: 'vegetação esparsa ou cobertura vegetal parcial',
      evidencia: `${percent(stats.greenRatio)}% de tons verdes`,
      confianca: 'Médio'
    });
  }

  if (stats.brownRatio > 0.28) {
    elementos.push({
      nome: 'solo aparente ou material orgânico em tons terrosos',
      evidencia: `${percent(stats.brownRatio)}% de tons terrosos`,
      confianca: 'Médio'
    });
  } else if (stats.brownRatio > 0.16) {
    elementos.push({
      nome: 'áreas de solo visíveis',
      evidencia: `${percent(stats.brownRatio)}% de tons terrosos moderados`,
      confianca: 'Baixo'
    });
  }

  if (stats.brightRatio > 0.32) {
    elementos.push({
      nome: 'solo exposto, palha clara ou área muito iluminada',
      evidencia: `${percent(stats.brightRatio)}% de áreas claras`,
      confianca: 'Baixo'
    });
  }

  if (stats.yellowRatio > 0.12 && stats.brownRatio > 0.16) {
    elementos.push({
      nome: 'possível palha, folha seca ou resíduo vegetal',
      evidencia: `${percent(stats.yellowRatio)}% de tons amarelados/secos`,
      confianca: 'Baixo'
    });
  }

  if (stats.greenRatio <= 0.18) {
    elementos.push({
      nome: 'pouca vegetação verde aparente',
      evidencia: `${percent(stats.greenRatio)}% de tons verdes`,
      confianca: 'Médio'
    });
  }

  if (stats.blueRatio > 0.12 || stats.darkRatio > 0.4) {
    elementos.push({
      nome: 'possível água, solo úmido ou sombra intensa',
      evidencia: `${percent(Math.max(stats.blueRatio, stats.darkRatio))}% de áreas azuladas/escuras`,
      confianca: 'Baixo'
    });
  }

  if (stats.brightRatio > 0.34 && stats.texture > 24) {
    elementos.push({
      nome: 'possível plástico, embalagem, garrafa ou outro resíduo claro',
      evidencia: `${percent(stats.brightRatio)}% de pontos claros com textura irregular`,
      confianca: 'Baixo'
    });
  }

  if (stats.grayRatio > 0.32 && stats.texture > 30) {
    elementos.push({
      nome: 'possível objeto artificial ou material acinzentado',
      evidencia: `${percent(stats.grayRatio)}% de áreas acinzentadas com padrão irregular`,
      confianca: 'Baixo'
    });
  }

  if (label.includes('corn') || label.includes('maize') || label.includes('milho')) {
    elementos.push({ nome: 'possível milho', evidencia: 'rótulo do modelo sugere milho', confianca: 'Médio' });
  }

  if (label.includes('soy') || label.includes('soja')) {
    elementos.push({ nome: 'possível soja', evidencia: 'rótulo do modelo sugere soja', confianca: 'Médio' });
  }

  if (label.includes('bottle') || label.includes('garrafa')) {
    elementos.push({ nome: 'possível garrafa', evidencia: 'rótulo do modelo sugere garrafa', confianca: 'Médio' });
  }

  if (label.includes('pencil') || label.includes('lapis') || label.includes('lápis')) {
    elementos.push({ nome: 'possível lápis', evidencia: 'rótulo do modelo sugere lápis', confianca: 'Médio' });
  }

  if (!elementos.length) {
    elementos.push({
      nome: 'elementos visuais pouco definidos',
      evidencia: 'a imagem não apresenta predominância clara de cor, textura ou objeto',
      confianca: 'Baixo'
    });
  }

  return elementos;
}

function avaliarContextoAgricola(stats, category, modelLabel = '') {
  const label = modelLabel.toLowerCase();
  const termosAgricolas = [
    'soil',
    'plant',
    'leaf',
    'crop',
    'grass',
    'field',
    'corn',
    'maize',
    'soy',
    'soja',
    'milho',
    'solo',
    'planta',
    'folha',
    'vegetacao',
    'vegetação'
  ];

  if (termosAgricolas.some((termo) => label.includes(termo))) {
    return { reconhecido: true, motivo: 'o rótulo do modelo sugere relação com agricultura ou ambiente rural' };
  }

  const sinalNatural = stats.greenRatio + stats.brownRatio + stats.yellowRatio + Math.min(stats.darkRatio, 0.25);
  const temSoloOuVegetacao = stats.greenRatio > 0.12 || stats.brownRatio > 0.14 || stats.yellowRatio > 0.12;
  const pareceObjetoArtificial = stats.grayRatio > 0.46 && stats.saturation < 0.18 && stats.brownRatio < 0.16 && stats.greenRatio < 0.12;
  const pareceCenaInternaClara = stats.brightRatio > 0.55 && stats.greenRatio < 0.08 && stats.brownRatio < 0.12;
  const sinalMuitoFraco = sinalNatural < 0.18 && stats.texture < 22;

  if (!temSoloOuVegetacao || pareceObjetoArtificial || pareceCenaInternaClara || sinalMuitoFraco) {
    return {
      reconhecido: false,
      motivo: 'a imagem não apresenta sinais visuais suficientes de solo, vegetação, plantação, irrigação ou área rural'
    };
  }

  return { reconhecido: true, motivo: 'a imagem apresenta sinais visuais compatíveis com solo, vegetação ou área rural' };
}

function gerarResultadoForaDoTema(stats, category, motivo) {
  return {
    label: 'não foi possível reconhecer uma cena relacionada ao tema escolhido',
    confidence: 35,
    priority: 'Baixa',
    recommendations: [],
    description: describeImageStats(stats),
    detectedElements: [
      {
        nome: 'imagem fora do contexto agro ou pouco reconhecível',
        evidencia: motivo,
        confianca: 'Médio'
      }
    ],
    simpleSummary: 'Essa imagem não parece mostrar solo, plantação, irrigação, resíduos no campo ou outro elemento rural suficiente para análise. Envie uma foto mais próxima e clara da área que deseja avaliar.',
    soilOpinion: 'Não foi possível gerar parecer agrícola confiável para esta imagem.',
    technicalReport: {
      qualidadeImagem: qualidadeDaImagem(stats),
      status: 'fora_do_contexto',
      categoriaSolicitada: category,
      motivo,
      problemas: [],
      recomendacoes: [],
      resumo: 'A imagem não apresentou evidências visuais suficientes para uma análise agrícola. Nenhuma recomendação técnica foi gerada.'
    }
  };
}

function gerarResumoSimples(resultado, category) {
  if (resultado.simpleSummary) return resultado.simpleSummary;

  if (resultado.technicalReport?.status === 'fora_do_contexto') {
    return 'Não deu para analisar essa imagem dentro do tema rural. Tente enviar uma foto de solo, planta, irrigação ou resíduo no campo.';
  }

  if (!resultado.technicalReport) {
    return 'A imagem foi analisada, mas o resumo simples só fica mais completo quando há relatório técnico.';
  }

  const problemas = resultado.technicalReport.problemas || [];
  if (!problemas.length) {
    return `A imagem parece estar dentro do tema ${category}. Não apareceu nenhum problema visual importante. Mesmo assim, vale conferir no local para ter certeza.`;
  }

  const principal = problemas[0];
  return `A imagem parece estar dentro do tema ${category}. O principal ponto de atenção é: ${principal.nome}. Isso foi marcado como severidade ${principal.severidade}. Confira no local antes de tomar uma decisão.`;
}

function calcularIndiceDaImagem(relatorio) {
  if (!relatorio || relatorio.status === 'fora_do_contexto') {
    return {
      valor: null,
      texto: 'Não calculado',
      classificacao: 'Imagem fora do tema',
      motivo: 'A imagem não tem evidências suficientes para avaliar sustentabilidade.'
    };
  }

  let valor = 100;
  const problemas = relatorio.problemas || [];

  problemas.forEach((problema) => {
    if (problema.severidade === 'Alto') valor -= 35;
    else if (problema.severidade === 'Médio') valor -= 22;
    else valor -= 10;
  });

  if (String(relatorio.qualidadeImagem || '').startsWith('Baixa')) {
    valor -= 10;
  }

  valor = clamp(valor, 0, 100);

  let classificacao = 'Boa';
  if (valor < 40) classificacao = 'Crítica';
  else if (valor < 70) classificacao = 'Atenção';
  else if (valor < 90) classificacao = 'Adequada';

  const motivo = problemas.length
    ? `Desconto aplicado por ${problemas.length} problema(s) visual(is) encontrado(s).`
    : 'Nenhum problema visual relevante foi encontrado nesta imagem.';

  return {
    valor,
    texto: `${valor}/100 - ${classificacao}`,
    classificacao,
    motivo
  };
}

function gerarParecerGeralSolo(stats) {
  if (stats.darkRatio > 0.38 || stats.blueRatio > 0.18) {
    return 'Parecer geral: pela imagem, o solo aparenta estar com umidade elevada. Isso pode ser positivo se houver boa drenagem, mas merece atenção para evitar encharcamento, compactação e baixa oxigenação das raízes.';
  }

  if (stats.brightRatio > 0.34 || stats.yellowRatio > 0.18) {
    return 'Parecer geral: pela imagem, o solo parece exposto ou com sinais de ressecamento superficial. A prioridade é proteger a superfície, melhorar retenção de água e reforçar matéria orgânica.';
  }

  if (stats.brownRatio > 0.32 && stats.texture > 24) {
    return 'Parecer geral: pela imagem, o solo aparenta boa condição superficial, com tons terrosos e textura mais granulada. O manejo parece favorável para manter matéria orgânica, infiltração e atividade biológica.';
  }

  if (stats.greenRatio > 0.32) {
    return 'Parecer geral: a cobertura vegetal é um bom sinal para conservação do solo, pois ajuda a reduzir erosão, perda de umidade e aquecimento da superfície.';
  }

  if (stats.texture < 14) {
    return 'Parecer geral: a superfície parece muito uniforme, o que pode indicar compactação, pouca palhada ou baixa diversidade visual. Vale verificar a estrutura do solo manualmente.';
  }

  return 'Parecer geral: o solo aparenta condição intermediária pela imagem. Não há um sinal visual crítico dominante, mas vale acompanhar umidade, cobertura e textura em novas fotos.';
}

function nivelConfianca(valor) {
  if (valor >= 0.36) return 'Alto';
  if (valor >= 0.18) return 'Médio';
  return 'Baixo';
}

function qualidadeDaImagem(stats) {
  if (stats.darkRatio > 0.62) return 'Baixa: imagem com muitas áreas escuras, o que limita a análise visual.';
  if (stats.brightRatio > 0.62) return 'Baixa: imagem com muitas áreas claras, possivelmente superexposta.';
  if (stats.texture < 8 && stats.saturation < 0.12) return 'Média: poucos contrastes visuais para diferenciar solo, vegetação e resíduos.';
  return 'Boa: imagem com contraste suficiente para análise visual preliminar.';
}

function adicionarProblema(lista, nome, descricao, severidade, confianca) {
  lista.push({ nome, descricao, severidade, confianca });
}

function recomendacoesParaProblemas(problemas) {
  const recomendacoes = [];
  const nomes = problemas.map((problema) => problema.nome);

  if (nomes.includes('Solo exposto ou ressecamento superficial')) {
    recomendacoes.push({
      acao: 'Adicionar cobertura vegetal, palhada ou matéria orgânica sobre o solo exposto.',
      beneficio: 'Reduz perda de umidade, aquecimento da superfície e risco de erosão.',
      facilidade: 'Média'
    });
  }

  if (nomes.includes('Possível excesso de umidade')) {
    recomendacoes.push({
      acao: 'Revisar frequência de irrigação e observar pontos de acúmulo após chuva ou rega.',
      beneficio: 'Ajuda a evitar encharcamento, compactação e baixa oxigenação das raízes.',
      facilidade: 'Fácil'
    });
  }

  if (nomes.includes('Baixa cobertura vegetal')) {
    recomendacoes.push({
      acao: 'Implantar ou manter cobertura vegetal nas áreas descobertas.',
      beneficio: 'Melhora conservação do terreno e reduz risco de erosão.',
      facilidade: 'Média'
    });
  }

  if (nomes.includes('Possível compactação superficial')) {
    recomendacoes.push({
      acao: 'Verificar compactação em campo com teste manual e evitar tráfego intenso no local.',
      beneficio: 'Favorece infiltração de água e desenvolvimento radicular.',
      facilidade: 'Fácil'
    });
  }

  return recomendacoes;
}

function gerarRelatorioSolo(stats) {
  const problemas = [];
  const vegetacaoBaixa = stats.greenRatio < 0.16;
  const soloExposto = stats.brightRatio > 0.32 || stats.yellowRatio > 0.18;
  const excessoUmidade = stats.darkRatio > 0.38 || stats.blueRatio > 0.18;
  const texturaUniforme = stats.texture < 14;
  const materiaOrganicaVisivel = stats.brownRatio > 0.32 && stats.texture > 24;

  if (soloExposto) {
    adicionarProblema(
      problemas,
      'Solo exposto ou ressecamento superficial',
      'A imagem sugere áreas claras ou tons amarelados/secos na superfície. Isso pode indicar exposição do solo, baixa cobertura ou perda de umidade superficial.',
      stats.brightRatio > 0.45 ? 'Alto' : 'Médio',
      nivelConfianca(Math.max(stats.brightRatio, stats.yellowRatio))
    );
  }

  if (excessoUmidade) {
    adicionarProblema(
      problemas,
      'Possível excesso de umidade',
      'Há indícios visuais de áreas escuras ou azuladas que podem estar associados a sombra, água acumulada ou solo muito úmido.',
      stats.darkRatio > 0.5 ? 'Alto' : 'Médio',
      nivelConfianca(Math.max(stats.darkRatio, stats.blueRatio))
    );
  }

  if (vegetacaoBaixa) {
    adicionarProblema(
      problemas,
      'Baixa cobertura vegetal',
      'A presença de tons verdes é baixa na imagem, o que sugere pouca cobertura vegetal aparente.',
      'Médio',
      nivelConfianca(1 - stats.greenRatio)
    );
  }

  if (texturaUniforme) {
    adicionarProblema(
      problemas,
      'Possível compactação superficial',
      'A superfície aparenta textura muito uniforme. Isso pode ser indício visual de compactação ou pouca estrutura, mas exige confirmação em campo.',
      'Baixo',
      nivelConfianca(1 - stats.texture / 24)
    );
  }

  const condicaoSoloDescricao = materiaOrganicaVisivel
    ? 'O solo aparenta tons terrosos escuros e textura granulada, o que sugere possível presença de matéria orgânica visível e estrutura superficial favorável.'
    : 'O solo apresenta condição visual intermediária ou pouco definida. Não é possível afirmar composição, pH ou nutrientes apenas pela imagem.';

  const condicaoPlantasDescricao = stats.greenRatio > 0.32
    ? 'A vegetação aparenta boa cobertura verde e desenvolvimento visual relativamente uniforme.'
    : stats.yellowRatio > 0.16
      ? 'A vegetação, quando presente, mostra possíveis tons amarelados ou secos, o que pode sugerir estresse hídrico ou nutricional visível.'
      : 'Há pouca vegetação visível ou cobertura vegetal insuficiente para uma avaliação detalhada das plantas.';

  return {
    qualidadeImagem: qualidadeDaImagem(stats),
    condicaoSolo: {
      descricao: condicaoSoloDescricao,
      confianca: nivelConfianca(Math.max(stats.brownRatio, stats.brightRatio, stats.darkRatio))
    },
    condicaoPlantas: {
      descricao: condicaoPlantasDescricao,
      confianca: nivelConfianca(Math.max(stats.greenRatio, stats.yellowRatio))
    },
    problemas,
    recomendacoes: recomendacoesParaProblemas(problemas),
    resumo: problemas.length
      ? `Foram encontrados ${problemas.length} indício(s) visual(is) que merecem atenção. A análise deve ser confirmada em campo antes de decisões corretivas.`
      : 'Não foram encontrados problemas visuais relevantes. O solo aparenta condição geral aceitável pela imagem, com recomendação de monitoramento periódico.'
  };
}

function gerarRelatorioIrrigacao(stats) {
  const problemas = [];
  const excessoAgua = stats.darkRatio > 0.38 || stats.blueRatio > 0.18;
  const faltaAgua = stats.brightRatio > 0.34 || stats.yellowRatio > 0.18;
  const possivelDrenagemIrregular = stats.texture > 36 && stats.darkRatio > 0.24;

  if (excessoAgua) {
    adicionarProblema(
      problemas,
      'Possível excesso de água',
      'A imagem apresenta áreas escuras ou azuladas que podem sugerir umidade elevada, água acumulada ou sombra intensa.',
      stats.darkRatio > 0.5 ? 'Alto' : 'Médio',
      nivelConfianca(Math.max(stats.darkRatio, stats.blueRatio))
    );
  }

  if (faltaAgua) {
    adicionarProblema(
      problemas,
      'Possível falta de água',
      'Há áreas claras ou amareladas que podem indicar ressecamento superficial, baixa umidade aparente ou exposição ao sol.',
      stats.brightRatio > 0.48 ? 'Alto' : 'Médio',
      nivelConfianca(Math.max(stats.brightRatio, stats.yellowRatio))
    );
  }

  if (possivelDrenagemIrregular) {
    adicionarProblema(
      problemas,
      'Possível drenagem irregular',
      'A combinação de textura irregular e áreas escuras sugere distribuição desigual de água ou pontos de acúmulo.',
      'Médio',
      nivelConfianca(Math.max(stats.texture / 55, stats.darkRatio))
    );
  }

  const recomendacoes = [];
  problemas.forEach((problema) => {
    if (problema.nome === 'Possível excesso de água') {
      recomendacoes.push({
        acao: 'Reduzir temporariamente a frequência ou duração da irrigação e observar a resposta visual do solo.',
        beneficio: 'Diminui risco de encharcamento, compactação e baixa oxigenação das raízes.',
        facilidade: 'Fácil'
      });
    }
    if (problema.nome === 'Possível falta de água') {
      recomendacoes.push({
        acao: 'Verificar cobertura do sistema de irrigação e avaliar aumento gradual da frequência.',
        beneficio: 'Ajuda a corrigir déficit hídrico aparente sem provocar excesso de água.',
        facilidade: 'Média'
      });
    }
    if (problema.nome === 'Possível drenagem irregular') {
      recomendacoes.push({
        acao: 'Mapear os pontos escuros e observar se a água permanece acumulada após irrigação ou chuva.',
        beneficio: 'Facilita identificar falhas de nivelamento, drenagem ou distribuição de água.',
        facilidade: 'Média'
      });
    }
  });

  return {
    qualidadeImagem: qualidadeDaImagem(stats),
    usoAgua: {
      descricao: problemas.length
        ? 'Há indícios visuais que sugerem atenção ao manejo da água.'
        : 'Não há indícios visuais fortes de excesso ou falta de água na imagem.',
      confianca: nivelConfianca(Math.max(stats.darkRatio, stats.blueRatio, stats.brightRatio, stats.yellowRatio))
    },
    condicaoSolo: {
      descricao: excessoAgua
        ? 'O solo aparenta áreas úmidas ou escuras que podem estar associadas a excesso de água.'
        : faltaAgua
          ? 'O solo aparenta áreas claras ou secas que podem estar associadas a baixa umidade superficial.'
          : 'O solo aparenta umidade visual equilibrada, sem sinal dominante de excesso ou falta de água.',
      confianca: nivelConfianca(Math.max(stats.darkRatio, stats.brightRatio))
    },
    condicaoPlantas: {
      descricao: stats.greenRatio > 0.32
        ? 'A vegetação aparenta boa cobertura verde, sem sinal visual forte de estresse hídrico.'
        : 'A vegetação visível é limitada; a imagem não permite avaliar com alta confiança a resposta das plantas à irrigação.',
      confianca: nivelConfianca(stats.greenRatio)
    },
    problemas,
    recomendacoes,
    resumo: problemas.length
      ? `Foram encontrados ${problemas.length} indício(s) visual(is) relacionados ao uso da água.`
      : 'Não foram encontrados problemas visuais relevantes de irrigação. Recomenda-se manter monitoramento.'
  };
}

function gerarRelatorioResiduos(stats) {
  const problemas = [];
  const materiaisClaros = stats.brightRatio > 0.38 && stats.texture > 28;
  const padraoArtificial = stats.grayRatio > 0.32 && stats.texture > 30;
  const dispersaoIrregular = stats.texture > 42;

  if (materiaisClaros) {
    adicionarProblema(
      problemas,
      'Possíveis resíduos claros dispersos',
      'A imagem apresenta pontos claros e textura irregular que podem sugerir presença de materiais artificiais ou resíduos expostos.',
      stats.brightRatio > 0.52 ? 'Alto' : 'Médio',
      nivelConfianca(stats.brightRatio)
    );
  }

  if (padraoArtificial) {
    adicionarProblema(
      problemas,
      'Possível material não orgânico',
      'A presença de áreas acinzentadas com padrão irregular pode indicar material não orgânico, mas exige confirmação visual próxima.',
      'Médio',
      nivelConfianca(stats.grayRatio)
    );
  }

  if (dispersaoIrregular && !materiaisClaros) {
    adicionarProblema(
      problemas,
      'Área visualmente desorganizada',
      'A textura muito irregular sugere que há elementos misturados ao solo ou à vegetação que merecem vistoria.',
      'Baixo',
      nivelConfianca(stats.texture / 60)
    );
  }

  const recomendacoes = problemas.map((problema) => ({
    acao: problema.severidade === 'Alto'
      ? 'Realizar coleta manual dos materiais visíveis e separar resíduos recicláveis, orgânicos e rejeitos.'
      : 'Fazer vistoria próxima nos pontos suspeitos antes de definir destinação.',
    beneficio: 'Reduz risco ambiental, melhora segurança da área e facilita manejo agrícola.',
    facilidade: problema.severidade === 'Alto' ? 'Média' : 'Fácil'
  }));

  return {
    qualidadeImagem: qualidadeDaImagem(stats),
    condicaoArea: {
      descricao: problemas.length
        ? 'A área apresenta indícios visuais que justificam vistoria para resíduos.'
        : 'A área não apresenta indícios visuais relevantes de resíduos.',
      confianca: nivelConfianca(Math.max(stats.brightRatio, stats.grayRatio, stats.texture / 60))
    },
    residuosVisiveis: {
      descricao: problemas.length
        ? 'Há possíveis resíduos ou materiais atípicos visíveis, mas a composição não pode ser confirmada apenas pela imagem.'
        : 'Não há resíduos claramente identificáveis na imagem.',
      confianca: problemas.length ? 'Médio' : 'Baixo'
    },
    problemas,
    recomendacoes,
    resumo: problemas.length
      ? `Foram encontrados ${problemas.length} indício(s) visual(is) de resíduos ou materiais atípicos.`
      : 'Não foram encontrados problemas visuais relevantes relacionados a resíduos.'
  };
}

function gerarRelatorioPlantacoes(stats) {
  const problemas = [];
  const baixaCobertura = stats.greenRatio < 0.18;
  const estresseVisual = stats.yellowRatio > 0.16 || stats.brownRatio > 0.28 || stats.brightRatio > 0.34;
  const vigorBom = stats.greenRatio > 0.36 && stats.saturation > 0.24;

  if (baixaCobertura) {
    adicionarProblema(
      problemas,
      'Baixa cobertura vegetal',
      'A imagem sugere pouca presença de vegetação verde, o que pode indicar falhas de estande, solo exposto ou desenvolvimento inicial.',
      'Médio',
      nivelConfianca(1 - stats.greenRatio)
    );
  }

  if (estresseVisual) {
    adicionarProblema(
      problemas,
      'Possível estresse visual da cultura',
      'A presença de tons amarelados, secos ou áreas muito claras pode sugerir estresse hídrico, nutricional ou exposição excessiva.',
      stats.yellowRatio > 0.28 || stats.brightRatio > 0.5 ? 'Alto' : 'Médio',
      nivelConfianca(Math.max(stats.yellowRatio, stats.brownRatio, stats.brightRatio))
    );
  }

  const recomendacoes = [];
  problemas.forEach((problema) => {
    if (problema.nome === 'Baixa cobertura vegetal') {
      recomendacoes.push({
        acao: 'Verificar falhas de plantio, espaçamento e presença de solo descoberto nas linhas.',
        beneficio: 'Ajuda a identificar perda de estande e melhora planejamento de correção.',
        facilidade: 'Fácil'
      });
    }
    if (problema.nome === 'Possível estresse visual da cultura') {
      recomendacoes.push({
        acao: 'Checar umidade do solo, folhas amareladas, manchas e bordas secas em vistoria de campo.',
        beneficio: 'Permite diferenciar possível estresse hídrico, nutricional ou sanitário antes de intervir.',
        facilidade: 'Média'
      });
    }
  });

  return {
    qualidadeImagem: qualidadeDaImagem(stats),
    condicaoPlantas: {
      descricao: vigorBom
        ? 'A vegetação aparenta bom vigor visual, com cobertura verde relevante.'
        : problemas.length
          ? 'A vegetação apresenta indícios visuais que merecem acompanhamento.'
          : 'A vegetação aparenta condição moderada, sem problema visual dominante.',
      confianca: nivelConfianca(Math.max(stats.greenRatio, stats.yellowRatio, stats.saturation))
    },
    condicaoSolo: {
      descricao: stats.brightRatio > 0.34
        ? 'Há indício de solo exposto ou áreas claras entre plantas.'
        : 'O solo não apresenta sinal visual dominante que comprometa a leitura das plantas.',
      confianca: nivelConfianca(stats.brightRatio)
    },
    problemas,
    recomendacoes,
    resumo: problemas.length
      ? `Foram encontrados ${problemas.length} indício(s) visual(is) nas plantações.`
      : 'Não foram encontrados problemas visuais relevantes nas plantações.'
  };
}

function prioridadeDoRelatorio(relatorio) {
  if (relatorio.problemas.some((problema) => problema.severidade === 'Alto')) return 'Alta';
  if (relatorio.problemas.some((problema) => problema.severidade === 'Médio')) return 'Média';
  return 'Baixa';
}

function confiancaDoRelatorio(prioridade, temProblemas) {
  if (!temProblemas) return 82;
  if (prioridade === 'Alta') return 86;
  if (prioridade === 'Média') return 76;
  return 66;
}

function respostaPorRelatorio(relatorio) {
  const prioridade = prioridadeDoRelatorio(relatorio);
  return {
    label: relatorio.resumo,
    confidence: confiancaDoRelatorio(prioridade, relatorio.problemas.length > 0),
    priority: prioridade,
    recommendations: relatorio.recomendacoes.map((item) => `${item.acao} Benefício: ${item.beneficio} Facilidade: ${item.facilidade}.`),
    technicalReport: relatorio
  };
}

function classifyByCategory(stats, category) {
  const key = categoryKey(category);

  if (key === 'solo') {
    return respostaPorRelatorio(gerarRelatorioSolo(stats));
  }

  if (key === 'irrigacao') {
    return respostaPorRelatorio(gerarRelatorioIrrigacao(stats));
  }

  if (key === 'residuos') {
    return respostaPorRelatorio(gerarRelatorioResiduos(stats));
  }

  if (key === 'plantacoes') {
    return respostaPorRelatorio(gerarRelatorioPlantacoes(stats));
  }

  return {
    label: 'padrao local analisado com sinais visuais gerais',
    confidence: 72,
    recommendations: recommendations[category] || []
  };
}

async function fallbackLocalAnalysis(imageFile, category) {
  const stats = await extractImageStats(imageFile);
  const contexto = avaliarContextoAgricola(stats, category);
  if (!contexto.reconhecido) {
    return gerarResultadoForaDoTema(stats, category, contexto.motivo);
  }

  const classification = classifyByCategory(stats, category);
  return {
    ...classification,
    description: describeImageStats(stats),
    detectedElements: identificarElementosVisuais(stats, category),
    simpleSummary: gerarResumoSimples(classification, category),
    soilOpinion: classification.technicalReport?.resumo || gerarParecerGeralSolo(stats),
    technicalReport: classification.technicalReport || null
  };
}

async function simulateAnalysis(imageFile, category) {
  const fallback = await fallbackLocalAnalysis(imageFile, category);
  const label = fallback.label;
  const confidence = fallback.confidence;
  const imageDescription = fallback.description;
  const detectedElements = fallback.detectedElements;
  const simpleSummary = fallback.simpleSummary;
  const soilOpinion = fallback.soilOpinion;
  const analysisRecommendations = fallback.recommendations;
  const technicalReport = fallback.technicalReport;
  const detectedPriority = fallback.priority;

  const diagnosis = `Detecção técnica: ${category} detectado: ${label}. ${textoParecer(soilOpinion)}`;
  const priority = detectedPriority || (confidence > 80 ? 'Alta' : confidence > 55 ? 'Média' : 'Baixa');
  const imageSustainability = calcularIndiceDaImagem(technicalReport);

  return {
    description: imageDescription,
    detectedElements,
    simpleSummary,
    diagnosis,
    technicalReport,
    imageSustainability,
    confidence,
    priority,
    recommendations: analysisRecommendations
  };
}

function carregarOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OCR_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de texto da imagem.'));
    document.head.appendChild(script);
  });
}

async function prepararImagemParaOCR(imageFile) {
  const bitmap = await createImageBitmap(imageFile);
  const escala = Math.max(2, Math.min(4, Math.round(1800 / Math.max(bitmap.width, bitmap.height))));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * escala;
  canvas.height = bitmap.height * escala;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const imagem = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imagem.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const cinza = (pixels[i] * 0.3) + (pixels[i + 1] * 0.59) + (pixels[i + 2] * 0.11);
    const contraste = cinza > 175 ? 255 : cinza < 125 ? 0 : cinza * 1.25;
    const final = Math.max(0, Math.min(255, contraste));
    pixels[i] = final;
    pixels[i + 1] = final;
    pixels[i + 2] = final;
  }
  context.putImageData(imagem, 0, 0);

  return canvas;
}

function caixaDaPalavra(palavra) {
  const bbox = palavra?.bbox || palavra;
  return {
    x0: Number(bbox?.x0 ?? bbox?.left ?? 0),
    y0: Number(bbox?.y0 ?? bbox?.top ?? 0),
    x1: Number(bbox?.x1 ?? ((bbox?.left || 0) + (bbox?.width || 0))),
    y1: Number(bbox?.y1 ?? ((bbox?.top || 0) + (bbox?.height || 0)))
  };
}

function montarTextoPorPosicao(words) {
  const palavras = (words || [])
    .map((word) => {
      const texto = String(word.text || '').trim();
      const box = caixaDaPalavra(word);
      return {
        texto,
        x: box.x0,
        y: (box.y0 + box.y1) / 2,
        altura: Math.max(8, box.y1 - box.y0)
      };
    })
    .filter((word) => word.texto && /[a-z0-9,%+.-]/i.test(word.texto))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const linhas = [];
  palavras.forEach((word) => {
    const tolerancia = Math.max(10, word.altura * 0.65);
    let linha = linhas.find((item) => Math.abs(item.y - word.y) <= tolerancia);
    if (!linha) {
      linha = { y: word.y, words: [] };
      linhas.push(linha);
    }
    linha.words.push(word);
    linha.y = (linha.y + word.y) / 2;
  });

  return linhas
    .sort((a, b) => a.y - b.y)
    .map((linha) => linha.words
      .sort((a, b) => a.x - b.x)
      .map((word) => word.texto)
      .join(' '))
    .join('\n');
}

function agruparIndices(indices) {
  const grupos = [];
  indices.forEach((indice) => {
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || indice - ultimo[ultimo.length - 1] > 2) {
      grupos.push([indice]);
    } else {
      ultimo.push(indice);
    }
  });
  return grupos.map((grupo) => Math.round(grupo.reduce((soma, valor) => soma + valor, 0) / grupo.length));
}

function detectarLinhasHorizontais(canvas) {
  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const linhas = [];

  for (let y = 0; y < canvas.height; y += 1) {
    let escuros = 0;
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const cinza = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      if (cinza < 80) escuros += 1;
    }
    if (escuros > canvas.width * 0.45) linhas.push(y);
  }

  return agruparIndices(linhas);
}

function detectarLinhasVerticais(canvas, yInicio, yFim) {
  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const linhas = [];
  const altura = Math.max(1, yFim - yInicio);

  for (let x = 0; x < canvas.width; x += 1) {
    let escuros = 0;
    for (let y = yInicio; y <= yFim; y += 1) {
      const i = (y * canvas.width + x) * 4;
      const cinza = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      if (cinza < 90) escuros += 1;
    }
    if (escuros > altura * 0.42) linhas.push(x);
  }

  return agruparIndices(linhas);
}

function detectarBlocosTabela(canvas) {
  const horizontais = detectarLinhasHorizontais(canvas);
  const blocos = [];
  let blocoAtual = [];

  horizontais.forEach((linha) => {
    if (!blocoAtual.length || linha - blocoAtual[blocoAtual.length - 1] < 95) {
      blocoAtual.push(linha);
    } else {
      if (blocoAtual.length >= 3) blocos.push(blocoAtual);
      blocoAtual = [linha];
    }
  });
  if (blocoAtual.length >= 3) blocos.push(blocoAtual);

  return blocos
    .filter((bloco) => bloco[bloco.length - 1] - bloco[0] > 35)
    .map((horizontaisBloco) => ({
      h: horizontaisBloco,
      v: detectarLinhasVerticais(canvas, horizontaisBloco[0], horizontaisBloco[horizontaisBloco.length - 1])
    }));
}

function areaCelulaPorGrade(canvas, bloco, indiceColuna) {
  const h = bloco.h;
  const v = bloco.v;
  if (h.length < 3 || v.length <= indiceColuna + 1) return null;
  const y1 = h[h.length - 2] + 3;
  const y2 = h[h.length - 1] - 3;
  const x1 = v[indiceColuna] + 3;
  const x2 = v[indiceColuna + 1] - 3;
  if (x2 <= x1 || y2 <= y1) return null;
  return {
    x: x1 / canvas.width,
    y: y1 / canvas.height,
    w: (x2 - x1) / canvas.width,
    h: (y2 - y1) / canvas.height
  };
}

function areaCelulaPorProporcao(canvas, bloco, inicio, fim) {
  const h = bloco.h;
  if (h.length < 3) return null;

  const xEsquerda = bloco.v.length >= 2 ? bloco.v[0] : Math.round(canvas.width * 0.01);
  const xDireita = bloco.v.length >= 2 ? bloco.v[bloco.v.length - 1] : Math.round(canvas.width * 0.99);
  const largura = xDireita - xEsquerda;
  const y1 = h[h.length - 2] + 6;
  const y2 = h[h.length - 1] - 6;
  const x1 = Math.round(xEsquerda + largura * inicio) + 5;
  const x2 = Math.round(xEsquerda + largura * fim) - 5;

  if (x2 - x1 < 8 || y2 - y1 < 8) return null;
  return {
    x: x1 / canvas.width,
    y: y1 / canvas.height,
    w: (x2 - x1) / canvas.width,
    h: (y2 - y1) / canvas.height
  };
}

function escolherBlocosDeLaudo(blocos) {
  const validos = blocos.filter((bloco) => bloco.h.length >= 3);
  if (validos.length >= 4) {
    return { principal: validos[1], troca: validos[2] };
  }
  if (validos.length === 3) {
    return { principal: validos[1], troca: validos[2] };
  }
  if (validos.length === 2) {
    return { principal: validos[0], troca: validos[1] };
  }
  return { principal: validos[0] || null, troca: null };
}

function criarCanvasBaseDaImagem(imageFile) {
  return createImageBitmap(imageFile).then((bitmap) => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  });
}

function recortarCanvasRelativo(canvasOrigem, area, opcoes = {}) {
  const margem = opcoes.margem || 0;
  const escala = opcoes.escala || 4;
  const x = Math.max(0, area.x - margem);
  const y = Math.max(0, area.y - margem);
  const w = Math.min(1 - x, area.w + margem * 2);
  const h = Math.min(1 - y, area.h + margem * 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(canvasOrigem.width * w * escala));
  canvas.height = Math.max(1, Math.round(canvasOrigem.height * h * escala));
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    canvasOrigem,
    Math.round(canvasOrigem.width * x),
    Math.round(canvasOrigem.height * y),
    Math.round(canvasOrigem.width * w),
    Math.round(canvasOrigem.height * h),
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imagem = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imagem.data;
  const limiteClaro = opcoes.limiteClaro || 165;
  const limiteEscuro = opcoes.limiteEscuro || 145;
  for (let i = 0; i < pixels.length; i += 4) {
    const cinza = (pixels[i] * 0.3) + (pixels[i + 1] * 0.59) + (pixels[i + 2] * 0.11);
    const final = cinza > limiteClaro ? 255 : cinza < limiteEscuro ? 0 : 210;
    pixels[i] = final;
    pixels[i + 1] = final;
    pixels[i + 2] = final;
  }
  context.putImageData(imagem, 0, 0);
  return canvas;
}

function extrairNumeroReconhecido(texto) {
  const limpo = String(texto || '')
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/,/g, '.');
  const encontrado = limpo.match(/\d+(?:\.\d+)?/);
  return encontrado ? Number.parseFloat(encontrado[0]) : null;
}

function ajustarNumeroPorParametro(chave, valor) {
  if (!Number.isFinite(valor)) return null;
  if (chave === 'argila' && valor > 100 && valor < 1000) return valor / 10;
  if ((chave === 'ph' || chave === 'smp' || chave === 'mo') && valor > 14 && valor < 1000) return valor / 100;
  if (chave === 'p' && valor > 100 && valor < 1000) return valor / 10;
  if (chave === 'k' && valor > 100000 && valor < 1000000) return valor / 1000;
  if (chave === 'k' && valor > 1000 && valor < 100000) return valor / 100;
  if ((chave === 'ca' || chave === 'mg' || chave === 'al' || chave === 'hAl' || chave === 'ctc') && valor > 100 && valor < 10000) return valor / 100;
  if (chave === 'v' && valor > 100 && valor < 1000) return valor / 10;
  return valor;
}

function faixaEsperadaParametro(chave) {
  const faixas = {
    argila: { min: 5, max: 95 },
    ph: { min: 3.5, max: 7.8 },
    smp: { min: 3.5, max: 7.8 },
    p: { min: 0, max: 250 },
    k: { min: 0, max: 1000 },
    mo: { min: 0.2, max: 15 },
    al: { min: 0, max: 10 },
    ca: { min: 0, max: 30 },
    mg: { min: 0, max: 15 },
    hAl: { min: 0, max: 40 },
    ctc: { min: 0, max: 60 },
    v: { min: 0, max: 100 },
    m: { min: 0, max: 100 }
  };
  return faixas[chave] || { min: -Infinity, max: Infinity };
}

function pontuarValorOCR(chave, valor, textoBruto) {
  if (!Number.isFinite(valor)) return -999;
  const faixa = faixaEsperadaParametro(chave);
  let pontos = 0;
  if (valor >= faixa.min && valor <= faixa.max) pontos += 80;
  else pontos -= 80;

  if (textoBruto.includes(',') || textoBruto.includes('.')) pontos += 12;
  if (chave === 'argila' && valor >= 20 && valor <= 80) pontos += 18;
  if ((chave === 'ph' || chave === 'smp') && valor >= 4 && valor <= 7) pontos += 18;
  if (chave === 'p' && valor >= 1 && valor <= 80) pontos += 12;
  if (chave === 'k' && valor >= 20 && valor <= 300) pontos += 12;
  if (chave === 'mo' && valor >= 1 && valor <= 8) pontos += 12;

  const casas = String(textoBruto).match(/[,.](\d+)/);
  if (casas && casas[1].length <= 2) pontos += 5;
  return pontos;
}

function escolherMelhorValorOCR(chave, tentativas) {
  const validas = tentativas
    .filter((item) => Number.isFinite(item.valor))
    .map((item) => ({
      ...item,
      chaveAgrupamento: Math.round(item.valor * 100) / 100,
      pontos: pontuarValorOCR(chave, item.valor, item.texto)
    }));

  if (!validas.length) return null;

  validas.forEach((item) => {
    const repeticoes = validas.filter((outro) => Math.abs(outro.chaveAgrupamento - item.chaveAgrupamento) < 0.02).length;
    item.pontos += repeticoes * 20;
  });

  validas.sort((a, b) => b.pontos - a.pontos);
  return validas[0].valor;
}

function formatarNumeroLaudo(valor) {
  return Number(valor.toFixed(2)).toString().replace('.', ',');
}

async function reconhecerNumeroEmRecorte(Tesseract, canvas, chave) {
  const resultado = await reconhecerComFallbackOCR(Tesseract, canvas, {
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: '0123456789.,'
  });
  const bruto = extrairNumeroReconhecido(resultado?.data?.text || '');
  const ajustado = ajustarNumeroPorParametro(chave, bruto);
  return ajustado === null ? null : formatarNumeroLaudo(ajustado);
}

async function reconhecerNumeroConfiavel(Tesseract, canvasBase, campo) {
  const variantes = [
    { margem: 0.004, escala: 5, limiteClaro: 170, limiteEscuro: 145, psm: '7' },
    { margem: 0.008, escala: 5, limiteClaro: 185, limiteEscuro: 130, psm: '7' },
    { margem: 0.012, escala: 6, limiteClaro: 160, limiteEscuro: 120, psm: '8' },
    { margem: 0.002, escala: 6, limiteClaro: 190, limiteEscuro: 150, psm: '13' }
  ];

  const tentativas = [];
  for (const variante of variantes) {
    const recorte = recortarCanvasRelativo(canvasBase, campo.area, variante);
    if (recorte.width < 20 || recorte.height < 20) continue;
    const resultado = await reconhecerComFallbackOCR(Tesseract, recorte, {
      tessedit_pageseg_mode: variante.psm,
      tessedit_char_whitelist: '0123456789.,'
    });
    const texto = resultado?.data?.text || '';
    const bruto = extrairNumeroReconhecido(texto);
    const valor = ajustarNumeroPorParametro(campo.chave, bruto);
    tentativas.push({ valor, texto });
  }

  const melhor = escolherMelhorValorOCR(campo.chave, tentativas);
  return melhor === null ? null : formatarNumeroLaudo(melhor);
}

async function reconhecerTabelaPrincipalPorRecorte(imageFile) {
  const Tesseract = await carregarOCR();
  const canvasBase = await criarCanvasBaseDaImagem(imageFile);
  const blocosTabela = detectarBlocosTabela(canvasBase);
  const blocosLaudo = escolherBlocosDeLaudo(blocosTabela);
  const blocoPrincipal = blocosLaudo.principal;
  const blocoTroca = blocosLaudo.troca;
  const camposTabelaPrincipal = [
    { chave: 'argila', rotulo: 'Argila', area: { x: 0.105, y: 0.248, w: 0.17, h: 0.105 } },
    { chave: 'ph', rotulo: 'pH H2O', area: { x: 0.276, y: 0.248, w: 0.17, h: 0.105 } },
    { chave: 'smp', rotulo: 'Indice SMP', area: { x: 0.446, y: 0.248, w: 0.105, h: 0.105 } },
    { chave: 'p', rotulo: 'P', area: { x: 0.548, y: 0.248, w: 0.145, h: 0.105 } },
    { chave: 'k', rotulo: 'K', area: { x: 0.693, y: 0.248, w: 0.148, h: 0.105 } },
    { chave: 'mo', rotulo: 'MO', area: { x: 0.842, y: 0.248, w: 0.148, h: 0.105 } }
  ];
  const camposTabelaTroca = [
    { chave: 'al', rotulo: 'Al', area: { x: 0.108, y: 0.522, w: 0.087, h: 0.100 } },
    { chave: 'ca', rotulo: 'Ca', area: { x: 0.195, y: 0.522, w: 0.085, h: 0.100 } },
    { chave: 'mg', rotulo: 'Mg', area: { x: 0.280, y: 0.522, w: 0.086, h: 0.100 } },
    { chave: 'hAl', rotulo: 'H+Al', area: { x: 0.367, y: 0.522, w: 0.088, h: 0.100 } },
    { chave: 'ctc', rotulo: 'CTC', area: { x: 0.455, y: 0.522, w: 0.100, h: 0.100 } },
    { chave: 'v', rotulo: 'V', area: { x: 0.555, y: 0.522, w: 0.075, h: 0.100 } },
    { chave: 'm', rotulo: 'M', area: { x: 0.630, y: 0.522, w: 0.073, h: 0.100 } }
  ];

  if (blocoPrincipal) {
    const proporcoes = [
      [0.105, 0.276],
      [0.276, 0.450],
      [0.450, 0.552],
      [0.552, 0.704],
      [0.704, 0.852],
      [0.852, 1.000]
    ];
    camposTabelaPrincipal.forEach((campo, index) => {
      const area = areaCelulaPorProporcao(canvasBase, blocoPrincipal, proporcoes[index][0], proporcoes[index][1]);
      if (area) campo.area = area;
    });
  }

  if (blocoTroca) {
    const proporcoes = [
      [0.105, 0.195],
      [0.195, 0.280],
      [0.280, 0.366],
      [0.366, 0.455],
      [0.455, 0.555],
      [0.555, 0.630],
      [0.630, 0.703]
    ];
    camposTabelaTroca.forEach((campo, index) => {
      const area = areaCelulaPorProporcao(canvasBase, blocoTroca, proporcoes[index][0], proporcoes[index][1]);
      if (area) campo.area = area;
    });
  }

  const valoresPrincipal = [];
  for (const campo of camposTabelaPrincipal) {
    const valor = await reconhecerNumeroConfiavel(Tesseract, canvasBase, campo);
    valoresPrincipal.push(valor);
  }

  const valoresTroca = [];
  for (const campo of camposTabelaTroca) {
    const valor = await reconhecerNumeroConfiavel(Tesseract, canvasBase, campo);
    valoresTroca.push(valor);
  }

  const blocos = [];
  if (valoresPrincipal.filter(Boolean).length >= 3) {
    blocos.push(`Tabela principal lida por recorte:\n${camposTabelaPrincipal.map((campo) => campo.rotulo).join(' ')}\n${valoresPrincipal.map((valor) => valor || '-').join(' ')}`);
  }
  if (valoresTroca.filter(Boolean).length >= 3) {
    blocos.push(`Tabela de troca lida por recorte:\n${camposTabelaTroca.map((campo) => campo.rotulo).join(' ')}\n${valoresTroca.map((valor) => valor || '-').join(' ')}`);
  }
  return blocos.join('\n\n');
}

async function reconhecerTextoDaImagem(imageFile) {
  ocrStatus.textContent = 'Lendo o texto da foto do laudo...';
  const Tesseract = await carregarOCR();
  const imagemPreparada = await prepararImagemParaOCR(imageFile);
  const resultado = await reconhecerComFallbackOCR(Tesseract, imagemPreparada, {
    preserve_interword_spaces: '1',
    tessedit_pageseg_mode: '4',
    logger(evento) {
      if (evento.status === 'recognizing text') {
        const progresso = Math.round((evento.progress || 0) * 100);
        ocrStatus.textContent = `Lendo o texto da foto... ${progresso}%`;
      }
    }
  });

  const textoNormal = resultado?.data?.text || '';
  const textoPorPosicao = montarTextoPorPosicao(resultado?.data?.words || []);
  return `${textoNormal}\n\n${textoPorPosicao}`.trim();
}

function prepararTextoReconhecido(texto) {
  return String(texto || '')
    .replace(/[|]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bM\s*[.,]?\s*0\b/gi, 'MO')
    .replace(/\bM\s*[.,]\s*O\b/gi, 'MO')
    .replace(/\bH\s*\+\s*AI\b/gi, 'H + Al')
    .replace(/\bA1\b/g, 'Al')
    .replace(/dm\s*[³3]/gi, 'dm3')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizarTextoLaudo(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function capturarNumeroLaudo(texto, padroes) {
  for (const padrao of padroes) {
    const encontrado = texto.match(padrao);
    if (encontrado) {
      const valor = Number.parseFloat(encontrado[1]);
      if (Number.isFinite(valor)) return valor;
    }
  }
  return null;
}

function unidadeDePotassio(texto) {
  const trechoK = texto.match(/\bk\b[^;,\n]{0,35}/i);
  if (!trechoK) return '';
  return trechoK[0].toLowerCase().includes('mg') ? 'mg/dm3' : 'cmolc/dm3';
}

function limparLinhaTabela(linha) {
  return String(linha || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.')
    .replace(/h\s*\+\s*al/gi, ' h_al ')
    .replace(/materia\s+organica/gi, ' mo ')
    .replace(/mat\.?\s*org\.?/gi, ' mo ')
    .replace(/m\.?\s*o\.?/gi, ' mo ')
    .replace(/m\.?\s*0\.?/gi, ' mo ')
    .replace(/%?\s*sat\.?\s*(?:da\s*)?ctc/gi, ' v ')
    .replace(/saturacao\s+(?:por\s+)?bases/gi, ' v ')
    .replace(/necessidade\s+de\s+calcario/gi, ' nc ')
    .replace(/[()]/g, ' ')
    .replace(/[|:;=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenParametroTabela(token) {
  const limpo = token
    .replace(/[^a-z0-9_%+]/g, '')
    .replace(/^indice$/, '')
    .replace(/^teor$/, '');

  if (!limpo) return null;
  if (limpo === 'ph' || limpo === 'phagua' || limpo === 'phh2o' || limpo === 'phcacl2') return 'ph';
  if (limpo === 'smp' || limpo === 'indicesmp') return 'smp';
  if (limpo === 'p' || limpo === 'fosforo' || limpo.includes('pmehlich')) return 'p';
  if (limpo === 'k' || limpo === 'potassio') return 'k';
  if (limpo === 'ca' || limpo === 'calcio' || (limpo.startsWith('ca') && limpo.includes('troc'))) return 'ca';
  if (limpo === 'mg' || limpo === 'magnesio' || (limpo.startsWith('mg') && limpo.includes('troc'))) return 'mg';
  if (limpo === 'al' || limpo === 'aluminio' || (limpo.startsWith('al') && limpo.includes('troc'))) return 'al';
  if (limpo === 'h_al' || limpo === 'hal' || limpo === 'h+al') return 'hAl';
  if (limpo === 'ctc' || limpo === 'ctcph7' || limpo === 'ctctotal') return 'ctc';
  if (limpo === 'v' || limpo === 'v%' || limpo === 'bases' || limpo === 'satbases' || limpo === 'satctc') return 'v';
  if (limpo === 'm' || limpo === 'm%' || limpo === 'satall' || limpo === 'satal') return 'm';
  if (limpo === 'mo' || limpo === 'materiaorganica') return 'mo';
  if (limpo === 'argila') return 'argila';
  if (limpo === 'prnt') return 'prnt';
  if (limpo === 'nc') return 'nc';
  return null;
}

function extrairNumerosLinha(linha) {
  return (limparLinhaTabela(linha).match(/-?\d+(?:\.\d+)?/g) || [])
    .map((valor) => Number.parseFloat(valor))
    .filter((valor) => Number.isFinite(valor));
}

function removerNumerosDeProtocolo(linha, numeros) {
  const texto = limparLinhaTabela(linha);
  if (!/\bprot\b|\bprotocolo\b|qb\d+\/\d+/i.test(texto)) return numeros;
  if (numeros.length >= 2 && numeros[0] > 30 && numeros[1] > 1900) return numeros.slice(2);
  if (numeros.length >= 1 && numeros[0] > 30) return numeros.slice(1);
  return numeros;
}

function extrairNumerosValoresTabela(linha) {
  return removerNumerosDeProtocolo(linha, extrairNumerosLinha(linha));
}

function preencherParametroSeVazio(parametros, chave, valor) {
  if (!chave || valor === null || valor === undefined || !Number.isFinite(valor)) return;
  if (parametros[chave] === null) parametros[chave] = valor;
}

function normalizarParametroFinal(chave, valor) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;

  let ajustado = ajustarNumeroPorParametro(chave, valor);
  if (!Number.isFinite(ajustado)) return null;

  if ((chave === 'ph' || chave === 'smp') && ajustado > 8 && ajustado < 80) ajustado /= 10;
  if (chave === 'mo' && ajustado > 15 && ajustado < 150) ajustado /= 10;
  if (chave === 'argila' && ajustado < 5) return null;
  if ((chave === 'ph' || chave === 'smp') && ajustado < 3.5) return null;

  const faixa = faixaEsperadaParametro(chave);
  if (ajustado < faixa.min || ajustado > faixa.max) return null;

  return Number(ajustado.toFixed(2));
}

function normalizarParametrosFinais(parametros) {
  Object.keys(parametros).forEach((chave) => {
    if (chave === 'unidadeK') return;
    parametros[chave] = normalizarParametroFinal(chave, parametros[chave]);
  });
  return parametros;
}

function escolherMelhorParametro(chave, ...valores) {
  for (const valor of valores) {
    const normalizado = normalizarParametroFinal(chave, valor);
    if (normalizado !== null) return normalizado;
  }
  return null;
}

function alinharValoresComCabecalhos(cabecalhos, valores) {
  const memo = new Map();

  function resolver(iCabecalho, iValor) {
    const chaveMemo = `${iCabecalho}:${iValor}`;
    if (memo.has(chaveMemo)) return memo.get(chaveMemo);

    if (iCabecalho >= cabecalhos.length) {
      return { pontos: 0, valores: [] };
    }

    const restoPulandoCabecalho = resolver(iCabecalho + 1, iValor);
    let melhor = {
      pontos: restoPulandoCabecalho.pontos - 8,
      valores: [null, ...restoPulandoCabecalho.valores]
    };

    if (iValor < valores.length) {
      const usandoValorBruto = valores[iValor];
      const usandoValor = normalizarParametroFinal(cabecalhos[iCabecalho], usandoValorBruto);
      const restoComValor = resolver(iCabecalho + 1, iValor + 1);
      const pontosValor = (usandoValor === null ? -35 : 35) + restoComValor.pontos;
      const candidatoValor = {
        pontos: pontosValor,
        valores: [usandoValor, ...restoComValor.valores]
      };

      const restoPulandoValor = resolver(iCabecalho, iValor + 1);
      const candidatoPularValor = {
        pontos: restoPulandoValor.pontos - 3,
        valores: restoPulandoValor.valores
      };

      if (candidatoValor.pontos > melhor.pontos) melhor = candidatoValor;
      if (candidatoPularValor.pontos > melhor.pontos) melhor = candidatoPularValor;
    }

    memo.set(chaveMemo, melhor);
    return melhor;
  }

  return resolver(0, 0).valores.slice(0, cabecalhos.length);
}

function extrairParametrosDeTabela(textoOriginal) {
  const parametros = {
    ph: null,
    smp: null,
    p: null,
    k: null,
    ca: null,
    mg: null,
    al: null,
    hAl: null,
    ctc: null,
    v: null,
    m: null,
    mo: null,
    argila: null,
    prnt: null,
    nc: null
  };

  const linhas = String(textoOriginal || '')
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (let i = 0; i < linhas.length; i += 1) {
    const possiveisCabecalhos = [
      linhas[i],
      `${linhas[i]} ${linhas[i + 1] || ''}`,
      `${linhas[i]} ${linhas[i + 1] || ''} ${linhas[i + 2] || ''}`
    ];

    let cabecalhosUnicos = [];
    let linhasUsadasNoCabecalho = 1;

    possiveisCabecalhos.forEach((cabecalho, index) => {
      const tokens = limparLinhaTabela(cabecalho).split(' ').filter(Boolean);
      const cabecalhos = tokens.map(tokenParametroTabela).filter(Boolean);
      const unicos = cabecalhos.filter((chave, posicao) => cabecalhos.indexOf(chave) === posicao);
      if (unicos.length > cabecalhosUnicos.length) {
        cabecalhosUnicos = unicos;
        linhasUsadasNoCabecalho = index + 1;
      }
    });

    const cabecalhoNormalizado = limparLinhaTabela(possiveisCabecalhos[2]);
    if (cabecalhosUnicos.length < 3 && cabecalhoNormalizado.includes('argila')) {
      cabecalhosUnicos = ['argila', 'ph', 'smp', 'p', 'k', 'mo'];
      linhasUsadasNoCabecalho = 3;
    }

    if (
      cabecalhosUnicos.length < 3
      && (cabecalhoNormalizado.includes('h_al') || cabecalhoNormalizado.includes('ctc') || cabecalhoNormalizado.includes('algar') || cabecalhoNormalizado.includes('caro'))
    ) {
      cabecalhosUnicos = ['al', 'ca', 'mg', 'hAl', 'ctc', 'v', 'm'];
      linhasUsadasNoCabecalho = 3;
    }

    if (cabecalhosUnicos.length < 3) continue;

    const numerosNaMesmaLinha = extrairNumerosValoresTabela(linhas[i]);
    if (numerosNaMesmaLinha.length >= cabecalhosUnicos.length) {
      const valores = alinharValoresComCabecalhos(cabecalhosUnicos, numerosNaMesmaLinha);
      cabecalhosUnicos.forEach((chave, index) => preencherParametroSeVazio(parametros, chave, valores[index]));
      continue;
    }

    for (let j = i + 1; j <= Math.min(i + linhasUsadasNoCabecalho + 4, linhas.length - 1); j += 1) {
      const valores = extrairNumerosValoresTabela(linhas[j]);
      if (valores.length < Math.max(2, Math.floor(cabecalhosUnicos.length * 0.55))) continue;

      const valoresAlinhados = alinharValoresComCabecalhos(cabecalhosUnicos, valores);

      cabecalhosUnicos.forEach((chave, index) => {
        if (index < valoresAlinhados.length) preencherParametroSeVazio(parametros, chave, valoresAlinhados[index]);
      });
      break;
    }
  }

  return parametros;
}

function extrairParametrosLaudo(textoOriginal) {
  const texto = normalizarTextoLaudo(textoOriginal);
  const parametrosTabela = extrairParametrosDeTabela(textoOriginal);
  const textoRecortes = String(textoOriginal || '')
    .split(/Tabela principal lida por recorte:|Tabela de troca lida por recorte:/i)
    .slice(1)
    .join('\n');
  const parametrosRecorte = extrairParametrosDeTabela(textoRecortes);
  const parametros = {
    ph: escolherMelhorParametro('ph', parametrosRecorte.ph, parametrosTabela.ph, capturarNumeroLaudo(texto, [/\bph\s*(?:agua|h2o|cacl2)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    smp: escolherMelhorParametro('smp', parametrosRecorte.smp, parametrosTabela.smp, capturarNumeroLaudo(texto, [/\bsmp\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    p: escolherMelhorParametro('p', parametrosRecorte.p, parametrosTabela.p, capturarNumeroLaudo(texto, [/\bp\b(?:\s*\([^)]*\))?\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /fosforo\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    k: escolherMelhorParametro('k', parametrosRecorte.k, parametrosTabela.k, capturarNumeroLaudo(texto, [/\bk\b(?:\s*\([^)]*\))?\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /potassio\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    ca: escolherMelhorParametro('ca', parametrosRecorte.ca, parametrosTabela.ca, capturarNumeroLaudo(texto, [/\bca\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /calcio\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    mg: escolherMelhorParametro('mg', parametrosRecorte.mg, parametrosTabela.mg, capturarNumeroLaudo(texto, [/\bmg\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /magnesio\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    al: escolherMelhorParametro('al', parametrosRecorte.al, parametrosTabela.al, capturarNumeroLaudo(texto, [/\bal\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /aluminio\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    hAl: escolherMelhorParametro('hAl', parametrosRecorte.hAl, parametrosTabela.hAl, capturarNumeroLaudo(texto, [/\bh\s*\+\s*al\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /acidez potencial\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    ctc: escolherMelhorParametro('ctc', parametrosRecorte.ctc, parametrosTabela.ctc, capturarNumeroLaudo(texto, [/\bctc\b(?:\s*(?:ph\s*7|t|total))?\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    v: escolherMelhorParametro('v', parametrosRecorte.v, parametrosTabela.v, capturarNumeroLaudo(texto, [/\bv\s*%?\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /saturacao por bases\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    m: escolherMelhorParametro('m', parametrosRecorte.m, parametrosTabela.m),
    mo: escolherMelhorParametro('mo', parametrosRecorte.mo, parametrosTabela.mo, capturarNumeroLaudo(texto, [/\bmo\b\s*%?\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /materia organica\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    argila: escolherMelhorParametro('argila', parametrosRecorte.argila, parametrosTabela.argila, capturarNumeroLaudo(texto, [/argila\s*%?\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    prnt: escolherMelhorParametro('prnt', parametrosRecorte.prnt, parametrosTabela.prnt, capturarNumeroLaudo(texto, [/\bprnt\b\s*%?\s*[:=]?\s*(\d+(?:\.\d+)?)/i])),
    nc: escolherMelhorParametro('nc', parametrosRecorte.nc, parametrosTabela.nc, capturarNumeroLaudo(texto, [/\bnc\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i, /necessidade de calcario\s*[:=]?\s*(\d+(?:\.\d+)?)/i]))
  };

  parametros.unidadeK = unidadeDePotassio(texto);

  if (parametros.ctc === null && parametros.ca !== null && parametros.mg !== null && parametros.k !== null && parametros.hAl !== null) {
    const kCmolc = parametros.unidadeK === 'mg/dm3' ? parametros.k / 391 : parametros.k;
    parametros.ctc = Number((parametros.ca + parametros.mg + kCmolc + parametros.hAl).toFixed(2));
  }

  if (parametros.v === null && parametros.ca !== null && parametros.mg !== null && parametros.k !== null && parametros.ctc) {
    const kCmolc = parametros.unidadeK === 'mg/dm3' ? parametros.k / 391 : parametros.k;
    parametros.v = Number((((parametros.ca + parametros.mg + kCmolc) / parametros.ctc) * 100).toFixed(1));
  }

  return parametros;
}

function parametrosEncontrados(parametros) {
  return Object.entries(parametros)
    .filter(([chave, valor]) => chave !== 'unidadeK' && valor !== null)
    .map(([chave, valor]) => ({ chave, valor }));
}

function adicionarProblemaLaudo(lista, nome, descricao, impacto, severidade, confianca) {
  lista.push({ nome, descricao, impactoPotencial: impacto, severidade, confianca });
}

function adicionarRecomendacaoLaudo(lista, acao, objetivo, beneficio, facilidade, baseManual) {
  lista.push({ acao, objetivo, beneficio, facilidade, baseManual });
}

function selecionarManualRegional(localizacao = {}) {
  const paranaIdentificado = localizacao.estado === 'PR' && localizacao.confianca !== 'baixa';
  if (paranaIdentificado) {
    return {
      codigo: 'PR',
      nome: 'Fertilidade do Solo - Correção e Adubação (SENAR Paraná)',
      arquivo: 'prompts/manuais/Fertilidade_Solo_Parana_Resumo_Expandido.md'
    };
  }

  return {
    codigo: 'SC_RS',
    nome: 'Manual de Calagem e Adubação para RS/SC 2016',
    arquivo: 'prompts/manuais/Manual_Calagem_Adubacao_Resumo_Expandido.md'
  };
}

function interpretarLaudoSolo(parametros, qualidadeImagem, localizacao = {}) {
  const problemas = [];
  const recomendacoes = [];
  const formulasAplicadas = [];
  const manual = selecionarManualRegional(localizacao);
  const baseManual = (regra) => `${manual.nome}: ${regra}`;

  if (parametros.v !== null) {
    formulasAplicadas.push('Saturação por bases: V% = ((Ca + Mg + K) / CTC) x 100.');
  }
  if (parametros.ctc !== null && parametros.v !== null) {
    formulasAplicadas.push('Calagem por saturação de bases: NC = (CTC x (V2 - V1)) / 100, quando a cultura definir V2.');
  }
  if (parametros.nc !== null && parametros.prnt !== null) {
    formulasAplicadas.push('Ajuste por PRNT: NCcorrigida = (NC x 100) / PRNT.');
  }

  if (parametros.ph !== null && parametros.ph < 5.5) {
    adicionarProblemaLaudo(problemas, 'Acidez do solo', `pH ${parametros.ph} sugere solo ácido.`, 'Pode reduzir disponibilidade de nutrientes e favorecer toxicidade por alumínio.', parametros.ph < 5 ? 'Alto' : 'Médio', 'Médio');
    adicionarRecomendacaoLaudo(recomendacoes, 'Avaliar calagem antes da adubação.', 'Corrigir acidez e melhorar o ambiente radicular.', 'Ajuda a elevar pH, neutralizar alumínio e fornecer cálcio e magnésio.', 'Média', baseManual('calagem para elevar pH, neutralizar Al e fornecer Ca/Mg.'));
  }

  if (parametros.al !== null && parametros.al > 0.2) {
    adicionarProblemaLaudo(problemas, 'Alumínio elevado', `Al ${parametros.al} indica possível risco de alumínio tóxico.`, 'Pode limitar crescimento de raízes e absorção de água e nutrientes.', parametros.al > 0.5 ? 'Alto' : 'Médio', 'Médio');
    adicionarRecomendacaoLaudo(recomendacoes, 'Priorizar correção da acidez e conferir necessidade de calcário.', 'Reduzir o efeito do alumínio no sistema radicular.', 'Favorece raízes mais profundas e melhor aproveitamento de nutrientes.', 'Média', baseManual('acidez causa toxicidade por alumínio; calagem corrige esse problema.'));
  }

  if (parametros.v !== null && parametros.v < 50) {
    adicionarProblemaLaudo(problemas, 'Saturação por bases baixa', `V% ${parametros.v} sugere baixa presença de bases trocáveis.`, 'Indica solo menos corrigido quimicamente e com maior necessidade de manejo da acidez.', parametros.v < 35 ? 'Alto' : 'Médio', 'Médio');
    adicionarRecomendacaoLaudo(recomendacoes, 'Calcular a necessidade de calcário com a meta da cultura.', 'Elevar a saturação por bases para o nível recomendado.', 'Melhora fertilidade química e eficiência da adubação.', 'Média', baseManual('V% = ((Ca + Mg + K) / CTC) x 100; NC = (CTC x (V2 - V1)) / 100.'));
  }

  if (parametros.mo !== null && parametros.mo < 2.5) {
    adicionarProblemaLaudo(problemas, 'Matéria orgânica baixa', `MO ${parametros.mo}% aparenta estar baixa.`, 'Pode reduzir estrutura, retenção de água, CTC e atividade biológica.', parametros.mo < 1.5 ? 'Alto' : 'Médio', 'Médio');
    adicionarRecomendacaoLaudo(recomendacoes, 'Aumentar cobertura vegetal, palhada e fontes orgânicas bem manejadas.', 'Elevar matéria orgânica de forma gradual.', 'Melhora retenção de água, reserva de nutrientes e estrutura do solo.', 'Média', baseManual('matéria orgânica melhora estrutura, CTC, retenção de água e atividade biológica.'));
  }

  if (parametros.p !== null && parametros.p < 8) {
    adicionarProblemaLaudo(problemas, 'Fósforo baixo', `P ${parametros.p} sugere baixa disponibilidade, dependendo do método e da argila.`, 'Pode reduzir enraizamento, energia da planta e produção.', 'Médio', 'Baixo');
    adicionarRecomendacaoLaudo(recomendacoes, 'Planejar adubação fosfatada de correção e manutenção conforme cultura e teor de argila.', 'Corrigir deficiência provável de fósforo.', 'Favorece raízes, formação de sementes e produtividade.', 'Média', baseManual('fósforo tem baixa mobilidade; teores muito baixos pedem correção + manutenção.'));
  }

  if (parametros.k !== null) {
    const kBaixo = parametros.unidadeK === 'mg/dm3' ? parametros.k < 60 : parametros.k < 0.15;
    if (kBaixo) {
      adicionarProblemaLaudo(problemas, 'Potássio baixo', `K ${parametros.k}${parametros.unidadeK ? ` ${parametros.unidadeK}` : ''} sugere baixa disponibilidade.`, 'Pode afetar controle hídrico, resistência e formação de grãos.', 'Médio', 'Baixo');
      adicionarRecomendacaoLaudo(recomendacoes, 'Ajustar adubação potássica considerando cultura e exportação pela colheita.', 'Repor potássio removido e corrigir baixa disponibilidade.', 'Ajuda no controle hídrico e na formação de grãos.', 'Média', baseManual('reposição de K deve considerar exportação pela colheita.'));
    }
  }

  if (parametros.ca !== null && parametros.ca < 2) {
    adicionarProblemaLaudo(problemas, 'Cálcio baixo', `Ca ${parametros.ca} sugere baixa disponibilidade.`, 'Pode limitar desenvolvimento radicular e equilíbrio químico.', 'Médio', 'Médio');
  }

  if (parametros.mg !== null && parametros.mg < 0.5) {
    adicionarProblemaLaudo(problemas, 'Magnésio baixo', `Mg ${parametros.mg} sugere baixa disponibilidade.`, 'Pode prejudicar nutrição da planta e equilíbrio de bases.', 'Médio', 'Médio');
  }

  if (parametros.nc !== null && parametros.prnt !== null) {
    const ncCorrigida = Number(((parametros.nc * 100) / parametros.prnt).toFixed(2));
    adicionarRecomendacaoLaudo(recomendacoes, `Se a NC informada for ${parametros.nc} t/ha e o PRNT for ${parametros.prnt}%, a dose corrigida fica próxima de ${ncCorrigida} t/ha.`, 'Ajustar a dose ao poder relativo de neutralização do calcário.', 'Evita subdosagem quando o PRNT é menor que 100%.', 'Fácil', baseManual('NCcorrigida = (NC x 100) / PRNT.'));
  }

  if (parametros.smp !== null) {
    adicionarRecomendacaoLaudo(recomendacoes, 'Usar o índice SMP junto à tabela regional do manual para estimar a calagem.', 'Evitar cálculo de calcário sem a tabela adequada.', 'A recomendação fica mais fiel ao método regional.', 'Média', baseManual('usar o índice SMP junto à tabela regional quando aplicável.'));
  }

  const status = problemas.length ? 'interpretado_com_alertas' : 'interpretado_sem_alertas';
  const resumo = problemas.length
    ? `Foram encontrados ${problemas.length} ponto(s) de atenção no laudo. O principal cuidado é corrigir primeiro acidez e bases quando esses indicadores estiverem baixos.`
    : 'Os valores informados não indicaram problema claro pelos critérios gerais usados. A recomendação final ainda depende da cultura, produtividade esperada e tabela regional.';

  return {
    qualidadeImagem,
    tipoAnalise: ANALYSIS_CATEGORY,
    localizacaoIdentificada: localizacao,
    manualAplicado: manual,
    parametrosIdentificados: parametros,
    formulasAplicadas,
    diagnostico: {
      descricao: resumo,
      confianca: parametrosEncontrados(parametros).length >= 5 ? 'Médio' : 'Baixo'
    },
    problemas,
    recomendacoes,
    resumo
  };
}

function calcularIndiceDoLaudo(relatorio) {
  if (!relatorio || relatorio.status === 'dados_insuficientes') {
    return {
      valor: null,
      texto: 'Não calculado',
      classificacao: 'Dados insuficientes',
      motivo: 'Não há parâmetros suficientes para calcular o índice do laudo.'
    };
  }

  let valor = 100;
  relatorio.problemas.forEach((problema) => {
    if (problema.severidade === 'Alto') valor -= 28;
    else if (problema.severidade === 'Médio') valor -= 18;
    else valor -= 8;
  });

  valor = clamp(valor, 0, 100);
  let classificacao = 'Boa';
  if (valor < 40) classificacao = 'Crítica';
  else if (valor < 70) classificacao = 'Atenção';
  else if (valor < 90) classificacao = 'Regular';

  return {
    valor,
    texto: `${valor}/100 - ${classificacao}`,
    classificacao,
    motivo: relatorio.problemas.length ? 'Índice calculado somente pelos problemas encontrados neste laudo.' : 'Sem alertas técnicos claros nos valores informados.'
  };
}

function classeDoFosforo(valorP) {
  if (valorP === null || valorP === undefined) return { classe: 'não lido', p2o5: null };
  if (valorP < 8) return { classe: 'baixo', p2o5: 100 };
  if (valorP < 15) return { classe: 'médio', p2o5: 70 };
  if (valorP < 30) return { classe: 'adequado', p2o5: 40 };
  return { classe: 'alto', p2o5: 20 };
}

function classeDoPotassio(valorK, unidadeK) {
  if (valorK === null || valorK === undefined) return { classe: 'não lido', k2o: null, unidade: unidadeK || '' };

  const unidadeFinal = unidadeK || (valorK > 5 ? 'mg/dm3' : 'cmolc/dm3');
  if (unidadeFinal === 'mg/dm3') {
    if (valorK < 60) return { classe: 'baixo', k2o: 100, unidade: unidadeFinal };
    if (valorK < 120) return { classe: 'médio', k2o: 70, unidade: unidadeFinal };
    if (valorK < 180) return { classe: 'adequado', k2o: 40, unidade: unidadeFinal };
    return { classe: 'alto', k2o: 20, unidade: unidadeFinal };
  }

  if (valorK < 0.15) return { classe: 'baixo', k2o: 100, unidade: unidadeFinal };
  if (valorK < 0.3) return { classe: 'médio', k2o: 70, unidade: unidadeFinal };
  if (valorK < 0.45) return { classe: 'adequado', k2o: 40, unidade: unidadeFinal };
  return { classe: 'alto', k2o: 20, unidade: unidadeFinal };
}

function nitrogenioPorCultura(cultura) {
  const tabela = {
    soja: {
      n: 0,
      texto: '0 kg/ha de N mineral; priorizar inoculação bem feita.'
    },
    milho: {
      n: 120,
      texto: '120 kg/ha de N como estimativa inicial; ajustar pela produtividade esperada.'
    },
    trigo: {
      n: 80,
      texto: '80 kg/ha de N como estimativa inicial; ajustar pela produtividade esperada.'
    },
    feijao: {
      n: 40,
      texto: '40 kg/ha de N como estimativa inicial; ajustar pelo manejo e inoculação.'
    },
    geral: {
      n: null,
      texto: 'N não calculado sem cultura definida.'
    }
  };

  return tabela[cultura] || tabela.geral;
}

function estimarNPK(parametros, cultura) {
  const p = classeDoFosforo(parametros.p);
  const k = classeDoPotassio(parametros.k, parametros.unidadeK);
  const n = nitrogenioPorCultura(cultura);

  const textoN = n.n === null ? 'N: não calculado' : `N: ${n.n} kg/ha`;
  const textoP = p.p2o5 === null ? 'P2O5: não calculado' : `P2O5: ${p.p2o5} kg/ha`;
  const textoK = k.k2o === null ? 'K2O: não calculado' : `K2O: ${k.k2o} kg/ha`;

  return {
    cultura,
    nKgHa: n.n,
    p2o5KgHa: p.p2o5,
    k2oKgHa: k.k2o,
    classeP: p.classe,
    classeK: k.classe,
    observacaoN: n.texto,
    observacao: 'Estimativa educativa. A dose final deve considerar cultura, produtividade esperada, histórico da área e recomendação regional.',
    texto: `${textoN}; ${textoP}; ${textoK}. P está ${p.classe}; K está ${k.classe}.`
  };
}

function renderizarLista(elemento, itens) {
  elemento.innerHTML = '';
  const lista = Array.isArray(itens) && itens.length ? itens : ['Sem informação para mostrar.'];
  lista.forEach((texto) => {
    const li = document.createElement('li');
    li.textContent = texto;
    elemento.appendChild(li);
  });
}

function gerarListaNPK(npkSummary) {
  if (!npkSummary || npkSummary.nKgHa === undefined) {
    return ['Não foi possível calcular N, P e K porque faltaram valores do laudo.'];
  }

  return [
    npkSummary.nKgHa === null ? 'Nitrogênio (N): não calculado sem cultura definida.' : `Nitrogênio (N): ${npkSummary.nKgHa} kg/ha.`,
    npkSummary.p2o5KgHa === null ? 'Fósforo (P2O5): não calculado porque o P não foi lido.' : `Fósforo (P2O5): ${npkSummary.p2o5KgHa} kg/ha.`,
    npkSummary.k2oKgHa === null ? 'Potássio (K2O): não calculado porque o K não foi lido.' : `Potássio (K2O): ${npkSummary.k2oKgHa} kg/ha.`,
    'Use esses números como estimativa inicial. A dose final deve ser conferida para a cultura e a região.'
  ];
}

function gerarListaResumoParaLeigos(relatorio) {
  const problemas = relatorio.problemas || [];

  if (!problemas.length) {
    return [
      'Não apareceu nenhum problema forte nos números lidos.',
      'Mesmo assim, confirme a recomendação para a cultura que será plantada.',
      'Confira se a leitura da foto pegou os números corretamente.'
    ];
  }

  const principal = problemas[0];
  const primeiraRecomendacao = relatorio.recomendacoes?.[0]?.acao || 'Conferir o laudo com assistência técnica antes de aplicar corretivos ou adubos.';
  return [
    `Principal problema: ${principal.nome}.`,
    `O que fazer primeiro: ${primeiraRecomendacao}`,
    'Antes de aplicar, confira se a foto leu corretamente os valores do laudo.'
  ];
}

function gerarResumoParaLeigos(relatorio) {
  const problemas = relatorio.problemas || [];

  if (!problemas.length) {
    return 'Não apareceu nenhum problema forte nos números lidos. Mesmo assim, confirme a recomendação para a cultura que será plantada.';
  }

  const principal = problemas[0];
  const primeiraRecomendacao = relatorio.recomendacoes?.[0]?.acao || 'Conferir o laudo com assistência técnica antes de aplicar corretivos ou adubos.';
  return `Principal problema: ${principal.nome}. O que fazer: ${primeiraRecomendacao}`;
}

function resultadoComDadosInsuficientes(qualidadeImagem, textoLaudo) {
  const relatorio = {
    qualidadeImagem,
    tipoAnalise: ANALYSIS_CATEGORY,
    status: 'dados_insuficientes',
    parametrosIdentificados: {},
    problemas: [],
    recomendacoes: [],
    resumo: textoLaudo.trim()
      ? 'O texto foi lido, mas não foram encontrados parâmetros suficientes. Confira se a foto mostra a linha de cabeçalhos e a linha de valores da tabela, como pH, P, K, Ca, Mg, Al, CTC, Bases, MO ou SMP.'
      : 'A foto foi enviada, mas não foi possível ler números suficientes do laudo. O sistema não deve inventar interpretação técnica.'
  };

  return {
    description: 'Não consegui ler valores suficientes do laudo pela imagem. Tente uma foto mais próxima, bem iluminada, sem sombra e com o papel reto.',
    detectedElements: [{ nome: 'Leitura insuficiente', evidencia: relatorio.resumo, confianca: 'Alto' }],
    simpleSummary: 'Não deu para entender o laudo ainda. Tire outra foto mais clara e de perto, mostrando bem os números.',
    simpleSummaryItems: [
      'Não deu para entender o laudo ainda.',
      'Tire outra foto mais clara, de perto e mostrando bem os números.',
      'Nenhuma recomendação foi calculada para evitar erro.'
    ],
    diagnosis: 'Diagnóstico: dados insuficientes para interpretar o laudo de solo.',
    technicalReport: relatorio,
    imageSustainability: calcularIndiceDoLaudo(relatorio),
    npkSummary: { texto: 'NPK não calculado porque faltaram valores do laudo.' },
    npkSummaryItems: ['N, P e K não foram calculados porque faltaram valores do laudo.'],
    confidence: 20,
    priority: 'Baixa',
    recommendations: []
  };
}

async function simulateAnalysis(imageFile, category, reportText = '', cultura = 'soja', localizacao = {}) {
  const stats = await extractImageStats(imageFile);
  const qualidadeImagemTexto = qualidadeDaImagem(stats);
  const parametros = extrairParametrosLaudo(reportText);
  const encontrados = parametrosEncontrados(parametros);

  if (encontrados.length < 2) {
    return resultadoComDadosInsuficientes(qualidadeImagemTexto, reportText);
  }

  const relatorio = interpretarLaudoSolo(parametros, qualidadeImagemTexto, localizacao);
  const npkSummary = estimarNPK(parametros, cultura);
  npkSummary.manualAplicado = relatorio.manualAplicado;
  npkSummary.observacao = `${npkSummary.observacao} Referência regional aplicada: ${relatorio.manualAplicado.nome}.`;
  relatorio.npkEstimado = npkSummary;
  const prioridade = prioridadeDoRelatorio(relatorio);
  const confianca = encontrados.length >= 6 ? 82 : encontrados.length >= 4 ? 70 : 55;
  const indice = calcularIndiceDoLaudo(relatorio);
  const parametrosTexto = encontrados
    .map((item) => `${item.chave.toUpperCase()}: ${item.valor}`)
    .join('; ');

  return {
    description: `Valores reconhecidos na imagem do laudo: ${parametrosTexto}. Manual aplicado: ${relatorio.manualAplicado.nome}.`,
    detectedElements: [
      {
        nome: 'Origem do laudo',
        evidencia: localizacao.estado
          ? `${localizacao.estado}. ${localizacao.evidencia || 'Estado identificado pela IA na imagem.'}`
          : 'Estado não identificado; aplicado o manual padrão de SC/RS.',
        confianca: localizacao.confianca || 'baixa'
      },
      {
        nome: 'Manual aplicado',
        evidencia: relatorio.manualAplicado.nome,
        confianca: 'Alto'
      },
      ...encontrados.map((item) => ({
        nome: item.chave.toUpperCase(),
        evidencia: `Valor informado no laudo: ${item.valor}`,
        confianca: 'Médio'
      }))
    ],
    simpleSummary: gerarResumoParaLeigos(relatorio),
    simpleSummaryItems: gerarListaResumoParaLeigos(relatorio),
    diagnosis: `Diagnóstico técnico: ${relatorio.resumo}`,
    technicalReport: relatorio,
    imageSustainability: indice,
    npkSummary,
    npkSummaryItems: gerarListaNPK(npkSummary),
    confidence: confianca,
    priority: prioridade,
    recommendations: [
      `Adubação estimada: ${npkSummary.texto} ${npkSummary.observacao}`,
      ...relatorio.recomendacoes.map((item) => `${item.acao} Objetivo: ${item.objetivo} Benefício: ${item.beneficio} Facilidade: ${item.facilidade}. Base: ${item.baseManual}`)
    ]
  };
}

function updateProgress(value) {
  progressFill.style.width = `${value}%`;
}

async function processAnalysis() {
  const file = selectedImageFile;
  if (!file) {
    alert('Por favor, envie uma imagem para análise.');
    return;
  }

  startAnalysis.disabled = true;
  resultSection.classList.add('hidden');
  updateProgress(8);

  let result;
  try {
    const textoDigitadoAntes = soilReportText.value.trim();
    let textoReconhecido = '';
    let leituraVisualAceita = false;
    let localizacaoLaudo = {};

    try {
      ocrStatus.textContent = 'Enviando imagem para leitura com a Groq...';
      const leituraGroq = await window.groqApi.lerLaudo(file);
      const parametrosGroq = leituraGroq.parametros;
      localizacaoLaudo = leituraGroq.localizacao || {};
      const textoGroq = parametrosGroqParaTexto(parametrosGroq);
      const quantidadeLida = parametrosEncontrados(extrairParametrosLaudo(textoGroq)).length;

      if (quantidadeLida >= 3) {
        textoReconhecido = textoGroq;
        leituraVisualAceita = true;
        soilReportText.value = textoReconhecido;
        ocrStatus.textContent = 'Valores lidos pela Groq. Gerando análise...';
      } else {
        console.info('A Groq retornou poucos valores. Continuando com OCR de reserva.', parametrosGroq);
      }
    } catch (visionError) {
      console.warn('Falha na leitura com a Groq, usando OCR como reserva:', visionError);
      ocrStatus.textContent = 'A Groq não conseguiu ler o laudo. Tentando OCR tradicional...';
    }

    try {
      if (!leituraVisualAceita) {
        textoReconhecido = prepararTextoReconhecido(await reconhecerTextoDaImagem(file));
        const textoTabelaRecortada = prepararTextoReconhecido(await reconhecerTabelaPrincipalPorRecorte(file));
        if (textoTabelaRecortada) {
          textoReconhecido = `${textoReconhecido}\n\n${textoTabelaRecortada}`.trim();
        }
        if (textoReconhecido) {
          soilReportText.value = textoReconhecido;
          ocrStatus.textContent = 'Texto lido. Gerando análise...';
        } else {
          ocrStatus.textContent = 'Não consegui ler texto suficiente na foto.';
        }
      }
    } catch (ocrError) {
      console.warn('Falha no OCR da imagem:', ocrError);
      ocrStatus.textContent = 'Não foi possível carregar a leitura automática. Usando o texto disponível.';
    }

    updateProgress(70);
    const textoParaAnalise = textoReconhecido || textoDigitadoAntes;
    result = await simulateAnalysis(file, ANALYSIS_CATEGORY, textoParaAnalise, cropSelect.value, localizacaoLaudo);
    updateProgress(100);
  } catch (error) {
    console.error('Falha na análise local:', error);
    resultSection.classList.add('hidden');
    startAnalysis.disabled = false;
    ocrStatus.textContent = 'Falha ao interpretar o laudo.';
    alert('Não foi possível processar a análise local no momento. Tente novamente mais tarde.');
    return;
  }

  descriptionText.textContent = result.description;
  renderizarLista(simpleSummaryList, result.simpleSummaryItems || [result.simpleSummary]);
  renderizarLista(npkSummaryList, result.npkSummaryItems || [result.npkSummary?.texto || 'NPK não calculado.']);
  diagnosisText.textContent = result.diagnosis;
  detectedElementsList.innerHTML = '';
  result.detectedElements.forEach((elemento) => {
    const li = document.createElement('li');
    li.textContent = `${elemento.nome}. Evidência: ${elemento.evidencia}. Confiança: ${elemento.confianca}.`;
    detectedElementsList.appendChild(li);
  });
  technicalReportText.textContent = result.technicalReport
    ? JSON.stringify(result.technicalReport, null, 2)
    : 'Relatório técnico estruturado indisponível para esta análise.';
  recommendationList.innerHTML = '';
  result.recommendations.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    recommendationList.appendChild(li);
  });

  resultSection.classList.remove('hidden');
  startAnalysis.disabled = false;
  startAnalysis.textContent = 'Analisar novamente';

  if (!achievements.includes('Primeira análise')) achievements.push('Primeira análise');
  if (result.priority === 'Alta' && !achievements.includes('Solo saudável')) achievements.push('Solo saudável');
  if (result.imageSustainability.valor !== null && result.imageSustainability.valor >= 85 && !achievements.includes('Imagem sustentável')) achievements.push('Imagem sustentável');
  saveAchievements();

  renderDashboard();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = loginForm.name.value.trim();
  const city = loginForm.city.value.trim();
  if (!name || !city) return;
  userData = { name, city };
  saveUser(userData);
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  renderDashboard();
});

if (userData) {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  renderDashboard();
} else {
  userBadge.classList.add('hidden');
}

startAnalysis.addEventListener('click', processAnalysis);

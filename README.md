# Minhoca Vision

Projeto web PWA criado para o Agrinho 2026 com o tema:

**Agro forte, futuro sustentável: equilíbrio entre produção e meio ambiente**

## Produção

A aplicação em produção está disponível em:

https://agrinho2026-flame-nine.vercel.app/

## Descrição

O Minhoca Vision é uma plataforma web educativa para interpretar laudos laboratoriais de solo em linguagem simples.

O projeto foi pensado para produtores rurais, estudantes e pessoas sem formação técnica em fertilidade, que precisam transformar um laudo cheio de siglas e números em ações práticas de manejo.

O usuário envia ou tira uma foto do laudo, e o sistema tenta reconhecer na imagem os principais valores, como pH, P, K, Ca, Mg, Al, CTC, V%, matéria orgânica, SMP e PRNT.

O fluxo usa leitura por IA e, quando necessário, OCR como reserva. Antes da análise final, o usuário pode revisar o texto reconhecido.

Com esses dados, o sistema mostra um resumo simples, identifica pontos de atenção e gera recomendações práticas de correção e manejo quando necessário.

Em resumo, o Minhoca Vision funciona como um apoio à decisão: traduz o laudo, organiza prioridades e apresenta recomendações de forma acessível, sem substituir a orientação agronômica profissional.

## Como funciona

1. O usuário faz login com nome e cidade.
2. Envia uma foto do laudo ou tira uma foto pelo celular.
3. O app tenta ler automaticamente os valores com IA.
4. Se faltarem dados, o app tenta OCR como reserva e permite correção manual do texto reconhecido.
5. O app mostra resumo, diagnóstico, índice do laudo, recomendações e JSON técnico.

## Importante

A foto é a fonte principal da interpretação. Se a leitura automática não conseguir reconhecer números suficientes, o app usa OCR de reserva e mantém a possibilidade de revisão manual para evitar interpretações incorretas.

Offline, a interface pode continuar disponível após o primeiro carregamento. A leitura por IA depende de internet, e a leitura por OCR offline depende de os recursos já estarem em cache no navegador.

## Base técnica

As recomendações usam como referência os materiais resumidos em:

- `prompts/manuais/Fertilidade_Solo_Parana_Resumo_Expandido.md`
- `prompts/manuais/Manual_Calagem_Adubacao_Resumo_Expandido.md`
- `prompts/laudo_solo.json`

## Arquivos principais

- `index.html` - página inicial
- `pages/app.html` - aplicação de interpretação do laudo
- `pages/creditos.html` - créditos e transparência
- `pages/offline.html` - página exibida sem conexão
- `css/styles.css` - estilos responsivos e modo escuro
- `js/script.js` - tema e registro do service worker
- `js/app.js` - login, leitura dos valores e geração do relatório
- `js/groq-api.js` - envio da imagem pelo navegador
- `js/groq-client.js` - comunicação segura do servidor com a Groq
- `sw.js` - cache offline
- `manifest.webmanifest` - configuração do PWA

## Como testar

```bash
npm install
npm start
```

Acesse:

```text
http://localhost:3000
```

## Deploy na Vercel

O projeto está preparado para rodar na Vercel com servidor Node (Express) e rota de API para leitura com Groq.

Configuração recomendada:

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: deixe em branco
- Install Command: `npm install`

## Deploy no GitHub Pages

O GitHub Pages publica só a parte estática. Neste projeto, a interface roda em Pages e a leitura com Groq continua apontando para o backend na Vercel.

Passos:

1. Crie uma branch `gh-pages` ou use o workflow do GitHub Pages.
2. Publique a pasta raiz do projeto como site estático.
3. Mantenha `js/config.js` apontando para o backend em produção.
4. Garanta que o domínio do Pages esteja autorizado no formulário que vai receber o link.

Arquivos já ajustados para Pages:

- caminhos relativos em `index.html` e `pages/*`
- `manifest.webmanifest` com `start_url` relativo
- `sw.js` com cache relativo

## Limitação técnica

O Minhoca Vision é uma ferramenta educativa e de apoio. Ele não substitui um agrônomo, laboratório ou recomendação oficial por cultura e região.
# Configuração da Groq

Defina `GROQ_API_KEY` no ambiente antes de iniciar o servidor. Opcionalmente, use
`GROQ_VISION_MODEL` para trocar o modelo de visão.

```powershell
$env:GROQ_API_KEY="sua_chave"
npm start
```

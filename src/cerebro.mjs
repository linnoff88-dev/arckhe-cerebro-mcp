// Núcleo do cerebro-mcp: lê, busca e (opcionalmente) escreve num segundo cérebro
// criado pelo kit astra-2cerebro. Sem dependência externa — só Node.js.
//
// Tudo aqui é independente do MCP: dá para usar em testes, scripts ou outro servidor.

import fs from 'node:fs';
import path from 'node:path';

/** Pastas que nunca entram na busca nem podem ser lidas pelas ferramentas. */
export const PASTAS_BLOQUEADAS = new Set(['.git', 'node_modules']);

/** Pastas puladas na indexação (skills, apps geradas etc.), mas legíveis se pedidas. */
export const PASTAS_IGNORADAS_NA_BUSCA = new Set(['.git', 'node_modules', '.claude', '.agents', '.codex', 'apps']);

/** Erro previsível do cérebro (caminho inválido, arquivo ausente, escrita desligada). */
export class ErroCerebro extends Error {
  constructor(mensagem, codigo = 'ERRO_CEREBRO') {
    super(mensagem);
    this.name = 'ErroCerebro';
    this.codigo = codigo;
  }
}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Minúsculas e sem acentos, para comparar "decisão" com "decisao". */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Vira slug de arquivo: "Reunião com a Empresa X" → "reuniao-com-a-empresa-x". */
export function slugificar(texto) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sem-nome';
}

/** Data local AAAA-MM-DD (sem usar toISOString, que devolve UTC). */
export function dataLocal(data = new Date()) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/** Data e hora local "AAAA-MM-DD HH:MM". */
export function dataHoraLocal(data = new Date()) {
  const h = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');
  return `${dataLocal(data)} ${h}:${mi}`;
}

/** Separa frontmatter YAML simples (chave: valor) do corpo. */
export function separarFrontmatter(texto) {
  const meta = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { meta, corpo: texto, bruto: '' };
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(':');
    if (i > 0) meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  return { meta, corpo: texto.slice(m[0].length), bruto: m[1] };
}

/** Primeiro título "# ..." do corpo; senão, o nome do arquivo. */
export function extrairTitulo(corpo, caminho) {
  const m = /^#\s+(.+?)\s*$/m.exec(corpo);
  if (m) return m[1].trim();
  return path.basename(caminho, '.md');
}

/** Alvos de [[wikilinks]] no texto (sem o alias "|texto"). */
export function extrairWikilinks(texto) {
  const alvos = new Set();
  for (const m of texto.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) alvos.add(m[1].trim());
  return [...alvos];
}

/**
 * Extrai uma seção Markdown: do título que casa com `regexTitulo` até o próximo
 * título de nível igual ou superior. Devolve null se não achar.
 */
export function extrairSecao(texto, regexTitulo) {
  const linhas = texto.split(/\r?\n/);
  let inicio = -1;
  let nivel = 0;
  for (let i = 0; i < linhas.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(linhas[i]);
    if (m && regexTitulo.test(m[2])) {
      inicio = i;
      nivel = m[1].length;
      break;
    }
  }
  if (inicio < 0) return null;
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    const m = /^(#{1,6})\s+/.exec(linhas[i]);
    if (m && m[1].length <= nivel) {
      fim = i;
      break;
    }
  }
  return linhas.slice(inicio, fim).join('\n').trim();
}

/** Lê tabelas Markdown "| a | b |" e devolve [{cabecalho, linhas:[{col:valor}], bruto}]. */
export function extrairTabelas(texto) {
  const linhas = texto.split(/\r?\n/);
  const tabelas = [];
  let i = 0;
  while (i < linhas.length) {
    if (/^\s*\|/.test(linhas[i]) && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] ?? '')) {
      const cabecalho = dividirLinhaTabela(linhas[i]);
      const bruto = [linhas[i], linhas[i + 1]];
      const dados = [];
      let j = i + 2;
      while (j < linhas.length && /^\s*\|/.test(linhas[j])) {
        const celulas = dividirLinhaTabela(linhas[j]);
        const obj = {};
        cabecalho.forEach((c, k) => { obj[c] = celulas[k] ?? ''; });
        dados.push(obj);
        bruto.push(linhas[j]);
        j++;
      }
      tabelas.push({ cabecalho, linhas: dados, bruto: bruto.join('\n') });
      i = j;
    } else {
      i++;
    }
  }
  return tabelas;
}

function dividirLinhaTabela(linha) {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** Prepara um valor para entrar numa célula de tabela (sem quebrar a tabela). */
export function celula(valor) {
  return String(valor ?? '').replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

// ---------------------------------------------------------------------------
// Localização do cérebro
// ---------------------------------------------------------------------------

/** Diz se a pasta parece um cérebro (tem AGENTS.md ou CLAUDE.md). */
export function pareceCerebro(dir) {
  return ['AGENTS.md', 'CLAUDE.md'].some((f) => fs.existsSync(path.join(dir, f)));
}

/**
 * Resolve a pasta do cérebro: --dir > CEREBRO_DIR > pasta atual (se for um cérebro).
 * Lança ErroCerebro com mensagem clara quando não encontra.
 */
export function resolverDir({ dir, env = process.env, cwd = process.cwd() } = {}) {
  const candidato = dir || env.CEREBRO_DIR || null;
  if (candidato) {
    const abs = path.resolve(cwd, candidato);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new ErroCerebro(`A pasta do cérebro não existe: ${abs}`, 'DIR_INEXISTENTE');
    }
    if (!pareceCerebro(abs)) {
      throw new ErroCerebro(
        `A pasta ${abs} não parece um cérebro: não tem AGENTS.md nem CLAUDE.md. ` +
        'Aponte --dir (ou CEREBRO_DIR) para a pasta criada pelo kit astra-2cerebro.',
        'NAO_E_CEREBRO',
      );
    }
    return fs.realpathSync(abs);
  }
  if (pareceCerebro(cwd)) return fs.realpathSync(cwd);
  throw new ErroCerebro(
    `Nenhum cérebro encontrado. A pasta atual (${cwd}) não tem AGENTS.md nem CLAUDE.md. ` +
    'Use --dir <pasta> ou a variável de ambiente CEREBRO_DIR.',
    'SEM_CEREBRO',
  );
}

// ---------------------------------------------------------------------------
// A classe principal
// ---------------------------------------------------------------------------

export class Cerebro {
  /**
   * @param {string} dir pasta raiz do cérebro (já validada)
   * @param {{escrita?: boolean}} opcoes escrita desligada por padrão
   */
  constructor(dir, { escrita = false } = {}) {
    this.dir = fs.realpathSync(dir);
    this.escrita = Boolean(escrita);
  }

  // --- caminhos e leitura ---------------------------------------------------

  /**
   * Converte um caminho relativo em absoluto, garantindo que fica dentro do
   * cérebro e fora de .git, node_modules e arquivos .env. Segue symlinks e
   * confere de novo, para um link apontando para fora não passar.
   */
  caminhoSeguro(caminho) {
    if (typeof caminho !== 'string' || !caminho.trim()) {
      throw new ErroCerebro('Informe um caminho relativo dentro do cérebro.', 'CAMINHO_VAZIO');
    }
    if (caminho.includes('\0')) throw new ErroCerebro('Caminho inválido.', 'CAMINHO_INVALIDO');

    const abs = path.resolve(this.dir, caminho);
    this.#exigirDentro(abs, caminho);

    const rel = path.relative(this.dir, abs);
    for (const seg of rel.split(path.sep)) {
      if (PASTAS_BLOQUEADAS.has(seg) || seg.startsWith('.env')) {
        throw new ErroCerebro(`Acesso negado a "${caminho}": ${seg} é protegido.`, 'CAMINHO_PROTEGIDO');
      }
    }

    // Segue symlinks do trecho que existe e confere de novo o prefixo.
    let existente = abs;
    while (!fs.existsSync(existente)) {
      const pai = path.dirname(existente);
      if (pai === existente) break;
      existente = pai;
    }
    const real = fs.realpathSync(existente);
    this.#exigirDentro(real, caminho);
    return abs;
  }

  #exigirDentro(abs, original) {
    if (abs !== this.dir && !abs.startsWith(this.dir + path.sep)) {
      throw new ErroCerebro(`Acesso negado: "${original}" está fora do cérebro.`, 'FORA_DO_CEREBRO');
    }
  }

  /** Caminho relativo normalizado (com "/"), para mostrar ao usuário. */
  relativo(abs) {
    return path.relative(this.dir, abs).split(path.sep).join('/');
  }

  existe(caminho) {
    try {
      return fs.existsSync(this.caminhoSeguro(caminho));
    } catch {
      return false;
    }
  }

  /** Lê um arquivo do cérebro. Lança ErroCerebro se não existir ou for proibido. */
  ler(caminho) {
    const abs = this.caminhoSeguro(caminho);
    if (!fs.existsSync(abs)) throw new ErroCerebro(`Arquivo não encontrado: ${caminho}`, 'NAO_ENCONTRADO');
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      const itens = fs.readdirSync(abs).filter((n) => !PASTAS_BLOQUEADAS.has(n) && !n.startsWith('.env')).sort();
      return { caminho: this.relativo(abs), diretorio: true, itens, conteudo: itens.join('\n') };
    }
    return { caminho: this.relativo(abs), diretorio: false, conteudo: fs.readFileSync(abs, 'utf8') };
  }

  /** Lê se existir; senão devolve null (sem lançar). */
  lerOpcional(caminho) {
    try {
      return this.ler(caminho);
    } catch (e) {
      if (e instanceof ErroCerebro && e.codigo === 'NAO_ENCONTRADO') return null;
      throw e;
    }
  }

  /** Lista todos os .md do cérebro (caminhos relativos), pulando pastas ignoradas. */
  listarMarkdown() {
    const saida = [];
    const andar = (abs) => {
      let entradas;
      try {
        entradas = fs.readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entradas) {
        if (PASTAS_IGNORADAS_NA_BUSCA.has(e.name)) continue;
        const filho = path.join(abs, e.name);
        if (e.isDirectory()) andar(filho);
        else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) saida.push(this.relativo(filho));
      }
    };
    andar(this.dir);
    return saida.sort();
  }

  /** Carrega um .md já separado em meta/corpo/título/wikilinks. */
  carregarNota(caminho) {
    const { conteudo } = this.ler(caminho);
    const { meta, corpo, bruto } = separarFrontmatter(conteudo);
    return {
      caminho,
      slug: path.basename(caminho, '.md'),
      titulo: extrairTitulo(corpo, caminho),
      meta,
      frontmatter: bruto,
      corpo,
      conteudo,
      wikilinks: extrairWikilinks(corpo),
    };
  }

  // --- leituras de alto nível ----------------------------------------------

  /** sobre-mim + sobre-o-trabalho + prioridades, cada um com o caminho. */
  contexto() {
    const arquivos = ['contexto/sobre-mim.md', 'contexto/sobre-o-trabalho.md', 'contexto/prioridades.md'];
    const partes = arquivos.map((c) => {
      const r = this.lerOpcional(c);
      return { caminho: c, conteudo: r ? r.conteudo.trim() : null };
    });
    const texto = partes
      .map((p) => `<!-- ${p.caminho} -->\n${p.conteudo ?? '(ausente)'}`)
      .join('\n\n---\n\n');
    return { partes, texto };
  }

  prioridades() {
    const r = this.lerOpcional('contexto/prioridades.md');
    return { caminho: 'contexto/prioridades.md', conteudo: r ? r.conteudo.trim() : null };
  }

  /** Seção "Mapa de rotas" do AGENTS.md (ou CLAUDE.md). */
  rotas() {
    for (const arquivo of ['AGENTS.md', 'CLAUDE.md']) {
      const r = this.lerOpcional(arquivo);
      if (!r) continue;
      const secao = extrairSecao(r.conteudo, /^mapa de rotas/i);
      if (secao) return { arquivo, texto: secao };
      return { arquivo, texto: null };
    }
    throw new ErroCerebro('Nem AGENTS.md nem CLAUDE.md existem no cérebro.', 'SEM_MANUAL');
  }

  /**
   * Busca por termos em todos os .md. Pontuação: título > caminho/slug >
   * wikilinks > frontmatter > corpo. Devolve os `limite` melhores.
   */
  buscar(consulta, limite = 10) {
    const termos = normalizar(consulta).split(/\s+/).filter((t) => t.length >= 2);
    if (termos.length === 0) return [];
    const frase = normalizar(consulta).trim();
    const resultados = [];

    for (const caminho of this.listarMarkdown()) {
      let nota;
      try {
        nota = this.carregarNota(caminho);
      } catch {
        continue;
      }
      const tituloN = normalizar(nota.titulo);
      const caminhoN = normalizar(caminho);
      const linksN = normalizar(nota.wikilinks.join(' '));
      const metaN = normalizar(nota.frontmatter);
      const corpoN = normalizar(nota.corpo);

      let pontos = 0;
      let bateu = 0;
      for (const t of termos) {
        let acertou = false;
        if (tituloN.includes(t)) { pontos += 10; acertou = true; }
        if (caminhoN.includes(t)) { pontos += 6; acertou = true; }
        if (linksN.includes(t)) { pontos += 5; acertou = true; }
        if (metaN.includes(t)) { pontos += 3; acertou = true; }
        const ocorrencias = contarOcorrencias(corpoN, t);
        if (ocorrencias > 0) { pontos += Math.min(ocorrencias, 5); acertou = true; }
        if (acertou) bateu++;
      }
      if (bateu === 0) continue;
      if (bateu === termos.length) pontos += 3; // todos os termos presentes
      if (termos.length > 1 && (tituloN.includes(frase) || corpoN.includes(frase))) pontos += 4;
      // A consulta é exatamente o título ou o slug do arquivo: é a página que a pessoa quer.
      if (tituloN === frase) pontos += 15;
      if (slugificar(consulta) === normalizar(nota.slug)) pontos += 12;

      resultados.push({
        caminho,
        titulo: nota.titulo,
        tipo: nota.meta.tipo ?? null,
        atualizado: nota.meta.atualizado ?? null,
        pontuacao: pontos,
        trecho: montarTrecho(nota.corpo, termos),
      });
    }

    resultados.sort((a, b) => b.pontuacao - a.pontuacao || a.caminho.localeCompare(b.caminho));
    const n = Math.max(1, Math.min(Number(limite) || 10, 50));
    return resultados.slice(0, n);
  }

  wikiIndice() {
    const r = this.lerOpcional('wiki/index.md');
    return { caminho: 'wiki/index.md', conteudo: r ? r.conteudo.trim() : null };
  }

  /** Acha a página da wiki pelo slug (entidades, conceitos, fontes ou raiz da wiki). */
  wikiPagina(slug) {
    const alvo = normalizar(String(slug ?? '').trim().replace(/\.md$/i, ''));
    if (!alvo) throw new ErroCerebro('Informe o slug da página.', 'SLUG_VAZIO');
    const pastas = ['wiki/entidades', 'wiki/conceitos', 'wiki/fontes', 'wiki'];
    // 1) nome exato
    for (const p of pastas) {
      const c = `${p}/${alvo}.md`;
      if (this.existe(c)) return this.carregarNota(c);
    }
    // 2) nome sem acento/caixa, ou título igual
    for (const c of this.listarMarkdown()) {
      if (!c.startsWith('wiki/')) continue;
      if (normalizar(path.basename(c, '.md')) === alvo) return this.carregarNota(c);
    }
    for (const c of this.listarMarkdown()) {
      if (!c.startsWith('wiki/')) continue;
      const nota = this.carregarNota(c);
      if (normalizar(nota.titulo) === alvo) return nota;
    }
    throw new ErroCerebro(`Página "${slug}" não encontrada na wiki.`, 'NAO_ENCONTRADO');
  }

  /** projetos/<nome>/README.md com a linha de estado. */
  projetos() {
    const base = path.join(this.dir, 'projetos');
    if (!fs.existsSync(base)) return [];
    const saida = [];
    for (const e of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory()) continue;
      const caminho = `projetos/${e.name}/README.md`;
      if (!this.existe(caminho)) continue;
      const nota = this.carregarNota(caminho);
      const linhas = nota.corpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const linhaEstado = linhas.find((l) => /^\**estado\**\s*:/i.test(l))
        ?? linhas.find((l) => !l.startsWith('#')) ?? '';
      saida.push({
        nome: e.name,
        caminho,
        titulo: nota.titulo,
        estado: linhaEstado.replace(/^\**estado\**\s*:\s*/i, '').trim(),
        atualizado: nota.meta.atualizado ?? null,
      });
    }
    return saida;
  }

  /** Tabela de conexoes.md (primeira tabela do arquivo). */
  conexoes() {
    const r = this.lerOpcional('conexoes.md');
    if (!r) return { caminho: 'conexoes.md', tabela: null, linhas: [] };
    const [tabela] = extrairTabelas(r.conteudo);
    return { caminho: 'conexoes.md', tabela: tabela?.bruto ?? null, linhas: tabela?.linhas ?? [] };
  }

  /** Rotinas ativas e últimas execuções (mais recentes primeiro). */
  rotinas(limiteExecucoes = 10) {
    const r = this.lerOpcional('rotinas/registro.md');
    if (!r) return { caminho: 'rotinas/registro.md', ativas: [], execucoes: [], ativasBruto: null, execucoesBruto: null };
    const secAtivas = extrairSecao(r.conteudo, /^rotinas ativas/i) ?? '';
    const secExec = extrairSecao(r.conteudo, /^registro de execu/i) ?? '';
    const [tAtivas] = extrairTabelas(secAtivas);
    const [tExec] = extrairTabelas(secExec);
    const execucoes = (tExec?.linhas ?? []).slice(0, Math.max(1, limiteExecucoes));
    return {
      caminho: 'rotinas/registro.md',
      ativas: tAtivas?.linhas ?? [],
      execucoes,
      ativasBruto: tAtivas?.bruto ?? null,
      execucoesBruto: tExec ? [tExec.bruto.split('\n')[0], tExec.bruto.split('\n')[1], ...execucoes.map((l) => `| ${tExec.cabecalho.map((c) => l[c]).join(' | ')} |`)].join('\n') : null,
    };
  }

  // --- escrita (só com escrita: true) --------------------------------------

  #exigirEscrita() {
    if (!this.escrita) {
      throw new ErroCerebro(
        'Escrita desligada. Suba o servidor com --escrita (ou CEREBRO_ESCRITA=1) para gravar no cérebro.',
        'ESCRITA_DESLIGADA',
      );
    }
  }

  /** Acrescenta uma entrada datada em decisoes/registro.md. */
  registrarDecisao({ titulo, decisao, porque, alternativas, responsavel, data }) {
    this.#exigirEscrita();
    if (!titulo?.trim() || !decisao?.trim() || !porque?.trim()) {
      throw new ErroCerebro('Título, decisão e por quê são obrigatórios.', 'CAMPOS_OBRIGATORIOS');
    }
    const caminho = 'decisoes/registro.md';
    const abs = this.caminhoSeguro(caminho);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const hoje = data || dataLocal();
    const entrada = [
      `## ${hoje}: ${titulo.trim().replace(/\r?\n+/g, ' ')}`,
      '',
      `**Decisão:** ${decisao.trim()}`,
      '',
      `**Por quê:** ${porque.trim()}`,
      '',
      `**Alternativas consideradas:** ${alternativas?.trim() || 'não registradas.'}`,
      '',
      `**Responsável:** ${responsavel?.trim() || 'não informado.'}`,
      '',
    ].join('\n');
    const atual = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '# Registro de decisões\n';
    const separador = atual.endsWith('\n\n') ? '' : atual.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(abs, atual + separador + entrada, 'utf8');
    return { caminho, data: hoje, titulo: titulo.trim(), entrada };
  }

  /** Grava fontes/AAAA-MM-DD-<slug>.md sem sobrescrever (sufixo -2, -3...). */
  adicionarFonte({ nome, conteudo, data }) {
    this.#exigirEscrita();
    if (!nome?.trim()) throw new ErroCerebro('Informe o nome da fonte.', 'CAMPOS_OBRIGATORIOS');
    if (typeof conteudo !== 'string' || !conteudo.trim()) {
      throw new ErroCerebro('Informe o conteúdo da fonte.', 'CAMPOS_OBRIGATORIOS');
    }
    const hoje = data || dataLocal();
    const base = `${hoje}-${slugificar(nome)}`;
    fs.mkdirSync(path.join(this.dir, 'fontes'), { recursive: true });
    let caminho = `fontes/${base}.md`;
    let n = 2;
    while (fs.existsSync(this.caminhoSeguro(caminho))) caminho = `fontes/${base}-${n++}.md`;
    const corpo = /^\s*#/.test(conteudo) ? conteudo : `# ${nome.trim()}\n\n${conteudo}`;
    fs.writeFileSync(this.caminhoSeguro(caminho), corpo.endsWith('\n') ? corpo : corpo + '\n', { encoding: 'utf8', flag: 'wx' });
    return { caminho, data: hoje };
  }

  /** Acrescenta uma linha no topo da tabela "Registro de execuções". */
  registrarExecucao({ id, resultado, saida, observacao, dataHora }) {
    this.#exigirEscrita();
    if (!id?.trim() || !resultado?.trim()) throw new ErroCerebro('ID e resultado são obrigatórios.', 'CAMPOS_OBRIGATORIOS');
    const caminho = 'rotinas/registro.md';
    const abs = this.caminhoSeguro(caminho);
    if (!fs.existsSync(abs)) throw new ErroCerebro('rotinas/registro.md não existe no cérebro.', 'NAO_ENCONTRADO');

    const linhas = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    // Acha o título da seção e, dentro dela, a linha separadora da tabela.
    let iSecao = linhas.findIndex((l) => /^##\s+registro de execu/i.test(l));
    if (iSecao < 0) throw new ErroCerebro('Seção "Registro de execuções" não encontrada.', 'FORMATO');
    let iSep = -1;
    for (let i = iSecao + 1; i < linhas.length; i++) {
      if (/^#{1,2}\s/.test(linhas[i])) break;
      if (/^\s*\|?\s*:?-{2,}/.test(linhas[i]) && /^\s*\|/.test(linhas[i - 1] ?? '')) { iSep = i; break; }
    }
    if (iSep < 0) throw new ErroCerebro('Tabela de execuções não encontrada.', 'FORMATO');

    const quando = dataHora || dataHoraLocal();
    const nova = `| ${celula(quando)} | ${celula(id)} | ${celula(resultado)} | ${celula(saida || '—')} | ${celula(observacao || '—')} |`;
    linhas.splice(iSep + 1, 0, nova);
    fs.writeFileSync(abs, linhas.join('\n'), 'utf8');

    const ativas = this.rotinas().ativas.map((r) => r.ID ?? r.id);
    const aviso = ativas.includes(id.trim()) ? null : `A rotina "${id}" não está na tabela "Rotinas ativas".`;
    return { caminho, linha: nova, dataHora: quando, aviso };
  }
}

// ---------------------------------------------------------------------------
// Auxiliares da busca
// ---------------------------------------------------------------------------

function contarOcorrencias(texto, termo) {
  let n = 0;
  let i = texto.indexOf(termo);
  while (i !== -1 && n < 50) {
    n++;
    i = texto.indexOf(termo, i + termo.length);
  }
  return n;
}

/** Primeira linha do corpo que contém um termo, cortada em ~220 caracteres. */
function montarTrecho(corpo, termos) {
  const linhas = corpo.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const linha = linhas.find((l) => termos.some((t) => normalizar(l).includes(t))) ?? linhas[0] ?? '';
  if (linha.length <= 220) return linha;
  const pos = Math.max(0, ...termos.map((t) => normalizar(linha).indexOf(t)).filter((p) => p >= 0));
  const ini = Math.max(0, pos - 80);
  return (ini > 0 ? '…' : '') + linha.slice(ini, ini + 220).trim() + '…';
}

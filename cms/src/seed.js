// Conteúdo inicial: páginas montadas com os textos já criados para o Comunica Secret.
const { cleanBlocks } = require('./blocks');

const WA = 'https://wa.me/5541984165836';
const B = (type, data) => ({ type, data });
const help = (title, text, note) => B('help', { title, text, button_label: 'Falar com o RH', url: '', note: note || '' });

const PAGES = [
  {
    slug: 'inicio', title: 'Início', order: 0, menu: 1,
    meta: 'Comunica Secret — o portal de Gente & Gestão da Secret Outlet.',
    blocks: [
      B('hero', { title: 'Olá, time Secret!', text: 'Informação, desenvolvimento e tudo o que faz parte da nossa jornada.', size: 'grande', button1_label: 'Conheça o portal', button1_url: '/onboarding', button2_label: 'Acessar benefícios', button2_url: '/beneficios' }),
      B('quick_links', { title: 'Acesso rápido', style: 'cards', items: [
        { icon: 'pessoa', label: 'Onboarding', url: '/onboarding' },
        { icon: 'formatura', label: 'Treinamentos', url: '/treinamentos' },
        { icon: 'coracao', label: 'Benefícios', url: '/beneficios' },
        { icon: 'calendario', label: 'Calendário 2026', url: '/calendario' },
        { icon: 'escudo', label: 'NR1', url: '/nr1' },
        { icon: 'documento', label: 'Políticas', url: '/politicas' }
      ] }),
      B('featured', { title: 'Em destaque', background: 'suave', main_tag: 'CAMPANHA INTERNA', main_title: 'BLACK', main_highlight: 'FRIDAY', main_after: '2026', main_subtitle: 'Dicas e preparativos', main_text: 'Tudo o que você precisa saber para fazer da Black Friday 2026 a nossa maior de todos os tempos.', main_button_label: 'Saiba mais', main_url: '/comunicados/black-friday-2026-dicas-e-preparativos', items: [
        { tag: 'PRÓXIMOS TREINAMENTOS', title: 'Invista no seu desenvolvimento', text: 'Confira os treinamentos disponíveis e desenvolva novas habilidades.', link_label: 'Ver agenda', url: '/treinamentos' },
        { tag: 'NR1', title: 'Cuidado que faz parte da nossa cultura', text: 'Saúde mental e segurança psicológica no centro das nossas relações.', link_label: 'Saiba mais', url: '/nr1' }
      ] }),
      B('events', { title: 'Acontece na Secret', items: [
        { icon: 'calendario', date: '15 a 30 de junho', title: 'Avaliação de Desempenho', text: 'Participe do ciclo e converse com seu líder sobre seu desenvolvimento.', link_label: 'Saiba mais', url: '/comunicados/avaliacao-de-desempenho' },
        { icon: 'megafone', date: '20 de junho', title: 'Reunião de Liderança', text: 'Alinhamentos estratégicos para seguirmos crescendo juntos.', link_label: 'Ver detalhes', url: '/comunicados/reuniao-de-lideranca' },
        { icon: 'bolo', date: 'Aniversários do mês', title: 'Parabéns para você!', text: 'Celebramos você e todas as histórias que constroem a Secret.', link_label: 'Ver aniversariantes', url: '/comunicados/aniversariantes-do-mes' }
      ] }),
      B('latest_articles', { title: 'Últimos comunicados', background: 'suave', count: '3', show_all: true }),
      help('Precisa de ajuda?', 'O time de Gente & Gestão está com você em cada etapa.')
    ]
  },
  {
    slug: 'onboarding', title: 'Onboarding', menu_label: 'Sua jornada', order: 10, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'BEM-VINDO • INTEGRAÇÃO • PERTENCIMENTO', title: 'Boas-vindas à Secret Outlet!', text: 'Preparamos este espaço para ajudar você a conhecer a empresa, organizar seus primeiros passos e encontrar rapidamente os materiais essenciais.', button1_label: 'Comece por aqui', button1_url: '#secao-2' }),
      B('steps', { title: 'Seus primeiros passos', items: [
        { icon: 'predio', title: 'Conheça a Secret', text: 'Nossa história, cultura e marcas.' },
        { icon: 'cadeado', title: 'Prepare seus acessos', text: 'Ferramentas e canais essenciais.' },
        { icon: 'formatura', title: 'Complete os treinamentos', text: 'Conteúdos para sua integração.' },
        { icon: 'grupo', title: 'Conecte-se com o time', text: 'Pessoas que vão apoiar sua jornada.' }
      ] }),
      B('cards', { title: 'Sua jornada, etapa por etapa', background: 'suave', columns: '2', layout: 'lateral', items: [
        { icon: 'documento', title: 'Antes do primeiro dia', lines: ['Documentos admissionais', 'Dados bancários e cadastro', 'Orientações de chegada'] },
        { icon: 'estrela', title: 'Primeiro dia', lines: ['Nossa história, propósito e valores', 'Quem é quem', 'Canais de comunicação', 'Acessos e ferramentas'] },
        { icon: 'calendario-check', title: 'Primeira semana', lines: ['Integrações obrigatórias', 'Agenda com a liderança', 'Treinamentos iniciais'], button_label: 'Ver treinamentos', url: '/treinamentos' },
        { icon: 'tendencia', title: 'Primeiros 30/60/90 dias', lines: ['Expectativas', 'Check-ins com a liderança', 'Pesquisa de experiência'] }
      ] }),
      B('notice', { style: 'info', text: 'Documentos pessoais e informações confidenciais são tratados diretamente com Gente & Gestão — nunca os envie por canais abertos.' }),
      help('Precisa de ajuda?', 'O time de Gente & Gestão está com você em cada etapa.')
    ]
  },
  {
    slug: 'desenvolvimento', title: 'Desenvolvimento', order: 20, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'APRENDER • EVOLUIR • COMPARTILHAR', title: 'Desenvolvimento', text: 'Conhecimento para transformar desafios em novas oportunidades.', button1_label: 'Explore os conteúdos', button1_url: '#secao-2' }),
      B('intro', { title: 'Escolha por onde começar', text: 'Encontre treinamentos, ferramentas e orientações para desenvolver novas habilidades e tornar sua rotina mais simples.' }),
      B('cards', { columns: '3', layout: 'centro', items: [
        { icon: 'formatura', tag: 'APRENDIZADO', title: 'Treinamentos', text: 'Conteúdos para fortalecer suas habilidades e apoiar seu crescimento.', button_label: 'Ver treinamentos', url: '/treinamentos' },
        { icon: 'notebook', tag: 'PRODUTIVIDADE', title: 'Google Workspace', text: 'Guias práticos para usar melhor as ferramentas do nosso dia a dia.', button_label: 'Acessar guias', url: '/treinamentos' },
        { icon: 'escudo', tag: 'SAÚDE E SEGURANÇA', title: 'NR1 — Saiba mais', text: 'Informação, prevenção e cuidado para um ambiente de trabalho saudável.', button_label: 'Conhecer a NR1', url: '/nr1' }
      ] }),
      B('banner', { theme: 'escuro', icon: 'lampada', eyebrow: 'CONTEÚDO RECOMENDADO', title: 'Aprender faz parte da nossa jornada', text: 'Reserve um tempo para conhecer os conteúdos disponíveis e coloque novos aprendizados em prática.', button_label: 'Começar agora', url: '/treinamentos' }),
      B('cards', { title: 'Desenvolvimento no dia a dia', background: 'suave', columns: '3', layout: 'centro', items: [
        { icon: 'relogio', title: 'Aprenda no seu ritmo', text: 'Acesse os conteúdos quando precisar.' },
        { icon: 'grupo', title: 'Compartilhe conhecimento', text: 'Troque experiências com seu time.' },
        { icon: 'check', title: 'Coloque em prática', text: 'Transforme aprendizado em resultado.' }
      ] }),
      help('Não encontrou o que procura?', 'Fale com Gente & Gestão e ajude a construir os próximos conteúdos.')
    ]
  },
  {
    slug: 'treinamentos', title: 'Treinamentos', parent: 'desenvolvimento', order: 1, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'APRENDER • PRATICAR • EVOLUIR', title: 'Treinamentos', text: 'Conteúdos para desenvolver habilidades e transformar conhecimento em resultado.', button1_label: 'Ver treinamentos', button1_url: '#secao-3' }),
      B('intro', { title: 'Aprendizado para o seu dia a dia', text: 'Encontre conteúdos para sua integração, desenvolvimento e uso das ferramentas que fazem parte da nossa rotina.' }),
      B('cards', { title: 'Comece pelos essenciais', background: 'suave', columns: '3', layout: 'lateral', items: [
        { icon: 'estrela', tag: 'TRILHA RECOMENDADA', title: 'Integração Secret', text: 'Conheça nossa cultura, marcas, processos e formas de trabalhar. Novos colaboradores • Trilha completa.', button_label: 'Começar trilha', url: '/onboarding', button_style: 'botao' },
        { icon: 'escudo', title: 'Segurança e NR1', text: 'Prevenção, cuidado e ambiente de trabalho saudável.', button_label: 'Acessar conteúdo', url: '/nr1' },
        { icon: 'documento', title: 'Políticas de Gente & Gestão', text: 'Diretrizes essenciais para a nossa jornada.', button_label: 'Conhecer políticas', url: '/politicas' }
      ] }),
      B('cards', { title: 'Explore por tema', columns: '4', layout: 'centro', items: [
        { icon: 'predio', title: 'Cultura e integração', text: 'Para conhecer melhor a Secret.' },
        { icon: 'notebook', title: 'Ferramentas e produtividade', text: 'Recursos para facilitar sua rotina.' },
        { icon: 'grupo', title: 'Liderança e pessoas', text: 'Conteúdos para desenvolver equipes.' },
        { icon: 'escudo-coracao', title: 'Saúde e segurança', text: 'Informação para prevenir e cuidar.' }
      ] }),
      B('banner', { theme: 'escuro', icon: 'notebook', eyebrow: 'FERRAMENTAS DO DIA A DIA', title: 'Trabalhe melhor com o Google Workspace', text: 'Aprenda a usar Gmail, Drive, Agenda, Meet e outras ferramentas de forma simples e prática.', button_label: 'Acessar tutoriais', url: 'https://support.google.com/a/users', note: 'Conteúdos rápidos para consultar sempre que precisar.' }),
      B('cards', { title: 'Continue aprendendo', background: 'suave', columns: '3', layout: 'centro', items: [
        { icon: 'balao', tag: '25 min', title: 'Comunicação e colaboração', text: 'Fortaleça a troca de informações no time.', button_label: 'Ver conteúdo', url: '#' },
        { icon: 'calendario-check', tag: '20 min', title: 'Organização e produtividade', text: 'Planeje melhor suas atividades.', button_label: 'Ver conteúdo', url: '#' },
        { icon: 'tendencia', tag: '30 min', title: 'Desenvolvimento de liderança', text: 'Apoie pessoas e fortaleça resultados.', button_label: 'Ver conteúdo', url: '#' }
      ] }),
      B('help', { title: 'Sentiu falta de algum treinamento?', text: 'Compartilhe sua sugestão com o time de Gente & Gestão.', button_label: 'Enviar sugestão', url: '' })
    ]
  },
  {
    slug: 'nr1', title: 'NR1 — Saiba mais', menu_label: 'NR1 — Saiba mais', parent: 'desenvolvimento', order: 2, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'SAÚDE • SEGURANÇA • BEM-ESTAR', title: 'NR1: cuidado que faz parte da nossa cultura', text: 'Informação, prevenção e diálogo para construir um ambiente de trabalho mais saudável.', button1_label: 'Entenda a NR1', button1_url: '#secao-2' }),
      B('intro', { title: 'O que é a NR1?', text: 'A Norma Regulamentadora nº 1 estabelece disposições gerais e orienta o gerenciamento de riscos ocupacionais. Entre eles, estão os fatores de risco psicossociais relacionados ao trabalho.', highlight_icon: 'escudo-coracao', highlight_text: 'Prevenir começa por identificar, ouvir e agir.' }),
      B('steps', { title: 'Como esse cuidado acontece', background: 'suave', items: [
        { icon: 'lupa', title: 'Identificar', text: 'Reconhecer fatores relacionados à organização e às condições de trabalho.' },
        { icon: 'grupo', title: 'Avaliar', text: 'Analisar os riscos com responsabilidade e participação das pessoas.' },
        { icon: 'escudo', title: 'Prevenir', text: 'Planejar ações, acompanhar resultados e melhorar continuamente.' }
      ] }),
      B('cards', { title: 'Nossas iniciativas', columns: '3', layout: 'centro', items: [
        { icon: 'casa-coracao', title: 'Ambientes mais seguros', text: 'Organização e conforto para um dia a dia melhor.' },
        { icon: 'balao', title: 'Escuta ativa', text: 'Ouvir para entender e apoiar melhor.' },
        { icon: 'pessoa', title: 'Desenvolvimento de líderes', text: 'Lideranças preparadas para cuidar de pessoas.' },
        { icon: 'grafico', title: 'Acompanhamento de indicadores', text: 'Dados para decisões mais assertivas e preventivas.' },
        { icon: 'engrenagem', title: 'Tecnologia e melhoria de processos', text: 'Menos burocracia, mais tempo para o que importa.' },
        { icon: 'megafone', title: 'Comunicação e conscientização', text: 'Informação clara para escolhas conscientes.' }
      ] }),
      B('banner', { theme: 'claro', icon: 'grupo', title: 'Cuidar das pessoas é uma responsabilidade compartilhada', text: 'Lideranças, equipes, Gente & Gestão e Segurança do Trabalho participam da construção de um ambiente respeitoso, seguro e saudável.' }),
      B('cards', { title: 'Precisa conversar?', columns: '2', layout: 'lateral', items: [
        { icon: 'fone', title: 'Fale com Gente & Gestão', text: 'Para dúvidas, orientações e acolhimento.', button_label: 'Entrar em contato', url: 'mailto:rh@secretoutlet.com.br', button_style: 'botao' },
        { icon: 'documento', title: 'Consulte os materiais oficiais', text: 'Acesse informações e referências sobre a NR1.', button_label: 'Ver materiais', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1', button_style: 'botao' }
      ] }),
      B('notice', { style: 'alerta', text: 'Em situações de urgência, procure imediatamente os serviços de emergência da sua região.' })
    ]
  },
  {
    slug: 'beneficios', title: 'Benefícios', order: 30, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'CUIDADO • RECONHECIMENTO • BEM-ESTAR', title: 'Benefícios', text: 'Vantagens pensadas para apoiar você dentro e fora do trabalho.', button1_label: 'Conheça seus benefícios', button1_url: '#secao-3' }),
      B('intro', { title: 'Cuidar de quem faz a Secret acontecer', text: 'Conheça os benefícios disponíveis e encontre as informações necessárias para aproveitar cada um deles.' }),
      B('cards', { title: 'Seus benefícios', background: 'suave', columns: '2', layout: 'lateral', items: [
        { icon: 'saude', title: 'Saúde e bem-estar', lines: ['TotalPass', 'Plano de saúde', 'Plano odontológico', 'Vale-farmácia'], button_label: 'Ver detalhes', url: WA },
        { icon: 'carteira', title: 'Financeiro e reconhecimento', lines: ['Folha de pagamento', 'PLR', 'Programa de aceleração salarial', 'Campanhas de produtividade'], button_label: 'Ver detalhes', url: WA },
        { icon: 'calendario-check', title: 'Ausências e descanso', lines: ['Férias', 'Licença-maternidade', 'Licença médica', 'Feriados'], button_label: 'Ver orientações', url: WA },
        { icon: 'presente', title: 'Campanhas especiais', lines: ['Indique um amigo', 'Campanhas e ações internas'], button_label: 'Conhecer campanhas', url: '/comunicados' }
      ] }),
      B('cards', { title: 'Benefícios em destaque', columns: '3', layout: 'centro', items: [
        { icon: 'tenis', tag: 'SAÚDE E BEM-ESTAR', title: 'TotalPass', text: 'Acesse academias e atividades para cuidar da sua rotina.', button_label: 'Saiba como utilizar', url: WA, button_style: 'botao' },
        { icon: 'dupla', tag: 'RECONHECIMENTO', title: 'Indique um amigo', text: 'Indique talentos e acompanhe as regras da campanha vigente.', button_label: 'Ver regulamento', url: WA, button_style: 'botao' },
        { icon: 'escudo-cruz', tag: 'CUIDADO', title: 'Plano de saúde', text: 'Consulte elegibilidade, cobertura e orientações de uso.', button_label: 'Consultar informações', url: WA, button_style: 'botao' }
      ] }),
      B('steps', { title: 'Como consultar um benefício', background: 'suave', items: [
        { icon: 'documento', title: 'Confira as regras', text: 'Consulte elegibilidade, prazos e condições.' },
        { icon: 'check', title: 'Faça sua solicitação', text: 'Siga o processo indicado para cada benefício.' },
        { icon: 'baloes', title: 'Tire suas dúvidas', text: 'Fale com Gente & Gestão sempre que precisar.' }
      ] }),
      B('faq', { title: 'Dúvidas frequentes', items: [
        { question: 'Quem tem direito aos benefícios?', answer: 'A elegibilidade pode variar conforme a empresa, o cargo, a localidade, o vínculo e as regras de cada benefício. Consulte Gente & Gestão para confirmar sua situação.' },
        { question: 'Como solicitar inclusão ou alteração?', answer: 'Consulte as orientações específicas do benefício desejado. Quando necessário, envie os documentos solicitados dentro do prazo informado.' },
        { question: 'Onde encontro os regulamentos?', answer: 'Os regulamentos e materiais de apoio devem estar disponíveis nos links de cada benefício. Em caso de dúvida, solicite a versão vigente ao time de Gente & Gestão.' },
        { question: 'Com quem falo em caso de dúvida?', answer: 'Entre em contato com Gente & Gestão para receber orientações sobre acesso, elegibilidade, prazos ou utilização.' }
      ] }),
      help('Precisa de ajuda com algum benefício?', 'O time de Gente & Gestão pode orientar você.'),
      B('notice', { style: 'info', text: 'Os benefícios podem variar conforme empresa, cargo, localidade, elegibilidade e regras vigentes. Consulte Gente & Gestão.' })
    ]
  },
  {
    slug: 'calendario', title: 'Calendário', order: 40, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'PLANEJAR • ACOMPANHAR • PARTICIPAR', title: 'Calendário', text: 'Datas importantes, eventos e ações para você se organizar ao longo do ano.', button1_label: 'Ver calendário 2026', button1_url: '#secao-4' }),
      B('intro', { title: 'Tudo o que acontece na Secret', text: 'Acompanhe as principais datas, treinamentos, campanhas e momentos que fazem parte da nossa jornada.' }),
      B('events', { title: 'Próximos acontecimentos', background: 'suave', items: [
        { icon: 'grafico', date: '15 JUN', title: 'Avaliação de desempenho', text: 'Ciclo de acompanhamento' },
        { icon: 'megafone', date: '20 JUN', title: 'Reunião de liderança', text: 'Alinhamento estratégico' },
        { icon: 'formatura', date: '25 JUN', title: 'Treinamento interno', text: 'Desenvolvimento' },
        { icon: 'carteira', date: '30 JUN', title: 'Fechamento do mês', text: 'Rotinas administrativas' }
      ] }),
      B('embed', { title: 'Calendário 2026', url: '', height: '600', note: 'O calendário pode receber atualizações ao longo do ano. Para exibi-lo aqui, cole o endereço de incorporação do Google Agenda neste bloco.' }),
      B('cards', { title: 'Datas que merecem destaque', background: 'suave', columns: '3', layout: 'centro', items: [
        { icon: 'etiqueta', tag: 'CAMPANHA INTERNA', title: 'Black Friday 2026', text: 'Preparação, treinamentos e informações para a maior data do varejo.', button_label: 'Ver campanha', url: '/comunicados/black-friday-2026-dicas-e-preparativos', button_style: 'botao' },
        { icon: 'bolo', title: 'Aniversários do mês', text: 'Celebre com quem faz parte da nossa história.', button_label: 'Ver aniversariantes', url: '/comunicados/aniversariantes-do-mes' },
        { icon: 'aviao', title: 'Feriados e recessos', text: 'Consulte as orientações e organize-se.', button_label: 'Ver datas', url: '#secao-4' }
      ] }),
      B('cards', { title: 'Para não perder nenhuma data', columns: '3', layout: 'centro', items: [
        { icon: 'calendario', title: 'Acompanhe o calendário', text: 'Consulte esta página regularmente.' },
        { icon: 'sino', title: 'Fique de olho nos comunicados', text: 'Confira os canais oficiais da Secret.' },
        { icon: 'dupla', title: 'Converse com sua liderança', text: 'Alinhe dúvidas sobre escalas e compromissos.' }
      ] }),
      help('Tem alguma dúvida sobre uma data?', 'Fale com o time de Gente & Gestão.')
    ]
  },
  {
    slug: 'gente-e-gestao', title: 'Gente & Gestão', order: 50, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'PESSOAS • CULTURA • CUIDADO', title: 'Gente & Gestão', text: 'Informação, orientação e apoio para cada etapa da sua jornada.', button1_label: 'Encontre o que precisa', button1_url: '#secao-3' }),
      B('intro', { title: 'Estamos aqui para apoiar você', text: 'Este é o espaço para acessar benefícios, conhecer nossas políticas e encontrar orientações para o seu dia a dia na Secret.' }),
      B('cards', { title: 'Acesse os principais conteúdos', background: 'suave', columns: '2', layout: 'lateral', items: [
        { icon: 'coracao', title: 'Benefícios', text: 'Conheça as vantagens disponíveis e encontre orientações para utilizar cada benefício.', button_label: 'Ver benefícios', url: '/beneficios', button_style: 'botao' },
        { icon: 'documento', title: 'Políticas', text: 'Consulte as diretrizes que orientam nossas relações, decisões e formas de trabalhar.', button_label: 'Consultar políticas', url: '/politicas', button_style: 'botao' }
      ] }),
      B('cards', { title: 'Como Gente & Gestão pode ajudar', columns: '4', layout: 'centro', items: [
        { icon: 'dupla', title: 'Benefícios e elegibilidade', text: 'Orientações sobre acesso, regras e utilização.' },
        { icon: 'documento', title: 'Documentos e políticas', text: 'Apoio para consultar diretrizes e processos.' },
        { icon: 'tendencia', title: 'Jornada do colaborador', text: 'Informações sobre integração e desenvolvimento.' },
        { icon: 'baloes', title: 'Dúvidas e acolhimento', text: 'Um canal para ouvir, orientar e encaminhar.' }
      ] }),
      B('quick_links', { title: 'Encontre rapidamente', style: 'pills', background: 'suave', items: [
        { icon: 'escudo-cruz', label: 'Plano de saúde', url: '/beneficios' },
        { icon: 'tenis', label: 'TotalPass', url: '/beneficios' },
        { icon: 'aviao', label: 'Férias e licenças', url: '/beneficios' },
        { icon: 'documento', label: 'Política de Gente & Gestão', url: '/politicas' },
        { icon: 'escudo', label: 'Canal de ética', url: '#' },
        { icon: 'whatsapp', label: 'Falar com o RH', url: WA }
      ] }),
      B('banner', { theme: 'escuro', icon: 'coracao', title: 'Cuidar das pessoas faz parte da nossa cultura', text: 'Construímos relações com respeito, clareza e responsabilidade, valorizando quem faz a Secret acontecer todos os dias.' }),
      help('Como podemos ajudar?', 'Converse com o time de Gente & Gestão.', 'Atendimento pelo WhatsApp.')
    ]
  },
  {
    slug: 'politicas', title: 'Política de Gente & Gestão', menu_label: 'Políticas', parent: 'gente-e-gestao', order: 1, menu: 1,
    blocks: [
      B('hero', { eyebrow: 'CLAREZA • RESPEITO • RESPONSABILIDADE', title: 'Política de Gente & Gestão', text: 'Diretrizes para orientar nossas relações, decisões e formas de trabalhar.', button1_label: 'Consultar política', button1_url: '#secao-5' }),
      B('intro', { title: 'Um guia para a nossa jornada', text: 'Esta política reúne os princípios e as orientações que apoiam uma relação transparente, respeitosa e coerente entre a Secret e suas pessoas.' }),
      B('info_table', { title: 'Informações do documento', background: 'suave', items: [
        { label: 'Documento', value: 'Política de Gente & Gestão' },
        { label: 'Versão', value: 'Consulte o documento vigente' },
        { label: 'Responsável', value: 'Gente & Gestão' },
        { label: 'Aplicação', value: 'Colaboradores Secret Group' }
      ] }),
      B('cards', { title: 'O que você encontra nesta política', columns: '3', layout: 'lateral', items: [
        { icon: 'grupo', title: 'Cultura e convivência', text: 'Valores, conduta e relações no dia a dia.' },
        { icon: 'check', title: 'Direitos e responsabilidades', text: 'Orientações para uma relação clara e equilibrada.' },
        { icon: 'relogio', title: 'Jornada e registro de ponto', text: 'Regras relacionadas à rotina de trabalho.' },
        { icon: 'escudo', title: 'Ética e integridade', text: 'Conflitos de interesse, denúncias e uso responsável da imagem.' },
        { icon: 'tendencia', title: 'Carreira e desenvolvimento', text: 'Remuneração, cargos, feedback e avaliação.' },
        { icon: 'escudo-coracao', title: 'Saúde, segurança e bem-estar', text: 'Diretrizes para um ambiente seguro e saudável.' }
      ] }),
      B('banner', { theme: 'escuro', icon: 'documento', eyebrow: 'DOCUMENTO OFICIAL', title: 'Política de Gente & Gestão', text: 'Leia o conteúdo completo e consulte sempre a versão vigente antes de tomar uma decisão.', button_label: 'Abrir em tela cheia', url: '#', button2_label: 'Baixar documento', button2_url: '#', note: 'Envie o PDF oficial em Mídia (ou use o link do Google Drive) e coloque o endereço nos botões.' }),
      B('steps', { title: 'Antes de continuar', background: 'suave', items: [
        { icon: 'livro', title: 'Leia com atenção', text: 'Conheça as orientações aplicáveis à sua rotina.' },
        { icon: 'documento', title: 'Consulte a versão vigente', text: 'Políticas podem receber atualizações.' },
        { icon: 'baloes', title: 'Converse em caso de dúvida', text: 'Gente & Gestão está disponível para orientar.' }
      ] }),
      help('Ficou com alguma dúvida?', 'Fale com Gente & Gestão antes de tomar uma decisão ou iniciar uma solicitação.'),
      B('notice', { style: 'info', text: 'Esta página é um resumo de apoio e não substitui o documento oficial vigente.' })
    ]
  }
];

const ARTICLES = [
  { slug: 'black-friday-2026-dicas-e-preparativos', title: 'Black Friday 2026: dicas e preparativos', category: 'Campanhas', featured: 1, days: 0,
    excerpt: 'Tudo o que você precisa saber para fazer da Black Friday 2026 a nossa maior de todos os tempos.',
    content: '<p>A Black Friday é a maior data do varejo — e a preparação começa agora. Reunimos aqui o que cada time precisa saber.</p><h2>Cronograma</h2><ul><li>Treinamentos de preparação</li><li>Ajustes de escala com a liderança</li><li>Semana da campanha</li></ul><h2>Papéis e responsabilidades</h2><p>Converse com sua liderança para entender sua participação na campanha.</p><blockquote>Exemplo de comunicado — substitua pelo cronograma oficial da Black Friday 2026.</blockquote>' },
  { slug: 'avaliacao-de-desempenho', title: 'Avaliação de Desempenho', category: 'Desenvolvimento', days: 2,
    excerpt: 'Participe do ciclo e converse com seu líder sobre seu desenvolvimento.',
    content: '<p>O ciclo de Avaliação de Desempenho é o momento de olhar para o caminho percorrido e combinar os próximos passos com a sua liderança.</p><h2>Como participar</h2><ol><li>Faça sua autoavaliação</li><li>Converse com sua liderança</li><li>Defina seus objetivos para o próximo ciclo</li></ol><blockquote>Exemplo de comunicado — ajuste as datas e o processo reais.</blockquote>' },
  { slug: 'reuniao-de-lideranca', title: 'Reunião de Liderança', category: 'Comunicados', days: 4,
    excerpt: 'Alinhamentos estratégicos para seguirmos crescendo juntos.',
    content: '<p>A reunião de liderança reúne gestores de todas as áreas para alinhar prioridades e próximos passos.</p><blockquote>Exemplo de comunicado — substitua pelas informações reais.</blockquote>' },
  { slug: 'aniversariantes-do-mes', title: 'Aniversariantes do mês', category: 'Celebrações', days: 6,
    excerpt: 'Celebramos você e todas as histórias que constroem a Secret.',
    content: '<p>Parabéns a todas as pessoas que fazem aniversário neste mês! 🎉</p><p>Atualize esta lista mensalmente com os nomes autorizados para divulgação.</p>' }
];

async function seedIfEmpty() {
  const { db, saveSettings } = require('./db');
  const created = await db.tx(async (c) => {
    await c.run('SELECT pg_advisory_xact_lock(4242)'); // evita duas instâncias criando ao mesmo tempo
    if ((await c.get('SELECT COUNT(*) n FROM pages')).n > 0) return null;
    const ids = {};
    for (const p of PAGES) {
      const r = await c.get("INSERT INTO pages (title, slug, parent_id, menu_order, show_in_menu, menu_label, status, meta_description, blocks) VALUES (?,?,?,?,?,?,'published',?,?) RETURNING id",
        [p.title, p.slug, p.parent ? ids[p.parent] : null, p.order, !!p.menu, p.menu_label || null, p.meta || '', JSON.stringify(cleanBlocks(p.blocks))]);
      ids[p.slug] = r.id;
    }
    for (const a of ARTICLES) {
      await c.run("INSERT INTO articles (title, slug, category, excerpt, content, status, featured, published_at) VALUES (?,?,?,?,?,'published',?, now() - make_interval(days => ?::int))",
        [a.title, a.slug, a.category, a.excerpt, a.content, !!a.featured, a.days]);
    }
    return ids;
  });
  if (created) {
    await saveSettings({ home_page_id: created.inicio });
    console.log('  Conteúdo inicial criado (9 páginas e 4 comunicados de exemplo).');
  }
}

module.exports = { seedIfEmpty };

import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Store, Save, Check, Palette, Type as TypeIcon, Copy, ExternalLink, Share2, Clock, Plus, Trash2, MapPin, ArrowRight, Shield, Monitor, Sun, Moon, Bike, LocateFixed, Scale, Utensils, Pizza, ChefHat, ShoppingBag, Sliders, Layers, Smartphone, Calculator, Tv } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PALETA_CORES, PALETA_FUNDO_POR_TEMA, isLightColor, fonteFamilia, obterFundoLojaPorTema, obterTokensLoja, resolverTemaLoja, type TemaLoja } from '../../lib/personalizacao';
import ColorSwatchPicker from '../../components/ColorSwatchPicker';
import FontPicker from '../../components/FontPicker';
import ImageUpload from '../../components/ImageUpload';
import { getOptimizedImageUrl } from '../../lib/cdn';
import { FiscalOnboarding } from '../../components/admin/FiscalOnboarding';
import { IfoodOnboarding } from '../../components/admin/IfoodOnboarding';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import type { EntregaModo, FaixaEntrega, HorarioFuncionamento, SegmentoNegocio, ModulosAtivos } from '../../types';
import { fmt } from '../../types';
import { maskCPFouCNPJ, maskTelefone, validarCPFouCNPJ } from '../../lib/mascaras';
import { EFI_TARIFAS, EFI_LINKS } from '../../lib/efiInfo';
import { geocode } from '../../lib/geo';
import { useI18n } from '../../contexts/I18nContext';
import { useToast } from '../../components/ui/Toast';

const PRESETS_SEGMENTOS: Record<SegmentoNegocio, { rotulo: string; descricao: string; modulos: ModulosAtivos }> = {
  HAMBURGUERIA: {
    rotulo: 'Hamburgueria & Fast Food',
    descricao: 'Combos, adicionais, KDS cozinha, balcão e delivery.',
    modulos: { balanca: false, mesas_3d: true, garcom_pwa: true, pizzas: false, kds: true, entregas: true, ifood: true, fiscal: true },
  },
  PIZZARIA: {
    rotulo: 'Pizzaria',
    descricao: 'Pizzas meio-a-meio, tamanhos, bordas e entregas.',
    modulos: { balanca: false, mesas_3d: true, garcom_pwa: true, pizzas: true, kds: true, entregas: true, ifood: true, fiscal: true },
  },
  RESTAURANTE_A_LA_CARTE: {
    rotulo: 'Restaurante À la Carte',
    descricao: 'Salão 3D, mesas, comandas, PWA garçom e cozinha.',
    modulos: { balanca: false, mesas_3d: true, garcom_pwa: true, pizzas: false, kds: true, entregas: true, ifood: true, fiscal: true },
  },
  RESTAURANTE_POR_QUILO: {
    rotulo: 'Restaurante por Quilo / Buffet',
    descricao: 'Balança Web Serial, pesagem digital, cartão individual e reposição de cubas.',
    modulos: { balanca: true, mesas_3d: true, garcom_pwa: true, pizzas: false, kds: true, entregas: true, ifood: true, fiscal: true },
  },
  DARK_KITCHEN: {
    rotulo: 'Dark Kitchen / Delivery Apenas',
    descricao: 'Operação focada 100% em entrega, iFood, WhatsApp IA e rotas no mapa.',
    modulos: { balanca: false, mesas_3d: false, garcom_pwa: false, pizzas: true, kds: true, entregas: true, ifood: true, fiscal: true },
  },
  BAR_PUB: {
    rotulo: 'Bar & Pub',
    descricao: 'Comandas por cartão, subcomandas por assento e salão.',
    modulos: { balanca: false, mesas_3d: true, garcom_pwa: true, pizzas: false, kds: true, entregas: false, ifood: false, fiscal: true },
  },
  GERAL: {
    rotulo: 'Híbrido / Multissegmento (Completo)',
    descricao: 'Todos os módulos operacionais ativados.',
    modulos: { balanca: true, mesas_3d: true, garcom_pwa: true, pizzas: true, kds: true, entregas: true, ifood: true, fiscal: true },
  },
};

interface FormLoja {
  /** Tipos de pedido chamados no painel de senhas da TV. */
  painel_tv_tipos: string[];
  nome: string;
  descricao: string;
  logo_url: string;
  banner_url: string;
  banner_pos_y: number;
  cor_primaria: string;
  cor_secundaria: string;
  fonte: string;
  cor_texto: string;
  cor_fundo_claro: string;
  cor_fundo_escuro: string;
  tema_cardapio: TemaLoja;
  whatsapp: string;
  telefone: string;
  endereco: string;
  cnpj: string;
  razao_social: string;
  pedido_minimo: string;
  pix_chave: string;
  efi_payee_code: string;
  efi_titular_documento: string;
  efi_conta: string;
  antecipacao_cartao: boolean;
  aceita_online: boolean;
  aceita_entrega: boolean;
  aceita_agendamento: boolean;
  agendamento_antecedencia_min: string;
  lat: string;
  lng: string;
  entrega_modo: EntregaModo;
  entrega_raio_km: string;
  entrega_taxa_base: string;
  entrega_taxa_km: string;
  entrega_taxa_padrao: string;
  frete_gratis_valor_minimo: string;
  nfe_ambiente: 'homologacao' | 'producao';
  nfe_habilitado: boolean;
  nfe_regime_tributario: string;
  nfe_inscricao_estadual: string;
  nfe_id_csc: string;
  nfe_csc: string;
  ifood_merchant_id: string;
  ifood_addon_ativo: boolean;
  ifood_taxa_pct: string;
  ifood_taxa_fixa: string;
  segmento_negocio: SegmentoNegocio;
  modulos_ativos: ModulosAtivos;
  nutricao_ativo: boolean;
  nutricao_exibicao: 'COMPLETA' | 'SO_ALERGENOS' | 'PARCIAL_COM_AVISO';
  nutricao_selos_atributo: boolean;
  nutricao_disclaimer: string;
}

interface FaixaEntregaForm {
  id?: string;
  nome: string;
  km_ate: string;
  taxa_fixa: string;
  taxa_por_km: string;
  pedido_minimo: string;
  ordem: number;
  ativo: boolean;
}

const vazio: FormLoja = {
  painel_tv_tipos: ['RETIRADA_BALCAO', 'SALAO'],
  nome: '', descricao: '', logo_url: '', banner_url: '', banner_pos_y: 50,
  cor_primaria: PALETA_CORES[5], cor_secundaria: PALETA_CORES[1],
  fonte: 'Inter', cor_texto: PALETA_CORES[13], cor_fundo_claro: PALETA_FUNDO_POR_TEMA.claro[0], cor_fundo_escuro: PALETA_FUNDO_POR_TEMA.escuro[0], tema_cardapio: 'claro',
  whatsapp: '', telefone: '', endereco: '', cnpj: '', razao_social: '', pedido_minimo: '0', pix_chave: '', efi_payee_code: '',
  efi_titular_documento: '', efi_conta: '', antecipacao_cartao: false,
  aceita_online: true, aceita_entrega: true,
  aceita_agendamento: false, agendamento_antecedencia_min: '30',
  lat: '', lng: '', entrega_modo: 'DISTANCIA', entrega_raio_km: '8', entrega_taxa_base: '5', entrega_taxa_km: '2.0', entrega_taxa_padrao: '0', frete_gratis_valor_minimo: '0',
  nfe_ambiente: 'homologacao', nfe_habilitado: false, nfe_regime_tributario: 'Simples Nacional', nfe_inscricao_estadual: '', nfe_id_csc: '', nfe_csc: '',
  ifood_merchant_id: '', ifood_addon_ativo: false, ifood_taxa_pct: '0', ifood_taxa_fixa: '0',
  segmento_negocio: 'GERAL',
  modulos_ativos: PRESETS_SEGMENTOS.GERAL.modulos,
  nutricao_ativo: true,
  nutricao_exibicao: 'COMPLETA',
  nutricao_selos_atributo: true,
  nutricao_disclaimer: '',
};

type Aba = 'aparencia' | 'identidade' | 'segmento' | 'logistica' | 'horarios' | 'pagamentos' | 'fiscal' | 'ifood';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Loja() {
  const { tDynamic } = useI18n();
  const toast = useToast();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<Aba>('aparencia');
  const [form, setForm] = useState<FormLoja>(vazio);
  const [horarios, setHorarios] = useState<Partial<HorarioFuncionamento>[]>([]);
  const [slug, setSlug] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  /** Veredito do Efí sobre os dados de repasse. Gravar no banco sempre dá
   *  certo — inclusive com conta errada. Quem diz se o dado presta é o Efí. */
  const [repasse, setRepasse] = useState<{ status: string; detalhe: string } | null>(null);
  const [validandoRepasse, setValidandoRepasse] = useState(false);
  /** Antecipação exige aplicação própria contratada no Efí. Se a plataforma não
   *  tem essa conta, a opção precisa aparecer indisponível — antes ela podia ser
   *  marcada, salvava, e a cobrança rodava como padrão sem avisar ninguém. */
  const [antecipacaoDisponivel, setAntecipacaoDisponivel] = useState(true);
  const [copiado, setCopiado] = useState(false);
  /** Qual link de TV acabou de ser copiado ('cardapio' | 'senhas' | null).
   *
   *  Os botoes de TV so ABRIAM o painel — no computador de quem clicou, que
   *  nao e a TV. Para instalar de verdade o lojista precisa do TEXTO do link
   *  (mandar no WhatsApp, digitar no navegador da TV), e ele nao pode sair da
   *  barra de endereco: a credencial some de la e a TV fica sem senhas. */
  const [tvCopiado, setTvCopiado] = useState<'cardapio' | 'senhas' | 'auto' | null>(null);
  // Credencial do painel de TV. Fica fora do `form` de proposito: nao e campo
  // que o lojista edita, e um save comum nunca deve reescreve-la por acidente
  // — reescrever aqui derruba todas as TVs da loja de uma vez.
  const [tokenTv, setTokenTv] = useState<string | null>(null);
  const [regenerandoTv, setRegenerandoTv] = useState(false);

  /** URL da TV com a credencial embutida. Sem o token a RPC recusa e a TV
   *  mostra o cardapio sem senhas — por isso o link NUNCA pode sair daqui
   *  sem ele. */
  const urlTv = (modo?: 'senhas' | 'cardapio' | 'auto') => {
    const base = `${window.location.origin}/tv/${slug}`;
    const params = new URLSearchParams();
    // Sempre explicito na URL: sem `modo`, a TV cai no que estiver guardado no
    // aparelho, e o link "Cardapio 4K" abria no modo automatico numa TV que ja
    // tinha sido usada. Link copiado tem que fazer o que o botao promete.
    if (modo) params.set('modo', modo);
    if (tokenTv) params.set('token', tokenTv);
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  };

  const regenerarTokenTv = async () => {
    if (!lojaId) return;
    // Confirmacao explicita: isto invalida TODA TV ja configurada da loja, e
    // quem descobre e o balcao no meio do movimento.
    const ok = window.confirm(
      'Gerar uma credencial nova invalida os links de TV que ja estao em uso. '
      + 'Toda TV da loja vai precisar do link novo. Continuar?',
    );
    if (!ok) return;
    setRegenerandoTv(true);
    const novo = crypto.randomUUID();
    const { error } = await supabase
      .from('lojas').update({ painel_tv_token: novo }).eq('id', lojaId);
    setRegenerandoTv(false);
    if (error) { alert('Nao foi possivel gerar a credencial: ' + error.message); return; }
    setTokenTv(novo);
  };
  const [erro, setErro] = useState('');
  const [temaPreview, setTemaPreview] = useState<TemaLoja>('claro');
  const [faixasEntrega, setFaixasEntrega] = useState<FaixaEntregaForm[]>([]);

  useEffect(() => {
    (async () => {
      const { data: cfgPagamento } = await supabase
        .from('plataforma_pagamento_publico')
        .select('efi_payee_code_antecipado')
        .maybeSingle();
      setAntecipacaoDisponivel(!!cfgPagamento?.efi_payee_code_antecipado);

      const { data } = await supabase.from('lojas').select('*').eq('id', lojaId).single();
      if (data) {
        setRepasse(
          data.efi_repasse_status
            ? { status: String(data.efi_repasse_status), detalhe: String(data.efi_repasse_detalhe ?? '') }
            : null,
        );
        setSlug(data.slug ?? '');
        setTokenTv(data.painel_tv_token ?? null);
        setForm({
          painel_tv_tipos: data.painel_tv_tipos ?? ['RETIRADA_BALCAO', 'SALAO'],
          nome: data.nome ?? '', descricao: data.descricao ?? '',
          logo_url: data.logo_url ?? '', banner_url: data.banner_url ?? '',
          banner_pos_y: data.banner_pos_y ?? 50,
          cor_primaria: data.cor_primaria ?? vazio.cor_primaria,
          cor_secundaria: data.cor_secundaria ?? vazio.cor_secundaria,
          fonte: data.fonte ?? 'Inter',
          cor_texto: data.cor_texto ?? vazio.cor_texto,
          cor_fundo_claro: data.cor_fundo_claro ?? (isLightColor(data.cor_texto) ? data.cor_texto : vazio.cor_fundo_claro),
          cor_fundo_escuro: data.cor_fundo_escuro ?? (!isLightColor(data.cor_texto) ? data.cor_texto : vazio.cor_fundo_escuro),
          tema_cardapio: resolverTemaLoja(data.tema_cardapio, data.cor_fundo_claro ?? data.cor_texto ?? vazio.cor_fundo_claro),
          whatsapp: data.whatsapp ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '',
          cnpj: data.cnpj ?? '', razao_social: data.razao_social ?? '',
          pedido_minimo: String(data.pedido_minimo ?? 0), pix_chave: data.pix_chave ?? '',
          efi_payee_code: data.efi_payee_code ?? '',
          efi_titular_documento: data.efi_titular_documento ?? '',
          efi_conta: data.efi_conta != null ? String(data.efi_conta) : '',
          antecipacao_cartao: data.antecipacao_cartao ?? false,
          aceita_online: data.aceita_online ?? true,
          aceita_entrega: data.aceita_entrega ?? true,
          aceita_agendamento: data.aceita_agendamento ?? false,
          agendamento_antecedencia_min: String(data.agendamento_antecedencia_min ?? 30),
          lat: data.lat != null ? String(data.lat) : '',
          lng: data.lng != null ? String(data.lng) : '',
          entrega_modo: (data.entrega_modo ?? 'HIBRIDO') as EntregaModo,
          entrega_raio_km: data.entrega_raio_km != null ? String(data.entrega_raio_km) : '8',
          entrega_taxa_base: data.entrega_taxa_base != null ? String(data.entrega_taxa_base) : '5',
          entrega_taxa_km: data.entrega_taxa_km != null ? String(data.entrega_taxa_km) : '2.0',
          entrega_taxa_padrao: data.entrega_taxa_padrao != null ? String(data.entrega_taxa_padrao) : '0',
          frete_gratis_valor_minimo: data.frete_gratis_valor_minimo != null ? String(data.frete_gratis_valor_minimo) : '0',
          nfe_ambiente: data.nfe_ambiente ?? 'homologacao',
          nfe_habilitado: data.nfe_habilitado ?? false,
          nfe_regime_tributario: data.nfe_regime_tributario ?? 'Simples Nacional',
          nfe_inscricao_estadual: data.nfe_inscricao_estadual ?? '',
          nfe_id_csc: data.nfe_id_csc ?? '',
          nfe_csc: data.nfe_csc ?? '',
          ifood_merchant_id: data.ifood_merchant_id ?? '',
          ifood_addon_ativo: data.ifood_addon_ativo ?? false,
          ifood_taxa_pct: String(data.ifood_taxa_pct ?? 0),
          ifood_taxa_fixa: String(data.ifood_taxa_fixa ?? 0),
          segmento_negocio: data.segmento_negocio ?? 'GERAL',
          modulos_ativos: data.modulos_ativos ?? PRESETS_SEGMENTOS.GERAL.modulos,
          nutricao_ativo: data.nutricao_ativo ?? true,
          nutricao_exibicao: data.nutricao_exibicao ?? 'COMPLETA',
          nutricao_selos_atributo: data.nutricao_selos_atributo ?? true,
          nutricao_disclaimer: data.nutricao_disclaimer ?? '',
        });
        setTemaPreview(resolverTemaLoja(data.tema_cardapio, data.cor_texto ?? vazio.cor_fundo_claro));
      }
      const { data: hor } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', lojaId).order('dia_semana').order('abre');
      if (hor) setHorarios(hor);
      const { data: faixas } = await supabase.from('faixas_entrega').select('*').eq('loja_id', lojaId).order('ordem').order('km_ate');
      if (faixas) {
        setFaixasEntrega((faixas as FaixaEntrega[]).map((faixa, index) => ({
          id: faixa.id,
          nome: faixa.nome ?? '',
          km_ate: String(faixa.km_ate ?? ''),
          taxa_fixa: faixa.taxa_fixa != null ? String(faixa.taxa_fixa) : '',
          taxa_por_km: faixa.taxa_por_km != null ? String(faixa.taxa_por_km) : '',
          pedido_minimo: faixa.pedido_minimo != null ? String(faixa.pedido_minimo) : '0',
          ordem: Number(faixa.ordem ?? index + 1),
          ativo: faixa.ativo !== false,
        })));
      }

      setCarregando(false);
    })();
  }, [lojaId]);

  const set = (k: keyof FormLoja) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let val = e.target.value;
    if (k === 'whatsapp' || k === 'telefone') val = maskTelefone(val);
    if (k === 'cnpj') val = maskCPFouCNPJ(val);
    if (k === 'efi_payee_code') val = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    if (k === 'efi_titular_documento') val = maskCPFouCNPJ(val);
    if (k === 'efi_conta') val = val.replace(/\D/g, '').slice(0, 12);
    setForm((f) => ({ ...f, [k]: val }));
  };
  const setValor = (k: keyof FormLoja, valor: string) => setForm((f) => ({ ...f, [k]: valor }));

  const handleImageUpload = async (campo: 'logo_url' | 'banner_url', url: string) => {
    setValor(campo, url);
    // Auto-salva a imagem direto no banco, pois o processo de upload dá a sensação ao usuário
    // de que a foto já está salva, e ele frequentemente esquece de clicar em "Salvar Alterações".
    const { error } = await supabase.from('lojas').update({ [campo]: url || null }).eq('id', lojaId);
    if (error) setErro(`Erro ao salvar imagem da loja. ${error.message}`);
  };

  const salvar = async () => {
    setErro(''); setOk(false); setSalvando(true);
    const fundoClaroGerado = obterFundoLojaPorTema('claro', form);
    const fundoEscuroGerado = obterFundoLojaPorTema('escuro', form);
    const usaEntregaPorDistancia = form.aceita_entrega && (form.entrega_modo === 'DISTANCIA' || form.entrega_modo === 'HIBRIDO');

    if (form.cnpj) {
      if (!validarCPFouCNPJ(form.cnpj)) {
        setErro('Documento inválido. Digite um CPF ou CNPJ real e ativo.');
        setSalvando(false);
        setAba('identidade');
        return;
      }
    }

    if (form.efi_payee_code) {
      const code = form.efi_payee_code.trim();
      const isHex = /^[0-9a-fA-F]{32}$/.test(code);
      if (!isHex) {
        setErro('Identificador Efí inválido. Ele deve ter exatamente 32 caracteres (letras e números), sem espaços. Verifique no painel do Efí Bank.');
        setSalvando(false);
        setAba('pagamentos'); // Força a aba de pagamentos para o lojista ver o erro
        return;
      }
    }

    // Repasse Pix: CPF/CNPJ do titular e número da conta Efí andam juntos.
    const docPix = form.efi_titular_documento.trim();
    const contaPix = form.efi_conta.trim();
    if ((docPix && !contaPix) || (contaPix && !docPix)) {
      setErro('Para receber o Pix na sua conta, preencha o CPF/CNPJ do titular E o número da conta Efí.');
      setSalvando(false);
      setAba('pagamentos');
      return;
    }
    if (docPix && !validarCPFouCNPJ(docPix)) {
      setErro('O CPF/CNPJ do titular da conta Efí é inválido. Confira os números.');
      setSalvando(false);
      setAba('pagamentos');
      return;
    }

    const geoLoja = form.endereco.trim() ? await geocode(form.endereco.trim()) : null;
    const latFinal = geoLoja?.lat ?? (form.lat ? Number(form.lat) : null);
    const lngFinal = geoLoja?.lng ?? (form.lng ? Number(form.lng) : null);

    if (usaEntregaPorDistancia && (latFinal == null || lngFinal == null)) {
      setErro('Não consegui localizar o endereço da loja para calcular entrega por raio. Revise o endereço completo ou informe coordenadas válidas.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    if (usaEntregaPorDistancia && !form.entrega_raio_km) {
      setErro('Defina o raio máximo de atendimento para a entrega.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    const faixasNormalizadas = faixasEntrega
      .filter((faixa) => faixa.ativo && faixa.km_ate)
      .map((faixa, index) => ({
        loja_id: lojaId,
        nome: faixa.nome.trim() || null,
        km_ate: Number(faixa.km_ate),
        taxa_fixa: faixa.taxa_fixa ? Number(faixa.taxa_fixa) : null,
        taxa_por_km: faixa.taxa_por_km ? Number(faixa.taxa_por_km) : null,
        pedido_minimo: Number(faixa.pedido_minimo || 0),
        ordem: index + 1,
        ativo: faixa.ativo,
      }));

    if (form.entrega_modo === 'HIBRIDO' && usaEntregaPorDistancia && faixasNormalizadas.length === 0) {
      setErro('No modo híbrido, cadastre pelo menos uma faixa de entrega por distância.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    const [{ data: horariosSnapshot }, { data: faixasSnapshot }] = await Promise.all([
      supabase.from('horarios_funcionamento').select('dia_semana, abre, fecha').eq('loja_id', lojaId),
      supabase.from('faixas_entrega').select('nome, km_ate, taxa_fixa, taxa_por_km, pedido_minimo, ordem, ativo').eq('loja_id', lojaId).order('ordem').order('km_ate'),
    ]);

    const restaurarHorariosOriginais = async () => {
      if (!horariosSnapshot?.length) return null;
      const { error } = await supabase.from('horarios_funcionamento').insert(
        horariosSnapshot.map((h) => ({
          loja_id: lojaId,
          dia_semana: h.dia_semana,
          abre: h.abre,
          fecha: h.fecha,
        })),
      );
      return error?.message ?? null;
    };

    const restaurarFaixasOriginais = async () => {
      if (!faixasSnapshot?.length) return null;
      const { error } = await supabase.from('faixas_entrega').insert(
        faixasSnapshot.map((faixa) => ({
          loja_id: lojaId,
          nome: faixa.nome,
          km_ate: faixa.km_ate,
          taxa_fixa: faixa.taxa_fixa,
          taxa_por_km: faixa.taxa_por_km,
          pedido_minimo: faixa.pedido_minimo,
          ordem: faixa.ordem,
          ativo: faixa.ativo,
        })),
      );
      return error?.message ?? null;
    };

    const { error: erroLoja } = await supabase.from('lojas').update({
      painel_tv_tipos: form.painel_tv_tipos,
      nome: form.nome,
      descricao: form.descricao || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      banner_pos_y: form.banner_pos_y,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      fonte: form.fonte,
      cor_texto: form.cor_texto,
      cor_fundo_claro: fundoClaroGerado,
      cor_fundo_escuro: fundoEscuroGerado,
      tema_cardapio: form.tema_cardapio,
      whatsapp: form.whatsapp,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      cnpj: form.cnpj || null,
      razao_social: form.razao_social || null,
      pedido_minimo: Number(form.pedido_minimo || 0),
      pix_chave: form.pix_chave || null,
      efi_payee_code: form.efi_payee_code || null,
      efi_titular_documento: form.efi_titular_documento || null,
      efi_conta: form.efi_conta || null,
      antecipacao_cartao: form.antecipacao_cartao,
      aceita_online: form.aceita_online,
      aceita_entrega: form.aceita_entrega,
      aceita_agendamento: form.aceita_agendamento,
      agendamento_antecedencia_min: Number(form.agendamento_antecedencia_min || 30),
      lat: latFinal,
      lng: lngFinal,
      entrega_modo: form.entrega_modo,
      entrega_raio_km: Number(form.entrega_raio_km || 0),
      entrega_taxa_base: Number(form.entrega_taxa_base || 0),
      entrega_taxa_km: Number(form.entrega_taxa_km || 0),
      entrega_taxa_padrao: Number(form.entrega_taxa_padrao || 0),
      frete_gratis_valor_minimo: Number(form.frete_gratis_valor_minimo || 0),
      ifood_taxa_pct: Number(form.ifood_taxa_pct || 0),
      ifood_taxa_fixa: Number(form.ifood_taxa_fixa || 0),
      ifood_addon_ativo: form.ifood_addon_ativo,
      segmento_negocio: form.segmento_negocio,
      modulos_ativos: form.modulos_ativos,
      nutricao_ativo: form.nutricao_ativo,
      nutricao_exibicao: form.nutricao_exibicao,
      nutricao_selos_atributo: form.nutricao_selos_atributo,
      nutricao_disclaimer: form.nutricao_disclaimer || null,
    }).eq('id', lojaId);

    if (erroLoja) {
      setSalvando(false);
      setErro('Erro ao salvar: ' + erroLoja.message);
      toast(tDynamic('Não foi possível salvar os dados da loja'), 'erro');
      return;
    }

    // Salvar horários
    const { error: erroLimparHorarios } = await supabase.from('horarios_funcionamento').delete().eq('loja_id', lojaId);
    if (erroLimparHorarios) {
      setSalvando(false);
      setErro('Erro ao atualizar horários da loja: ' + erroLimparHorarios.message);
      return;
    }
    if (horarios.length > 0) {
      const novos = horarios.map(h => ({
        loja_id: lojaId,
        dia_semana: h.dia_semana,
        abre: h.abre?.substring(0, 5) + ':00', // forçar formato HH:MM:00 pro Postgres
        fecha: h.fecha?.substring(0, 5) + ':00'
      }));
      const { error: erroInserirHorarios } = await supabase.from('horarios_funcionamento').insert(novos);
      if (erroInserirHorarios) {
        const erroRestauracao = await restaurarHorariosOriginais();
        setSalvando(false);
        setErro(
          'Erro ao salvar horários da loja: ' +
          erroInserirHorarios.message +
          (erroRestauracao ? ` | Falha ao restaurar horários anteriores: ${erroRestauracao}` : ''),
        );
        return;
      }
    }

    const { error: erroLimparFaixas } = await supabase.from('faixas_entrega').delete().eq('loja_id', lojaId);
    if (erroLimparFaixas) {
      setSalvando(false);
      setErro('Erro ao atualizar faixas de entrega: ' + erroLimparFaixas.message);
      return;
    }
    if (faixasNormalizadas.length > 0) {
      const { error: erroInserirFaixas } = await supabase.from('faixas_entrega').insert(faixasNormalizadas);
      if (erroInserirFaixas) {
        const erroRestauracao = await restaurarFaixasOriginais();
        setSalvando(false);
        setErro(
          'Erro ao salvar faixas de entrega: ' +
          erroInserirFaixas.message +
          (erroRestauracao ? ` | Falha ao restaurar faixas anteriores: ${erroRestauracao}` : ''),
        );
        return;
      }
    }

    setSalvando(false);
    document.documentElement.style.setProperty('--cor-primaria', form.cor_primaria);
    document.documentElement.style.setProperty('--cor-secundaria', form.cor_secundaria);
    setOk(true); setTimeout(() => setOk(false), 2500);
    // O botao "Salvo!" dura 2,5s e fica no rodape de uma pagina longa: quem
    // salva os dados da Efi la em cima nao ve confirmacao nenhuma. O toast
    // aparece no canto superior, independente de onde a pagina esteja rolada.
    toast(tDynamic('Dados da loja salvos com sucesso'), 'sucesso');

    // O toast acima confirma a GRAVAÇÃO, e só isso. Um CPF válido com número de
    // conta errado grava igualzinho a um dado certo — e o lojista só descobria
    // quando o dinheiro de uma venda real não chegava. Aqui a pergunta vai para
    // quem tem autoridade sobre a resposta: o próprio Efí.
    if (docPix && contaPix) {
      setValidandoRepasse(true);
      const { data: veredito, error: erroValidacao } = await supabase.functions.invoke(
        'efi-validar-repasse',
        { body: { loja_id: lojaId } },
      );
      setValidandoRepasse(false);
      const status = erroValidacao ? 'indisponivel' : String(veredito?.status ?? 'indisponivel');
      const detalhe = erroValidacao
        ? String(erroValidacao.message ?? erroValidacao)
        : String(veredito?.detalhe ?? '');
      setRepasse({ status, detalhe });
      if (status === 'aceito') {
        toast(tDynamic('O Efí aceitou os dados do seu repasse Pix'), 'sucesso');
      } else if (status === 'recusado') {
        toast(detalhe || tDynamic('O Efí recusou os dados do repasse'), 'erro');
      } else {
        toast(tDynamic('Salvo, mas não consegui confirmar o repasse no Efí agora'), 'alerta');
      }
    }
  };

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <MiseOnLoader status="Carregando configurações da loja..." rows={2} />
      </div>
    );
  }

  const linkPublico = `${window.location.origin}/${slug}`;
  const fundoPreview = obterFundoLojaPorTema(temaPreview, form);
  const tokensPreview = obterTokensLoja(fundoPreview, temaPreview, form.cor_texto || form.cor_primaria || '#FC5B24');
  const copiarLink = () => {
    navigator.clipboard.writeText(linkPublico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  const copiarLinkTv = (qual: 'cardapio' | 'senhas' | 'auto') => {
    navigator.clipboard.writeText(urlTv(qual));
    setTvCopiado(qual);
    setTimeout(() => setTvCopiado(null), 2000);
  };
  const compartilharWhatsapp = () => {
    const msg = `Peça pelo nosso cardápio online: ${linkPublico}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  type CampoTexto = { [K in keyof FormLoja]: FormLoja[K] extends string ? K : never }[keyof FormLoja];
  const renderCampo = (label: string, k: CampoTexto, placeholder?: string, textarea?: boolean) => (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      {textarea ? (
        <textarea value={form[k]} onChange={set(k)} placeholder={placeholder} rows={2}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      ) : (
        <input value={form[k]} onChange={set(k)} placeholder={placeholder}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      )}
    </label>
  );

  return (
    <div className="p-4 pb-28 lg:pb-4">
      <div className="mb-4 flex items-center gap-2">
        <Store size={20} className="text-[var(--cor-primaria)]" />
        <h2 className="text-lg font-bold">{tDynamic('Configurar Loja')}</h2>
      </div>

      {/* Link público — o cliente acessa por aqui, sem login */}
      <div className="mb-5 rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3.5 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Links de Acesso Rápido')}</p>
        <div data-tour="tour-loja-tv-links" className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono">{linkPublico}</code>
          <button onClick={copiarLink} title="Copiar link" className="shrink-0 rounded-lg border p-2 text-gray-500 dark:text-gray-400">
            {copiado ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
          <a href={linkPublico} target="_blank" rel="noreferrer" title="Abrir" className="shrink-0 rounded-lg border p-2 text-gray-500 dark:text-gray-400">
            <ExternalLink size={15} />
          </a>
          <button onClick={compartilharWhatsapp} title="Compartilhar no WhatsApp" className="shrink-0 rounded-lg border p-2 text-green-600">
            <Share2 size={15} />
          </button>
          <a
            href={urlTv('auto')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-all"
            title="Recomendado para uma TV só: mostra o cardápio e corta sozinho para a senha quando um pedido fica pronto"
          >
            <Tv size={15} /> {tDynamic('TV Automática (recomendado)')}
          </a>
          <button
            type="button"
            onClick={() => copiarLinkTv('auto')}
            title="Copiar o link da TV automática (com a credencial)"
            className="shrink-0 rounded-lg border border-amber-500/30 p-2 text-amber-600 dark:text-amber-300"
          >
            {tvCopiado === 'auto' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
          <a
            href={urlTv('cardapio')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-all"
            title="Fixa a TV no cardápio — para a segunda TV, a do salão"
          >
            <Tv size={15} /> {tDynamic('Cardápio na TV 4K')}
          </a>
          <button
            type="button"
            onClick={() => copiarLinkTv('cardapio')}
            title="Copiar o link do cardápio na TV (com a credencial)"
            className="shrink-0 rounded-lg border border-purple-500/30 p-2 text-purple-600 dark:text-purple-300"
          >
            {tvCopiado === 'cardapio' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
          <a
            href={urlTv('senhas')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all"
            title="Abrir já no painel de senhas — a TV lembra deste modo mesmo depois de reiniciar"
          >
            <Tv size={15} /> {tDynamic('Painel de Senhas na TV')}
          </a>
          <button
            type="button"
            onClick={() => copiarLinkTv('senhas')}
            title="Copiar o link do painel de senhas (com a credencial)"
            className="shrink-0 rounded-lg border border-emerald-500/30 p-2 text-emerald-600 dark:text-emerald-300"
          >
            {tvCopiado === 'senhas' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
        </div>

        {/* ── Quais pedidos são chamados na TV ──────────────────────────────
            Senha é chamada de balcão: só faz sentido para quem está no salão
            esperando. Delivery entra aqui como escolha explícita da loja, e
            fica DESLIGADO por padrão — antes, o painel anunciava em voz alta
            "retire no balcão" para pedido de iFood, com o cliente em casa. */}
        <div data-tour="tour-loja-tv-tipos" className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
            {tDynamic('Chamar na TV os pedidos de')}
          </p>
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
            {tDynamic('A senha zera todo dia e vai de 1 a 999. Delivery não é chamado: o cliente não está no balcão.')}
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              ['RETIRADA_BALCAO', 'Balcão'],
              ['SALAO', 'Mesa / Salão'],
              ['DELIVERY', 'Delivery'],
            ] as const).map(([valor, rotulo]) => {
              const ativo = form.painel_tv_tipos.includes(valor);
              const ultimoLigado = ativo && form.painel_tv_tipos.length === 1;
              return (
                <button
                  key={valor}
                  type="button"
                  // Nunca deixar a lista vazia: painel sem tipo nenhum nunca
                  // mostra nada, e o lojista descobriria no meio do serviço.
                  // O banco também recusa (ck_lojas_painel_tv_tipos_nao_vazio).
                  disabled={ultimoLigado}
                  title={ultimoLigado ? 'Pelo menos um tipo precisa ficar ligado.' : undefined}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      painel_tv_tipos: ativo
                        ? f.painel_tv_tipos.filter((t) => t !== valor)
                        : [...f.painel_tv_tipos, valor],
                    }))
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    ativo
                      ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {tDynamic(rotulo)}
                </button>
              );
            })}
          </div>

          {/* O lojista precisa entender POR QUE o link tem um codigo no fim,
              senao ele copia a URL "limpa" da barra do navegador e a TV para
              de mostrar senhas sem explicacao. */}
          <div data-tour="tour-loja-tv-credencial" className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {tDynamic('Os links acima levam uma credencial no final. Ela é o que impede qualquer pessoa de abrir o painel da sua loja — copie o link por aqui, não da barra do navegador da TV.')}
            </p>
            <button
              type="button"
              onClick={regenerarTokenTv}
              disabled={regenerandoTv}
              className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              {regenerandoTv ? tDynamic('Gerando...') : tDynamic('Gerar credencial nova')}
            </button>
            <span className="ml-2 text-[11px] text-gray-400">
              {tDynamic('Use se o link vazou. As TVs atuais vão precisar do link novo.')}
            </span>
          </div>
        </div>
        {copiado && <p className="text-[11px] font-medium text-green-600">Link copiado!</p>}
      </div>

      {/* Preview ao vivo da identidade — reflete cada escolha na hora */}
      <div
        className="mb-5 overflow-hidden rounded-2xl border shadow-sm"
        style={{
          fontFamily: fonteFamilia(form.fonte),
          background: tokensPreview.fundo,
          borderColor: tokensPreview.border,
        }}
      >
        <div className="w-full aspect-[21/9] bg-gray-100" style={{
          backgroundImage: form.banner_url ? `url(${getOptimizedImageUrl(form.banner_url)})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="flex items-center gap-3 p-3" style={{ background: tokensPreview.surface }}>
          {form.logo_url
            ? <img src={getOptimizedImageUrl(form.logo_url)} alt="" className="h-14 w-14 rounded-full border object-cover" />
            : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: form.cor_primaria }}>
                { (form.nome || '').trim() ? (form.nome || '').trim()[0].toUpperCase() : '?'}
              </div>
            )}
          <div className="min-w-0">
            <p className="truncate font-bold" style={{ color: tokensPreview.texto }}>{form.nome || 'Nome da loja'}</p>
            <p className="truncate text-xs" style={{ color: tokensPreview.textoSuave }}>{form.descricao || 'Descrição da loja'}</p>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>
              Aberto agora
            </span>
          </div>
        </div>
        <div className="flex gap-2 px-3 pb-3" style={{ background: tokensPreview.surface }}>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>Categoria</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_secundaria, color: isLightColor(form.cor_secundaria) ? '#000000' : '#ffffff' }}>Destaque</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 pb-1">
        {(['aparencia', 'identidade', 'segmento', 'logistica', 'horarios', 'pagamentos', 'fiscal', 'ifood'] as Aba[]).map((a) => (
          <button key={a} data-tour={a === 'pagamentos' ? "tour-loja-aba-pagamentos" : undefined} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${aba === a ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm'}`}>
            {a === 'aparencia'
              ? 'Aparência'
              : a === 'identidade'
              ? 'Identidade'
              : a === 'segmento'
              ? 'Segmento & Módulos'
              : a === 'logistica'
              ? 'Entrega e Cobertura'
              : a === 'horarios'
              ? 'Horários'
              : a === 'pagamentos'
              ? 'Pagamentos'
              : a === 'fiscal'
              ? 'Fiscal (NFC-e)'
              : 'Integrações (iFood)'}
          </button>
        ))}
      </div>

      {aba === 'segmento' && (
        <div className="space-y-6">
          {/* Escolha de Segmento */}
          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold dark:text-gray-100">
                <Sliders size={18} className="text-[var(--cor-primaria)]" />
                <span>{tDynamic('Segmento de Negócio do Estabelecimento')}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('Selecione o perfil do seu negócio para ativar os pré-requisitos automáticos da sua operação.')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(PRESETS_SEGMENTOS) as SegmentoNegocio[]).map((segKey) => {
                const info = PRESETS_SEGMENTOS[segKey];
                const selecionado = form.segmento_negocio === segKey;

                return (
                  <button
                    key={segKey}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        segmento_negocio: segKey,
                        modulos_ativos: { ...info.modulos },
                      }));
                    }}
                    className={`flex flex-col justify-between rounded-2xl p-4 text-left border transition-all ${
                      selecionado
                        ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 ring-2 ring-[var(--cor-primaria)]/30'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm dark:text-gray-100">{info.rotulo}</span>
                        {selecionado && <Check size={16} className="text-[var(--cor-primaria)]" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{info.descricao}</p>
                    </div>

                    <div className="mt-3 text-[10px] font-semibold text-[var(--cor-primaria)]">
                      {selecionado ? '✓ Preset Aplicado' : 'Clique para selecionar'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Módulos Híbridos Configuráveis */}
          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold dark:text-gray-100">
                  <Layers size={18} className="text-orange-500" />
                  <span>{tDynamic('Módulos Operacionais Híbridos (TUDO CONFIGURÁVEL)')}</span>
                </div>
                <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-bold text-orange-400 border border-orange-500/20">
                  Inteligente
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('Ligue ou desligue qualquer recurso individualmente para atender exatamente a rotina da sua casa (ex: buffet no almoço + pizzaria à noite).')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'balanca', rotulo: 'Balança de Buffet por Quilo', desc: 'Conexão Web Serial USB/RS-232 e pesagem digital.', icon: Scale },
                { key: 'mesas_3d', rotulo: 'Salão 3D & Controle de Mesas', desc: 'Mapa 3D WebGL, assentos e comandas de salão.', icon: Utensils },
                { key: 'garcom_pwa', rotulo: 'PWA Garçom Mobile (Vibração)', desc: 'Atendimento e lançamento fracionado por assento.', icon: Smartphone },
                { key: 'pizzas', rotulo: 'Pizzas Meio-a-Meio & Bordas', desc: 'Montador de sabores fracionados e adicionais.', icon: Pizza },
                { key: 'kds', rotulo: 'Cozinha KDS (Kanban Sem Papel)', desc: 'Fila de preparo e bastão de produção.', icon: ChefHat },
                { key: 'entregas', rotulo: 'Gestão de Entregas & Rotas', desc: 'Cálculo de km no mapa e painel de motoboys.', icon: Bike },
                { key: 'ifood', rotulo: 'Integração Nativa iFood', desc: 'Sincronização de pedidos e cardápio unificado.', icon: ShoppingBag },
                { key: 'fiscal', rotulo: 'Emissor Fiscal NFC-e / NF-e 4.0', desc: 'Emissão de cupom fiscal direto no PDV.', icon: Shield },
              ].map(({ key, rotulo, desc, icon: IconComponent }) => {
                const ativo = !!(form.modulos_ativos as any)?.[key];

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${ativo ? 'bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)] border-[var(--cor-primaria)]/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 border-transparent'}`}>
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <div className="font-semibold text-xs dark:text-gray-100">{rotulo}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{desc}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          modulos_ativos: {
                            ...f.modulos_ativos,
                            [key]: !ativo,
                          },
                        }));
                      }}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        ativo ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          ativo ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Informação nutricional na vitrine */}
          <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
            <div className="flex items-center gap-2 text-sm font-bold dark:text-gray-100">
              <Sliders size={18} className="text-emerald-600" />
              <span>{tDynamic('Informação nutricional no cardápio')}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tDynamic('Calculada a partir das suas fichas técnicas. O padrão publica o número apenas quando todos os ingredientes do prato têm dado rastreável — e sempre mostra os alergênicos já declarados, mesmo em prato incompleto.')}
            </p>

            <label className="mt-4 flex items-center gap-2 text-sm dark:text-gray-200">
              <input
                type="checkbox"
                checked={form.nutricao_ativo}
                onChange={(e) => setForm({ ...form, nutricao_ativo: e.target.checked })}
              />
              {tDynamic('Exibir informação nutricional no cardápio')}
            </label>

            {form.nutricao_ativo && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('O que publicar')}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {([
                      ['COMPLETA', 'Recomendado — número quando o prato fecha', 'Publica a tabela completa só nos pratos com todos os ingredientes cadastrados. Nos demais, mostra apenas os alergênicos.'],
                      ['SO_ALERGENOS', 'Somente alergênicos', 'Nunca publica valores; mostra só o aviso de alergênicos. Útil enquanto você ainda está montando as fichas.'],
                      ['PARCIAL_COM_AVISO', 'Publicar também prato incompleto', 'Mostra o valor calculado mesmo faltando ingrediente, com aviso de parcial. O número sai menor do que o real — use com cuidado.'],
                    ] as const).map(([valor, titulo, ajuda]) => (
                      <label
                        key={valor}
                        className={`flex cursor-pointer gap-2 rounded-xl border p-2.5 transition ${
                          form.nutricao_exibicao === valor
                            ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="nutricao_exibicao"
                          className="mt-0.5"
                          checked={form.nutricao_exibicao === valor}
                          onChange={() => setForm({ ...form, nutricao_exibicao: valor })}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold dark:text-gray-100">{tDynamic(titulo)}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">{tDynamic(ajuda)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2 text-sm dark:text-gray-200">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.nutricao_selos_atributo}
                    onChange={(e) => setForm({ ...form, nutricao_selos_atributo: e.target.checked })}
                  />
                  <span className="min-w-0">
                    <span className="block">{tDynamic('Mostrar selos como "alto em proteína" e "fonte de fibras"')}</span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                      {tDynamic('Calculados pelos limites da RDC 54/2012 e exibidos com o critério ao lado. Aparecem apenas em pratos completos.')}
                    </span>
                  </span>
                </label>

                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('Observação sua no rodapé da tabela (opcional)')}</p>
                  <textarea
                    rows={2}
                    value={form.nutricao_disclaimer}
                    onChange={(e) => setForm({ ...form, nutricao_disclaimer: e.target.value })}
                    placeholder={tDynamic('Ex.: Nossos molhos podem variar conforme a produção do dia.')}
                    className="mt-1 w-full rounded-xl border p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'aparencia' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload lojaId={lojaId} pasta="logos" aspecto="aspect-square" label="Logo" value={form.logo_url} onChange={(url) => handleImageUpload('logo_url', url)} />
            <ImageUpload lojaId={lojaId} pasta="banners" aspecto="aspect-[21/9]" label="Banner" value={form.banner_url} onChange={(url) => handleImageUpload('banner_url', url)} />
          </div>

          {/* Enquadramento do banner.
              O cardápio exibe o banner com object-fit: cover — a imagem preenche
              a faixa e o que sobra é cortado. Com a posição travada no centro,
              um banner 4000x1714 numa faixa 4:1 perdia ~42% da altura sempre
              pelo meio: fachada ou prato fora do centro exato simplesmente
              sumiam, e a única saída era reeditar a foto por fora. Este controle
              move o ponto focal vertical, com a prévia mostrando o resultado
              exato que o cliente vai ver. */}
          {form.banner_url && (
            <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                <Palette size={15} /> {tDynamic('Enquadramento do banner')}
              </p>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                O cardápio mostra o banner numa faixa larga e corta o resto. Arraste
                para escolher que parte da imagem fica visível.
              </p>

              <div className="relative h-28 w-full overflow-hidden rounded-xl sm:h-36">
                <img
                  src={getOptimizedImageUrl(form.banner_url)}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `50% ${form.banner_pos_y}%` }}
                  alt="Prévia do enquadramento do banner"
                />
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {tDynamic('Prévia — é assim que o cliente vê')}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs text-gray-500 dark:text-gray-400">Topo</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={form.banner_pos_y}
                  onChange={(e) => setForm({ ...form, banner_pos_y: Number(e.target.value) })}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[var(--cor-primaria)] dark:bg-gray-700"
                  aria-label="Posição vertical do banner"
                />
                <span className="w-10 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">Base</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, banner_pos_y: 50 })}
                  className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Centro
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold"><Palette size={15} /> Identidade Visual</p>

            <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Tema padrão da vitrine')}</p>
                  <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                    {form.tema_cardapio === 'escuro' ? 'Escuro' : 'Claro'}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {tDynamic('Define o tema inicial para quem entrar pela primeira vez. Depois disso, o cliente final pode alternar o tema na vitrine pública.')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Sun size={16} className={form.tema_cardapio === 'claro' ? 'text-amber-500' : 'text-gray-400'} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.tema_cardapio === 'escuro'}
                    aria-label="Alternar tema padrão claro ou escuro da vitrine"
                    onClick={() => setForm((f) => {
                      const proximoTema: TemaLoja = f.tema_cardapio === 'escuro' ? 'claro' : 'escuro';
                      return {
                        ...f,
                        tema_cardapio: proximoTema,
                      };
                    })}
                    className={`relative h-7 w-14 rounded-full transition-colors ${form.tema_cardapio === 'escuro' ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span
                      className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-all ${form.tema_cardapio === 'escuro' ? 'left-[30px]' : 'left-0.5'}`}
                    >
                      {form.tema_cardapio === 'escuro' ? <Moon size={13} className="text-gray-700" /> : <Sun size={13} className="text-amber-500" />}
                    </span>
                  </button>
                  <Moon size={16} className={form.tema_cardapio === 'escuro' ? 'text-[var(--cor-primaria)]' : 'text-gray-400'} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div className={`rounded-xl border p-3 ${form.tema_cardapio === 'claro' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className="mb-1 flex items-center gap-1 font-semibold dark:text-gray-100"><Sun size={13} /> Claro</p>
                  <p className="text-gray-500 dark:text-gray-400">Visual leve, limpo e luminoso.</p>
                </div>
                <div className={`rounded-xl border p-3 ${form.tema_cardapio === 'escuro' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className="mb-1 flex items-center gap-1 font-semibold dark:text-gray-100"><Moon size={13} /> Escuro</p>
                  <p className="text-gray-500 dark:text-gray-400">Visual premium, noturno e contrastado.</p>
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Pré-visualização')}</p>
                  <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                    {tDynamic('Veja como a identidade reage em cada tema')}
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setTemaPreview('claro')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${temaPreview === 'claro' ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaPreview('escuro')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${temaPreview === 'escuro' ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                {tDynamic('O cliente final pode escolher entre claro e escuro na vitrine pública. Aqui você garante que os dois modos fiquem bonitos e legíveis.')}
              </p>
            </div>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Primária" value={form.cor_primaria} onChange={(c) => setValor('cor_primaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">{tDynamic('Principal cor de ação. Usada nos botões grandes (ex: Finalizar Pedido) e menus principais.')}</p>
            </div>

            <div className="mb-4">
              <ColorSwatchPicker label="Cor base da identidade" value={form.cor_texto} onChange={(c) => setValor('cor_texto', c)} />
              <p className="mt-1 text-[11px] text-gray-500">{tDynamic('Essa cor é a origem dos dois temas. O claro vira uma leitura suave dessa cor e o escuro vira uma leitura profunda da mesma família cromática.')}</p>
            </div>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Secundária" value={form.cor_secundaria} onChange={(c) => setValor('cor_secundaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">{tDynamic('Cor de apoio. Usada apenas em selos menores (ex: "Promoção", "Destaque") para não conflitar com os botões.')}</p>
            </div>
            
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Leitura cromática automática')}</p>
              <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                {tDynamic('A cor primária da loja gera os dois temas com a mesma identidade visual')}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Exemplo: azul vira azul claro no tema claro e azul profundo no tema escuro. Vermelho vira vermelho claro e vermelho profundo. O sistema recalcula contraste, superfícies e bordas sem deixar texto sumir.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['claro', 'escuro'] as TemaLoja[]).map((tema) => {
                  const fundoTema = obterFundoLojaPorTema(tema, form);
                  const tokensTema = obterTokensLoja(fundoTema, tema, form.cor_texto || form.cor_primaria || '#FC5B24');
                  return (
                    <div
                      key={tema}
                      className="rounded-2xl border p-4"
                      style={{ background: tokensTema.fundo, borderColor: tokensTema.border }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokensTema.textoFraco }}>
                            Tema {tema}
                          </p>
                          <p className="text-sm font-bold" style={{ color: tokensTema.texto }}>
                            {tema === 'claro' ? 'Variação clara da marca' : 'Variação escura da marca'}
                          </p>
                        </div>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tokensTema.destaque, color: tokensTema.texto }}>
                          {tema === 'claro' ? 'Claro' : 'Escuro'}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border p-3" style={{ background: tokensTema.surface, borderColor: tokensTema.border }}>
                        <p className="text-sm font-semibold" style={{ color: tokensTema.texto }}>{tDynamic('Lanche do Paulista')}</p>
                        <p className="mt-1 text-xs" style={{ color: tokensTema.textoSuave }}>
                          {tDynamic('A paleta se adapta automaticamente a partir da cor primária.')}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#111827' : '#FFFFFF' }}>
                            Primária
                          </span>
                          <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: form.cor_secundaria, color: isLightColor(form.cor_secundaria) ? '#111827' : '#FFFFFF' }}>
                            Secundária
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><TypeIcon size={15} /> Fonte</p>
            <FontPicker value={form.fonte} onChange={(f) => setValor('fonte', f)} />
          </div>
        </div>
      )}

      {aba === 'identidade' && (
        <div className="space-y-3">
          {renderCampo('Nome da loja', 'nome', '"N" de Natureba')}
          {renderCampo('Descrição', 'descricao', 'Baguetes artesanais, saladas e doces.', true)}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
             <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={15} /> Localização</p>
             {renderCampo('Endereço completo', 'endereco', 'Rua das Flores, 123 - Centro, São Paulo - SP', true)}
          </div>
          {renderCampo('Celular 1 / WhatsApp Principal', 'whatsapp', '(11) 99999-9999')}
          {renderCampo('Celular 2 / WhatsApp Secundário (Opcional)', 'telefone', '(11) 99999-9999')}
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{tDynamic('Dados no cupom do cliente (opcional)')}</p>
            <div className="space-y-3">
              {renderCampo('Razão social / Nome', 'razao_social', 'Lanche do Paulista Ltda')}
              {renderCampo('CPF / CNPJ', 'cnpj', '000.000.000-00 ou 00.000.000/0001-00')}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">{tDynamic('Aparecem no cabeçalho da Nota do Cliente. Deixe em branco se não quiser exibir.')}</p>
          </div>
          {renderCampo('Pedido mínimo (R$)', 'pedido_minimo', '15')}
        </div>
      )}

      {aba === 'logistica' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Bike size={15} /> {tDynamic('Motor de entrega')}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tDynamic('Configure a cobertura do tenant como operação real: raio máximo, cálculo por km e faixas comerciais por distância.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, aceita_entrega: !f.aceita_entrega }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_entrega ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_entrega ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Taxa Mínima de Saída (R$)')}</span>
                <input
                  value={form.entrega_taxa_base}
                  onChange={set('entrega_taxa_base')}
                  type="number"
                  step="0.50"
                  placeholder="5.00"
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
                />
                <p className="mt-1 text-[11px] text-gray-400">{tDynamic('Valor fixo cobrado em qualquer entrega.')}</p>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Valor Adicional por Km (R$/km)')}</span>
                <input
                  value={form.entrega_taxa_km}
                  onChange={set('entrega_taxa_km')}
                  type="number"
                  step="0.50"
                  placeholder="2.00"
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
                />
                <p className="mt-1 text-[11px] text-gray-400">{tDynamic('Adicional multiplicado pela distância em km.')}</p>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Raio Máximo de Cobertura (Km)')}</span>
                <input
                  value={form.entrega_raio_km}
                  onChange={set('entrega_raio_km')}
                  type="number"
                  step="0.5"
                  placeholder="8.0"
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
                />
                <p className="mt-1 text-[11px] text-gray-400">{tDynamic('Bloqueia pedidos com distância superior a este raio.')}</p>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Frete Grátis acima de (R$)')}</span>
                <input
                  value={form.frete_gratis_valor_minimo}
                  onChange={set('frete_gratis_valor_minimo')}
                  type="number"
                  step="5.00"
                  placeholder="0.00 (desativado)"
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-1 text-[11px] text-gray-400">{tDynamic('Isenta a taxa se o subtotal atingir este valor (0 = sem frete grátis).')}</p>
              </label>
            </div>

            {/* Simulador Interativo em Tempo Real */}
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900/50 p-4 space-y-2">
              <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={14} /> {tDynamic('Simulador da Taxa no Checkout')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="text-gray-400">{tDynamic('Distância: 3.5 km')}</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    Taxa: {fmt(Number(form.entrega_taxa_base || 0) + (3.5 * Number(form.entrega_taxa_km || 0)))}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="text-gray-400">{tDynamic('Distância: 6.0 km')}</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    Taxa: {fmt(Number(form.entrega_taxa_base || 0) + (6.0 * Number(form.entrega_taxa_km || 0)))}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="text-gray-400">Acima de {form.entrega_raio_km || 8} km</span>
                  <p className="font-bold text-red-500 mt-0.5">{tDynamic('Fora da área (Bloqueado)')}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold dark:text-gray-100">{tDynamic('Georreferência da loja')}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {tDynamic('Usamos o endereço da loja para localizar automaticamente a origem das entregas ao salvar.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const geo = form.endereco.trim() ? await geocode(form.endereco.trim()) : null;
                    if (!geo) return setErro('Não consegui localizar esse endereço da loja. Revise a rua, número, cidade e UF.');
                    setForm((f) => ({ ...f, lat: String(geo.lat), lng: String(geo.lng) }));
                    setOk(true);
                    setTimeout(() => setOk(false), 1800);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-[var(--cor-primaria)]"
                >
                  <LocateFixed size={14} /> Localizar loja
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Latitude</span>
                  <input value={form.lat} onChange={set('lat')} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Longitude</span>
                  <input value={form.lng} onChange={set('lng')} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold dark:text-gray-100">{tDynamic('Faixas de entrega por distância')}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tDynamic('Exemplo profissional: até 3 km cobra fixo; até 5 km cobra outra faixa; acima disso aplica valor por km.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFaixasEntrega((atual) => [...atual, { nome: '', km_ate: '', taxa_fixa: '', taxa_por_km: '', pedido_minimo: '0', ordem: atual.length + 1, ativo: true }])}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--cor-primaria)]/10 px-3 py-2 text-xs font-bold text-[var(--cor-primaria)]"
              >
                <Plus size={14} /> Nova faixa
              </button>
            </div>

            <div className="space-y-3">
              {faixasEntrega.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {tDynamic('Nenhuma faixa cadastrada ainda. No modo híbrido, cadastre pelo menos uma faixa ativa.')}
                </div>
              )}

              {faixasEntrega.map((faixa, index) => (
                <div key={faixa.id ?? index} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="grid gap-3 md:grid-cols-6">
                    <label className="block md:col-span-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nome comercial</span>
                      <input
                        value={faixa.nome}
                        onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, nome: e.target.value } : item))}
                        placeholder="Até 3 km"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Até km</span>
                      <input value={faixa.km_ate} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, km_ate: e.target.value } : item))} type="number" step="0.1"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa fixa</span>
                      <input value={faixa.taxa_fixa} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, taxa_fixa: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">R$/km</span>
                      <input value={faixa.taxa_por_km} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, taxa_por_km: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pedido mínimo</span>
                      <input value={faixa.pedido_minimo} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, pedido_minimo: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, ativo: !item.ativo } : item))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${faixa.ativo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {faixa.ativo ? 'Faixa ativa' : 'Faixa inativa'}
                    </button>
                    <button type="button" onClick={() => setFaixasEntrega((atual) => atual.filter((_, i) => i !== index))}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-500">
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {tDynamic('As taxas por bairro continuam disponíveis na aba')} <Link to="/admin/marketing" className="font-bold underline">Marketing</Link> e entram como contingência operacional quando necessário.
            </div>
          </div>
        </div>
      )}

      {aba === 'horarios' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Clock size={15} /> {tDynamic('Grade de Horários')}</h3>
              <button onClick={() => setHorarios([...horarios, { dia_semana: 1, abre: '18:00', fecha: '23:00' }])}
                className="flex items-center gap-1 rounded-lg bg-[var(--cor-primaria)]/10 px-3 py-1.5 text-xs font-bold text-[var(--cor-primaria)] transition hover:bg-[var(--cor-primaria)]/20">
                <Plus size={14} /> Novo Turno
              </button>
            </div>
            
            {horarios.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">{tDynamic('Nenhum horário cadastrado. A loja aparecerá como fechada.')}</p>
            ) : (
              <div className="space-y-2">
                {horarios.map((h, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <select 
                      value={h.dia_semana} 
                      onChange={(e) => { const n = [...horarios]; n[i].dia_semana = Number(e.target.value); setHorarios(n); }}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-semibold flex-1"
                    >
                      {DIAS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                    </select>
                    
                    <div className="flex items-center gap-2">
                      <input type="time" value={h.abre?.substring(0, 5) || ''} onChange={(e) => { const n = [...horarios]; n[i].abre = e.target.value; setHorarios(n); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm" />
                      <span className="text-gray-400 font-medium text-xs">até</span>
                      <input type="time" value={h.fecha?.substring(0, 5) || ''} onChange={(e) => { const n = [...horarios]; n[i].fecha = e.target.value; setHorarios(n); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm" />
                    </div>
                    
                    <button onClick={() => setHorarios(horarios.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              {tDynamic('Dica: Você pode adicionar múltiplos turnos no mesmo dia (Ex: Sexta 11:00 às 14:00 e Sexta 18:00 às 23:59).')} <br/>
              <b>{tDynamic('Se passar da meia noite')}</b>, cadastre o dia atual até 23:59 e o dia seguinte de 00:00 até o horário final.
            </p>
          </div>
        </div>
      )}

      {aba === 'pagamentos' && (
        <div data-tour="tour-loja-pagamentos" className="space-y-4">
          <Link to="/admin/ajuda" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--cor-primaria)]/40 bg-[var(--cor-primaria)]/5 px-4 py-3 transition hover:bg-[var(--cor-primaria)]/10">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              🧭 Primeira vez configurando? A <b>{tDynamic('Central de Ajuda')}</b> tem o passo a passo completo — da abertura da conta Efí até o dinheiro na sua mão.
            </span>
            <ArrowRight size={16} className="shrink-0 text-[var(--cor-primaria)]" />
          </Link>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h3 className="text-sm font-bold dark:text-gray-100">{tDynamic('Formas de pagamento aceitas')}</h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold dark:text-gray-200">Pagamento antecipado (online)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Pix e crédito via Efí — o cliente paga na hora do pedido.')}</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, aceita_online: !f.aceita_online }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_online ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_online ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              <div>
                <p className="text-sm font-semibold dark:text-gray-200">{tDynamic('Pagamento na entrega')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Dinheiro e maquininha (débito) — o cliente paga ao receber.')}</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, aceita_entrega: !f.aceita_entrega }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_entrega ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_entrega ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              <div>
                <p className="text-sm font-semibold dark:text-gray-200">{tDynamic('Agendamento de pedidos')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Cliente escolhe um horário futuro pra receber, dentro dos seus horários de funcionamento.')}</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, aceita_agendamento: !f.aceita_agendamento }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_agendamento ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_agendamento ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {form.aceita_agendamento && (
              <label className="block border-t border-gray-100 dark:border-gray-800 pt-4">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Antecedência mínima (minutos)')}</span>
                <input type="number" min="0" value={form.agendamento_antecedencia_min}
                  onChange={(e) => setForm((f) => ({ ...f, agendamento_antecedencia_min: e.target.value }))}
                  className="mt-1 w-32 rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" />
                <span className="mt-1 block text-[10px] text-gray-400">{tDynamic('Quanto tempo você precisa entre "agora" e o horário agendado mais próximo, pra dar tempo de preparar.')}</span>
              </label>
            )}
          </div>

          <div data-tour="tour-loja-efi-payee" className="rounded-2xl border border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 p-4">
            <h3 className="mb-1 text-sm font-bold text-[var(--cor-primaria)]">{tDynamic('Cartão de crédito direto na sua conta (Identificador Efí)')}</h3>
            <p className="mb-4 text-xs text-gray-600 dark:text-gray-300">
              {tDynamic('Com este código,')} <b>cada venda no cartão é repassada 100% para a sua conta Efí automaticamente</b>.
              Ele <b>não é o número da conta nem agência</b> — é o "Identificador de conta" da Efí, um código público
              e seguro que só serve para receber.
            </p>
            {renderCampo('Código Payee Code (32 caracteres)', 'efi_payee_code', 'Ex: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d')}
            
            <div className="mt-6 rounded-xl bg-gray-900 p-5 shadow-sm border border-gray-800 text-white">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Monitor size={16} className="text-[var(--cor-primaria)]" /> 
                {tDynamic('Onde encontro isso na Efí Bank? (Pelo Computador)')}
              </h4>
              
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                {/* Passo 1 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">1</div>
                  <p className="text-xs text-gray-300 mb-3">{tDynamic('No menu lateral esquerdo, desça e clique em')} <b className="text-white">API</b>.</p>
                  <div className="rounded border border-gray-700 bg-[#1e1e1e] p-2 flex flex-col gap-2 opacity-80">
                    <div className="h-2 w-12 bg-gray-600 rounded"></div>
                    <div className="h-2 w-16 bg-gray-600 rounded"></div>
                    <div className="flex items-center gap-2 bg-gray-700/50 p-1.5 rounded">
                      <div className="h-3 w-3 rounded-sm border border-gray-500"></div>
                      <span className="text-[10px] font-mono text-gray-200">API</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center text-gray-600"><ArrowRight size={20} /></div>

                {/* Passo 2 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">2</div>
                  <p className="text-xs text-gray-300 mb-3">{tDynamic('Lá em cima, no canto superior direito, clique em')} <b className="text-white">{tDynamic('Identificador de conta')}</b>.</p>
                  <div className="rounded border border-gray-700 bg-[#1e1e1e] p-2 flex justify-end opacity-80">
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                      <Shield size={12} /> {tDynamic('Identificador de conta')}
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center text-gray-600"><ArrowRight size={20} /></div>

                {/* Passo 3 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">3</div>
                  <p className="text-xs text-gray-300 mb-3">{tDynamic('Copie o código')}<b className="text-white">payee_code</b> e cole aqui em cima!</p>
                  <div className="rounded border border-gray-600 bg-[#252525] p-3 shadow-lg">
                    <p className="text-[10px] font-bold text-white mb-2">{tDynamic('Identificador de conta')}</p>
                    <div className="flex items-center justify-between border-b border-gray-600 pb-1">
                      <span className="text-[9px] text-gray-400">payee_code</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-white">f03566adf9b0...</span>
                        <Copy size={10} className="text-cyan-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Repasse do Pix — a Efí exige CPF/CNPJ do titular + número da conta (não usa payee_code) */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <Shield size={14} /> {tDynamic('Pix direto na sua conta Efí')}
            </h3>
            <p className="mb-4 text-xs text-gray-600 dark:text-gray-300">
              {tDynamic('Para o dinheiro do')} <b>Pix</b> cair automaticamente na sua conta, a Efí pede só dois dados do
              <b> titular da conta</b> — nada técnico. Você encontra o número da sua conta no app da Efí em
              <b> {tDynamic('Perfil → Dados da conta')}</b>.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {renderCampo('CPF ou CNPJ do titular da conta', 'efi_titular_documento', 'ex: 12.345.678/0001-90')}
              {renderCampo('Número da conta Efí (só números)', 'efi_conta', 'ex: 1234567')}
            </div>

            {/* Selo do veredito do Efí. Nunca diz "conta verificada": o Efí
                aceitar o favorecido não prova a titularidade. A confirmação
                definitiva é o split_status de uma cobrança real. */}
            {(validandoRepasse || repasse) && (
              <div
                className={
                  'mt-3 flex items-start gap-2 rounded-xl p-3 text-[11px] ' +
                  (validandoRepasse
                    ? 'bg-gray-500/10 text-gray-600 dark:text-gray-300'
                    : repasse?.status === 'aceito'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : repasse?.status === 'recusado'
                        ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300')
                }
              >
                {validandoRepasse ? (
                  <span>{tDynamic('Conferindo os dados do repasse no Efí…')}</span>
                ) : repasse?.status === 'aceito' ? (
                  <span><b>{tDynamic('O Efí aceitou este favorecido.')}</b> {repasse.detalhe}</span>
                ) : repasse?.status === 'recusado' ? (
                  <span><b>{tDynamic('O Efí recusou estes dados — o repasse não vai funcionar.')}</b> {repasse.detalhe}</span>
                ) : repasse?.status === 'nao_configurado' ? (
                  <span>{tDynamic('Sem dados de repasse: cada venda no Pix fica na conta da plataforma até o repasse manual.')}</span>
                ) : (
                  <span><b>{tDynamic('Não deu para confirmar no Efí agora.')}</b> {repasse?.detalhe}</span>
                )}
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-[11px] text-gray-600 dark:text-gray-300">
                {tDynamic('Preenchendo os dois campos,')} <b>cada venda no Pix é repassada 100% para a sua conta na hora</b>.
                Se ficarem em branco, o valor entra na conta da plataforma e o repasse é feito manualmente.
              </p>
            </div>
          </div>

          {/* Quando o dinheiro cai + antecipação do crédito */}
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold dark:text-gray-100">
              <Clock size={14} className="text-[var(--cor-primaria)]" /> {tDynamic('Quando o dinheiro cai na conta?')}
            </h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">PIX</span>
                <p><b>Na hora.</b> {tDynamic('O repasse é imediato assim que o cliente paga. Tarifa Efí:')} <b>{EFI_TARIFAS.pix}</b> por venda recebida.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">CRÉDITO</span>
                <p>
                  <b>{tDynamic('Depende da modalidade escolhida abaixo.')}</b> {tDynamic('À vista a tarifa Efí é')} <b>{EFI_TARIFAS.creditoAVista}</b>;
                  no parcelado, a tarifa e o prazo mudam conforme a opção.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-gray-700 dark:text-gray-200">⚡ Escolha como quer receber o crédito:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, antecipacao_cartao: false }))}
                  className={`rounded-xl border-2 p-3.5 text-left transition ${!form.antecipacao_cartao
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
                  <p className="flex items-center gap-2 text-sm font-bold dark:text-gray-100">
                    Prazo padrão
                    {!form.antecipacao_cartao && <Check size={14} className="text-[var(--cor-primaria)]" />}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Recebe <b>uma parcela a cada ~31 dias</b>.
                  </p>
                  <p className="mt-2 rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] font-semibold leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {tDynamic('Tarifa Efí: à vista')} <b>{EFI_TARIFAS.creditoAVista}</b> · 2–6x <b>{EFI_TARIFAS.creditoParcelado2a6}</b> · 7–12x <b>{EFI_TARIFAS.creditoParcelado7a12}</b>
                  </p>
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, antecipacao_cartao: true }))}
                  className={`rounded-xl border-2 p-3.5 text-left transition ${form.antecipacao_cartao
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
                  <p className="flex items-center gap-2 text-sm font-bold dark:text-gray-100">
                    Antecipado ⚡
                    {form.antecipacao_cartao && <Check size={14} className="text-amber-500" />}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Recebe o <b>valor total em ~2 dias úteis</b>, mesmo em vendas parceladas.
                  </p>
                  <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1.5 text-[10px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Tarifa Efí: <b>{EFI_TARIFAS.creditoAVista}</b> + <b>{EFI_TARIFAS.antecipacaoPorParcela} por parcela antecipada</b>
                  </p>
                </button>
              </div>
              {!antecipacaoDisponivel && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                  {tDynamic('A antecipação ainda não está contratada na conta da plataforma. Enquanto isso, mesmo marcando esta opção o cartão é processado na modalidade padrão, com repasse em até 31 dias — e cada cobrança fica registrada com esse aviso.')}
                </p>
              )}
              <p className="mt-2 text-[10px] text-gray-400">
                {tDynamic('A escolha vale para as')} <b>próximas</b> vendas no cartão — o que já foi vendido mantém o prazo original.
                {' '}Tarifas da tabela pública da Efí ({EFI_TARIFAS.referencia}), negociáveis por volume — confira em{' '}
                <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="font-semibold underline">sejaefi.com.br/tarifas</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {aba === 'fiscal' && (
        <FiscalOnboarding 
          lojaId={lojaId}
          documentoLoja={form.cnpj}
          nfeHabilitado={form.nfe_habilitado}
          nfeAmbiente={form.nfe_ambiente}
          nfeRegime={form.nfe_regime_tributario}
          nfeIe={form.nfe_inscricao_estadual}
          nfeIdCsc={form.nfe_id_csc}
          nfeCsc={form.nfe_csc}
          onSuccess={() => {
            // Recarrega os dados pra garantir o state original atualizado
            supabase.from('lojas').select('*').eq('id', lojaId).single().then(({ data }) => {
              if (data) {
                setForm(f => ({
                  ...f,
                  nfe_habilitado: data.nfe_habilitado,
                  nfe_ambiente: data.nfe_ambiente,
                  nfe_regime_tributario: data.nfe_regime_tributario,
                  nfe_inscricao_estadual: data.nfe_inscricao_estadual,
                  nfe_id_csc: data.nfe_id_csc,
                  nfe_csc: data.nfe_csc
                }));
              }
            });
          }}
        />
      )}

      {aba === 'ifood' && (
        <IfoodOnboarding 
          lojaId={lojaId}
          form={form}
          setValor={setValor}
          onSuccess={() => {
            supabase.from('lojas').select('ifood_merchant_id').eq('id', lojaId).single().then(({ data }) => {
              if (data) setForm(f => ({ ...f, ifood_merchant_id: data.ifood_merchant_id }));
            });
          }}
        />
      )}

      {erro && <p className="mt-3 text-sm font-medium text-red-500">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white disabled:opacity-40">
        {ok ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> {salvando ? 'Salvando…' : 'Salvar alterações'}</>}
      </button>
    </div>
  );
}

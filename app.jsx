const { useState, useEffect, useMemo, useRef } = React;
const { collectIssues, prepareSubmission } = window.BriefingRules;
const { brand: BRAND, operation: OPERATION, storage: STORAGE } = window.EventSystem.config;
const GUIDANCE = 'Preciso de orientação';
const REQUEST_STATUS_LABELS = {received:'Recebida', needs_information:'Aguardando informações', quoting:'Em cotação', proposal_sent:'Proposta enviada', completed:'Concluída', analysis:'Em análise',proposal:'Proposta disponível',closed:'Finalizada'};
const DEMO_USER = window.PAYTRACK_USER || null;
const DRAFT_KEY = STORAGE.draftPrefix + (DEMO_USER?.companyId || 'guest');
const ATTEMPT_KEY = STORAGE.attemptPrefix + (DEMO_USER?.companyId || 'guest');

/* ═══════════════════════════════════════════════════════════
   PAÍSES INTERNACIONAIS
   ═══════════════════════════════════════════════════════════ */
const INTERNATIONAL_COUNTRIES = [
  'Estados Unidos (EUA)', 'Portugal', 'Argentina', 'Espanha', 'Chile', 'França',
  'Itália', 'Alemanha', 'Reino Unido (Inglaterra)', 'Uruguai', 'México', 'Colômbia',
  'Canadá', 'Suíça', 'Holanda', 'Emirados Árabes Unidos (Dubai)', 'Panamá', 'Paraguai',
  'Peru', 'África do Sul', 'Austrália', 'Japão', 'China'
];

/* ═══════════════════════════════════════════════════════════
   FUNÇÕES UTILITÁRIAS
   ═══════════════════════════════════════════════════════════ */
function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatCNPJ(v) {
  const n = (v || '').replace(/\D/g, '').slice(0, 14);
  return n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(v) {
  const n = (v || '').replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n.replace(/^(\d{0,2})/, '($1');
  if (n.length <= 7) return n.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}



function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ═══════════════════════════════════════════════════════════
   ESTADO INICIAL
   ═══════════════════════════════════════════════════════════ */
const INITIAL_STATE = {
  // Etapa 1 – Empresa & Solicitante
  companyName: '',
  cnpj: '',
  requesterName: '',
  requesterRole: '',
  email: '',
  phone: '',
  costCenter: '',
  costCenterNotApplicable: false,
  extraBillingType: '',

  // Etapa 2 – Evento
  eventName: '',
  totalPassengers: '',
  participantsUnknown: false,
  participantsEstimated: false,
  datesUnknown: false,
  datesFlexible: false,
  aereoGuidance: false,
  hospedagemGuidance: false,
  espacoGuidance: false,
  transfersGuidance: false,
  destination: '',
  departureDate: '',
  returnDate: '',

  // Serviços selecionados (cards)
  svcAereo: false,
  svcHospedagem: false,
  svcEspacoAlimentacao: false,
  svcTransfers: false,

  // Etapa Aéreo
  airlinePreference: '',
  specificAirline: '',
  restrictedAirline: '',
  departureTimes: [],
  returnTimes: [],
  cabinClass: '',
  cabinClassNotes: '',
  flightConnection: '',
  maxLayoverHours: '',
  baggageType: '',
  aereoNotes: '',

  // Etapa Hospedagem
  hotelStandard: '',
  hotelLocationPref: '',
  eventAddress: '',
  hotelLocationOther: '',
  roomsSingle: '',
  roomsDoubleTwin: '',
  roomsDoubleCasal: '',
  roomsTriple: '',
  mealRegime: '',
  roomingList: '',
  hospedagemNotes: '',

  // Etapa Espaço & Alimentação (Salas + A&B)
  plenaryCapacity: '',
  roomLayout: '',
  roomLayoutOther: '',
  breakoutRoomsCount: '',
  avServices: [],
  avOtherNotes: '',
  cateringServices: [],
  coffeeBreakPerDay: '',
  espacoAlimentacaoNotes: '',

  // Etapa Transfer
  transferTypes: [],
  vehicleType: '',
  dedicatedVehicleHoursDays: '',
  transfersNotes: '',

  // Geral
  generalNotes: '',
  desiredBudget: DEMO_USER?.preferences?.budget || '',
};

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: AUTOCOMPLETE LIMPO (5.571 CIDADES IBGE + PAÍSES)
   ═══════════════════════════════════════════════════════════ */
function CityAutocomplete({ value, onChange, hasError, inputId }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  const allLocations = useMemo(() => {
    const list = window.BRAZIL_CITIES && Array.isArray(window.BRAZIL_CITIES)
      ? window.BRAZIL_CITIES
      : ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Curitiba - PR', 'Porto Alegre - RS', 'Salvador - BA', 'Brasília - DF', 'Fortaleza - CE', 'Recife - PE', 'Florianópolis - SC', 'Goiânia - GO', 'Imperatriz - MA'];
    return [...list, ...INTERNATIONAL_COUNTRIES];
  }, []);

  const suggestions = useMemo(() => {
    if (!query || query.trim().length < 2) return [];
    const q = norm(query);
    const results = [];
    for (let i = 0; i < allLocations.length; i++) {
      const loc = allLocations[i];
      if (norm(loc).includes(q)) {
        results.push(loc);
        if (results.length >= 10) break;
      }
    }
    return results;
  }, [query, allLocations]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (text) => {
    setQuery(text);
    onChange(text);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <i data-lucide="map-pin" className="w-4 h-4"></i>
        </span>
        <input
          id={inputId}
          value={query}
          onChange={e => {
            const v = e.target.value;
            setQuery(v);
            onChange(v);
            setOpen(v.trim().length >= 2);
          }}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKey}
          placeholder="Digite a cidade (ex: Imperatriz, São Paulo...) ou país"
          className={`w-full pl-10 pr-4 py-2.5 text-sm border rounded-xl bg-white placeholder:text-slate-400
            ${hasError ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((loc, i) => (
            <button
              key={loc}
              type="button"
              onClick={() => select(loc)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors
                ${i === activeIdx ? 'bg-pt-blue1/10 text-pt-blue1 font-semibold' : 'hover:bg-slate-50 text-slate-800'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-pt-blue1/60"><i data-lucide="map-pin" className="w-3.5 h-3.5"></i></span>
                <span>{loc}</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">Selecionar</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: CARD DE SELEÇÃO DE SERVIÇOS
   ═══════════════════════════════════════════════════════════ */
function PlanningOption({ checked, onChange, children, disabled = false }) {
  return <label className="planning-option"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>;
}

function ServiceCard({ icon, title, desc, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group
        ${selected
          ? 'border-pt-yellow1 bg-pt-blue1 text-white shadow-pt-glow scale-[1.01]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
    >
      <div className="flex items-start gap-3.5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
          ${selected ? 'bg-pt-yellow1/20' : 'bg-pt-blue1/5 group-hover:bg-pt-blue1/10'}`}>
          <span className={selected ? 'text-pt-yellow1' : 'text-pt-blue1'}>
            <i data-lucide={icon} className="w-5 h-5"></i>
          </span>
        </div>
        <div className="flex-1 pr-6">
          <h3 className={`font-bold text-sm ${selected ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          <p className={`text-xs mt-1 leading-relaxed ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{desc}</p>
        </div>
      </div>
      {selected && (
        <div className="absolute top-4 right-4">
          <div className="w-6 h-6 bg-pt-yellow1 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-3.5 h-3.5 text-pt-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: CAMPO DE OBSERVAÇÕES ADICIONAIS
   ═══════════════════════════════════════════════════════════ */
function NotesField({ value, onChange, label, placeholder }) {
  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="mb-2 flex items-center gap-2">
        
        <label className="text-sm font-extrabold text-slate-900 tracking-tight">
          {label || 'Observações Adicionais'}
        </label>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder || 'Alguma observação importante, restrição, necessidade especial ou detalhe para esta parte?'}
        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl resize-none placeholder:text-slate-400 bg-white"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: TÍTULO DE SEÇÃO COM DESTAQUE
   ═══════════════════════════════════════════════════════════ */
function PencilIcon() {
  return <svg className="edit-pencil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 16 16 4a3.5 3.5 0 0 1 5 5L9 21H3z" /></svg>;
}

function SectionTitle({ title, subtitle, icon }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-pt-blue1"><i data-lucide={icon} className="w-4 h-4"></i></span>}
        
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: BOTÃO PILL SELECIONÁVEL
   ═══════════════════════════════════════════════════════════ */
function PillOption({ label, checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-1.5
        ${checked
          ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm ring-1 ring-pt-blue1'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
    >
      {checked && (
        <svg className="w-3.5 h-3.5 text-pt-yellow1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: TOAST NOTIFICATION
   ═══════════════════════════════════════════════════════════ */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = type === 'success'
    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
    : type === 'error'
    ? 'bg-red-50 border-red-300 text-red-900'
    : 'bg-pt-blue1 text-white border-pt-blue2';

  return (
    <div className={`fixed bottom-6 right-6 z-[999] toast-enter border rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3.5 max-w-md ${colors}`}>
      <span className="flex-shrink-0">
        <i data-lucide={type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-triangle' : 'info'} className="w-5 h-5"></i>
      </span>
      <span className="text-sm font-semibold leading-snug">{message}</span>
      <button type="button" onClick={onClose} className="ml-auto opacity-60 hover:opacity-100 p-1">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ERROR BOUNDARY PARA EVITAR TELA BRANCA
   ═══════════════════════════════════════════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md">
            <h2 className="text-lg font-bold text-pt-blue1 mb-2">Houve uma atualização na tela</h2>
            <p className="text-sm text-slate-500 mb-5">Clique no botão abaixo para restaurar o formulário com segurança.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-5 py-2.5 bg-pt-blue1 text-white rounded-xl text-sm font-bold shadow-md hover:bg-pt-blue2"
            >
              Recarregar Formulário
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ═══════════════════════════════════════════════════════════
   APLICAÇÃO PRINCIPAL: APP
   ═══════════════════════════════════════════════════════════ */
function App() {
  const [creatingBriefing, setCreatingBriefing] = useState(
    () => !!DEMO_USER && new URLSearchParams(location.search).get('novo') === '1'
  );
  const [newEventName, setNewEventName] = useState('');
  const [creationError, setCreationError] = useState('');
  const [form, setForm] = useState(() => {
    try {
      const saved = DEMO_USER ? localStorage.getItem(DRAFT_KEY) : null;
      return { ...INITIAL_STATE, ...(saved ? JSON.parse(saved) : {}), ...(DEMO_USER ? {companyName:DEMO_USER.companyName,cnpj:DEMO_USER.companyCnpj || '',requesterName:DEMO_USER.name,email:DEMO_USER.email} : {}) };
    } catch {
      return { ...INITIAL_STATE, ...(DEMO_USER ? {companyName:DEMO_USER.companyName,cnpj:DEMO_USER.companyCnpj || '',requesterName:DEMO_USER.name,email:DEMO_USER.email} : {}) };
    }
  });

  const [legacyDraft, setLegacyDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saving');
  const [remoteDraftMessage,setRemoteDraftMessage]=useState('');
  const [remoteDraftSaving,setRemoteDraftSaving]=useState(false);
  const saveAccountDraft=async()=>{
    if(remoteDraftSaving)return;setRemoteDraftSaving(true);setRemoteDraftMessage('');
    try{
      const current=await fetch('/api/draft',{cache:'no-store'});const snapshot=await current.json();if(!current.ok)throw Error(snapshot.error||'Não foi possível consultar o rascunho.');
      if(snapshot.draft&&!window.confirm('Substituir o rascunho salvo na sua conta por este preenchimento?'))return;
      const response=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:snapshot.draft?.revision||0,expectedUserId:DEMO_USER.id,form:prepareSubmission(form)})});const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível salvar.');
      setRemoteDraftMessage('Rascunho salvo na sua conta. Você pode retomá-lo pelo portal.');
    }catch(error){setRemoteDraftMessage(error.message);}finally{setRemoteDraftSaving(false);}
  };

  const [apiStatus, setApiStatus] = useState('checking');
  const [registration, setRegistration] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const submissionLock = useRef(false);
  const submissionAttempt = useRef(null);
  if (!submissionAttempt.current) {
    try {
      const attempt = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY));
      if (attempt && typeof attempt.key === 'string' && /^[A-Za-z0-9-]{16,128}$/.test(attempt.key) && typeof attempt.payload === 'string' && attempt.payload.length < 131072) submissionAttempt.current = attempt;
    } catch { /* A tentativa continua em memória se a sessão não estiver disponível. */ }
  }
  const issues = useMemo(() => collectIssues(form, getTodayString()), [form]);
  useEffect(() => {
    if (!['http:', 'https:'].includes(location.protocol) || document.querySelector('meta[name="paytrack-standalone"]')) { setApiStatus('offline'); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch('/api/health', { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(data => setApiStatus(data.mode === 'local' && data.registration === true ? 'ready' : 'offline')).catch(() => setApiStatus('offline')).finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const [stepIdx, setStepIdx] = useState(0);

  const [started, setStarted] = useState(!!DEMO_USER);
  const [launching, setLaunching] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const [stepLeaving, setStepLeaving] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);
  const [focusMessage, setFocusMessage] = useState('');
  const stepTimer = useRef(null);
  const unlockTimer = useRef(null);
  const quoteCardRef = useRef(null);
  useEffect(() => () => {
    clearTimeout(stepTimer.current);
    clearTimeout(unlockTimer.current);
  }, []);
  const launchTimer = useRef(null);
  useEffect(() => () => clearTimeout(launchTimer.current), []);
  const startQuote = () => {
    if (launching) return;
    const destination = '/portal.html?acao=nova-cotacao';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { location.assign(destination); return; }
    setLaunching(true);
    launchTimer.current = setTimeout(() => location.assign(destination), 450);
  };
  useEffect(() => {
    if (!DEMO_USER) return;
    const check = () => fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(r.user?.id!==DEMO_USER.id) location.replace('/portal.html');}).catch(()=>{});
    window.addEventListener('focus',check);
    return () => window.removeEventListener('focus',check);
  }, []);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSending, setIsSending] = useState(false);
  const isTransitioningRef = useRef(false);

  const todayStr = useMemo(() => getTodayString(), []);

  // Salvar rascunho isolado por empresa.
  useEffect(() => {
    if (!DEMO_USER || creatingBriefing) return;
    setDraftStatus('saving');
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({...form, _legacyUnconfirmed: legacyDraft}));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('unavailable');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form, legacyDraft, creatingBriefing]);

  useEffect(() => {
    const card = quoteCardRef.current;
    if (!card) return;
    card.querySelectorAll('input,select,textarea').forEach(control => {
      const issue = issues.find(item => item.fieldId === control.id);
      if (issue && errors[issue.field]){control.setAttribute('aria-invalid','true');const message=Array.from(control.parentElement.querySelectorAll('p')).find(p=>p.textContent===errors[issue.field]);if(message){message.id=control.id+'-error';control.setAttribute('aria-describedby',message.id);}} 
      else control.removeAttribute('aria-invalid');
    });
  }, [issues, errors, stepIdx]);

  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{const inset=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);document.documentElement.style.setProperty('--keyboard-inset',inset+'px');if(inset>0&&quoteCardRef.current?.contains(document.activeElement))document.activeElement.scrollIntoView({block:'center'});};viewport.addEventListener('resize',update);return()=>{viewport.removeEventListener('resize',update);document.documentElement.style.removeProperty('--keyboard-inset');};},[]);
  // Atualizar ícones do Lucide com segurança
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      } catch (e) {
        console.warn('Lucide icon render error:', e);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [stepIdx, started]);

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSubmitError('');
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const toggleArr = (field, value) => {
    setForm(prev => {
      const arr = prev[field] || [];
      const selected = arr.includes(value);
      const values = ['departureTimes','returnTimes'].includes(field) && !selected
        ? value === 'Qualquer Horário' ? [value] : [...arr.filter(item => item !== 'Qualquer Horário'), value]
        : selected ? arr.filter(item => item !== value) : [...arr, value];
      return { ...prev, [field]: values };
    });
  };

  /* ───── ETAPAS DINÂMICAS ───── */
  const steps = useMemo(() => {
    const s = [
      { id: 'evento',  label: 'Evento',  icon: 'calendar-check' },
    ];
    if (form.svcAereo)              s.push({ id: 'aereo',      label: 'Aéreo',      icon: 'plane' });
    if (form.svcHospedagem)         s.push({ id: 'hospedagem', label: 'Hospedagem', icon: 'hotel' });
    if (form.svcEspacoAlimentacao)  s.push({ id: 'espaco',     label: 'Espaços e alimentação', icon: 'presentation' });
    if (form.svcTransfers)          s.push({ id: 'transfers',  label: 'Transfer',   icon: 'bus' });
    s.push({ id: 'empresa', label: 'Empresa', icon: 'building-2' });
    s.push({ id: 'revisao', label: 'Revisão & Envio', icon: 'check-circle-2' });
    return s;
  }, [form.svcAereo, form.svcHospedagem, form.svcEspacoAlimentacao, form.svcTransfers]);

  // Guarda rigorosa contra índice fora dos limites
  const safeStepIdx = Math.max(0, Math.min(stepIdx, steps.length - 1));
  const currentStep = steps[safeStepIdx] || steps[0];

  // Aguarda a montagem e a entrada do conteúdo antes de localizar o campo.
  useEffect(() => {
    if (!focusRequest || stepLeaving) return;
    let highlighted;
    let clearHighlight;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      const card = quoteCardRef.current;
      const target = card?.querySelector('[id="' + focusRequest.id + '"]') || card;
      if (!target) return;
      for (let ancestor = target.parentElement; ancestor && ancestor !== card; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      }
      if (focusRequest.highlight !== false) {
        highlighted = target;
        target.classList.add('field-spotlight');
      }
      target.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block: 'center'});
      const control = target.matches('input, select, textarea, button')
        ? target : target.querySelector('input:not(:disabled), select, textarea, button:not(:disabled)') || card.querySelector('input:not(:disabled), select, textarea, button:not(:disabled)');
      if (focusRequest.highlight !== false) control?.focus({preventScroll: true});
      if (focusRequest.focusHeading) {
        target.setAttribute('tabindex', '-1');
        target.focus({preventScroll: true});
      }
      setFocusMessage('Localizado: ' + focusRequest.label);
      if (highlighted) clearHighlight = setTimeout(() => target.classList.remove('field-spotlight'), 2400);
    }, reduceMotion ? 0 : 480);
    return () => {
      clearTimeout(timer);
      clearTimeout(clearHighlight);
      highlighted?.classList.remove('field-spotlight');
    };
  }, [focusRequest, currentStep.id, stepLeaving]);

  /* ───── CÁLCULO SEGURO DE DIAS DA VIAGEM ───── */
  const tripDays = useMemo(() => {
    if (form.datesUnknown || !form.departureDate || !form.returnDate) return null;
    const d1 = new Date(form.departureDate + 'T00:00:00');
    const d2 = new Date(form.returnDate + 'T00:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    const diff = d2 - d1;
    if (diff < 0) return 'Data de volta menor que data de ida';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return `${days} dia(s)`;
  }, [form.departureDate, form.returnDate, form.datesUnknown]);

  /* ───── CALCULADOR DE VAGAS E QUARTOS ───── */
  const accommodationCalc = useMemo(() => {
    const s = parseInt(form.roomsSingle, 10) || 0;
    const dt = parseInt(form.roomsDoubleTwin, 10) || 0;
    const dc = parseInt(form.roomsDoubleCasal, 10) || 0;
    const t = parseInt(form.roomsTriple, 10) || 0;
    const totalRooms = s + dt + dc + t;
    const totalCapacity = (s * 1) + (dt * 2) + (dc * 2) + (t * 3);
    return { totalRooms, totalCapacity };
  }, [form.roomsSingle, form.roomsDoubleTwin, form.roomsDoubleCasal, form.roomsTriple]);

  const capacityDiff = useMemo(() => {
    const pax = parseInt(form.totalPassengers, 10) || 0;
    if (form.participantsUnknown || !pax || !accommodationCalc.totalCapacity) return null;
    return accommodationCalc.totalCapacity - pax;
  }, [form.totalPassengers, form.participantsUnknown, accommodationCalc]);

  /* ───── VALIDAÇÃO DE CAMPOS COM BLOQUEIO DE DATAS PASSADAS ───── */
  // Navegação livre nesta versão de demonstração.
  const transitionTo = (target, returnToReview = false, focusTarget = null) => {
    if (isTransitioningRef.current || target < 0 || target >= steps.length) return;
    if (target === safeStepIdx) {
      setSummaryOpen(false);
      if (focusTarget) setFocusRequest({...focusTarget});
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isTransitioningRef.current = true;
    setSlideDirection(target > safeStepIdx ? 1 : -1);
    setStepLeaving(!reduceMotion);
    setSummaryOpen(false);
    stepTimer.current = setTimeout(() => {
      setStepIdx(target);
      setEditingFromReview(returnToReview);
      setStepLeaving(false);
      setFocusRequest(focusTarget ? {...focusTarget} : null);
      if (!focusTarget && quoteCardRef.current?.getBoundingClientRect().top < 0) {
        quoteCardRef.current.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block: 'start'});
      }
      unlockTimer.current = setTimeout(() => { isTransitioningRef.current = false; }, reduceMotion ? 0 : 460);
    }, reduceMotion ? 0 : 160);
  };
  const goNext = () => transitionTo(editingFromReview ? steps.length - 1 : safeStepIdx + 1);
  const goPrev = () => transitionTo(editingFromReview ? steps.length - 1 : safeStepIdx - 1);
  const editStep = (id, fieldId, label) => {
    const defaults = {
      evento: ['event-name', 'Nome do evento'],
      empresa: ['company-name', 'Organização'],
      aereo: ['section-heading', 'Aéreo'],
      hospedagem: ['section-heading', 'Hospedagem'],
      espaco: ['section-heading', 'Salas e A&B'],
      transfers: ['section-heading', 'Transfers']
    };
    const target = defaults[id] || ['section-heading', 'Seção'];
    setFocusMessage('');
    transitionTo(steps.findIndex(step => step.id === id),
      currentStep.id === 'revisao' || editingFromReview,
      {id: fieldId || target[0], label: label || target[1], highlight: (fieldId || target[0]) !== 'section-heading'});
  };
  const editLink = (id, label) => (
    <button type="button" className="brief-edit" onClick={() => editStep(id)} aria-label={'Editar ' + label}>Editar <PencilIcon /></button>
  );
  const formatBriefDate = (value) => {
    if (!value) return 'A definir';
    const parts = value.split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : value;
  };
  const selectedServices = [
    form.svcAereo && {id:'aereo', label:'Aéreo'},
    form.svcHospedagem && {id:'hospedagem', label:'Hospedagem'},
    form.svcEspacoAlimentacao && {id:'espaco', label:'Salas e A&B'},
    form.svcTransfers && {id:'transfers', label:'Transfers'}
  ].filter(Boolean);
  const guidanceLabels = [['svcAereo','aereoGuidance','aéreo'],['svcHospedagem','hospedagemGuidance','hospedagem'],['svcEspacoAlimentacao','espacoGuidance','espaços e alimentação'],['svcTransfers','transfersGuidance','transfers']].filter(([service,flag]) => form[service] && form[flag]).map(([, ,label]) => label);
  const coffeeCaption = value => ['1','2','3'].includes(value) ? value + 'x por dia' : value || 'A definir';
  const roomsProvided = ['roomsSingle','roomsDoubleTwin','roomsDoubleCasal','roomsTriple'].some(field => form[field] !== '');
  const roomsCaption = roomsProvided ? accommodationCalc.totalRooms + ' quartos (' + accommodationCalc.totalCapacity + ' pessoas)' : 'Distribuição de quartos a definir';
  const participantCaption = form.participantsUnknown ? 'Quantidade ainda não definida' : form.totalPassengers ? (form.participantsEstimated ? 'Aproximadamente ' : '') + form.totalPassengers + ' pessoas' : 'Quantidade não informada';
  const periodCaption = form.datesUnknown ? 'Datas ainda não definidas' : !form.departureDate && !form.returnDate ? 'Datas não informadas' : formatBriefDate(form.departureDate) + ' — ' + formatBriefDate(form.returnDate) + (form.datesFlexible ? ' (datas flexíveis)' : '');
  const guidanceOption = (field, label) => <div className="guidance-option"><PlanningOption checked={form[field]} onChange={value => set(field,value)}>Preciso de orientação para definir {label}.</PlanningOption><p>Preencha o que já sabe. As preferências em branco ficam como “A definir”.</p></div>;
  const locateIssue = issue => {
    setErrors(Object.fromEntries(issues.map(item => [item.field,item.message])));
    editStep(issue.step, issue.fieldId, issue.label);
  };
  const registerRequest = async () => {
    if (submissionLock.current) return;
    setSubmitError('');
    if (issues.length) { locateIssue(issues[0]); return; }
    if (apiStatus !== 'ready') { setSubmitError('O registro local está indisponível. Inicie o servidor local; você também pode salvar o PDF.'); return; }
    const payload = JSON.stringify(prepareSubmission(form));
    if (!submissionAttempt.current || submissionAttempt.current.payload !== payload) submissionAttempt.current = { payload, key: crypto.randomUUID() };
    try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(submissionAttempt.current)); } catch { /* Repetições ficam protegidas nesta página. */ }
    submissionLock.current = true; setIsSending(true);
    try {
      const response = await fetch('/api/quotes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key:submissionAttempt.current.key,form:JSON.parse(payload),summary:generateSummaryText()}), signal:AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) { location.assign('/portal.html'); return; }
        if (data.errors) setErrors(data.errors);
        throw new Error(response.status === 422 ? 'Revise as informações indicadas. O registro não foi concluído.' : 'Não foi possível registrar agora. Tente novamente; seu briefing foi mantido.');
      }
      if (!data.protocol || !data.id) throw new Error('A confirmação recebida está incompleta. Tente novamente.');
      setRegistration({...data,createdAt:data.created});
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(ATTEMPT_KEY);
    } catch (error) { setSubmitError(error.name === 'TimeoutError' ? 'O servidor demorou a responder. Tente novamente com os mesmos dados para consultar ou concluir o registro sem duplicá-lo.' : error.message === 'Failed to fetch' ? 'Não foi possível conectar ao servidor local. Mantenha-o aberto e tente novamente.' : error.message); }
    finally { submissionLock.current = false; setIsSending(false); }
  };
  const checkRegistration = async () => {
    setCheckingRegistration(true); setSubmitError('');
    try {
      const response = await fetch('/api/quotes/' + encodeURIComponent(registration.id), { signal:AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Não foi possível consultar o registro local.');
      const data = await response.json();
      setRegistration(previous => ({...previous,...data}));
    } catch { setSubmitError('Não foi possível consultar agora. Verifique se o servidor local está aberto.'); }
    finally { setCheckingRegistration(false); }
  };
  /* ───── RESUMO ESTRUTURADO DE TEXTO ───── */
  const generateSummaryText = () => {
    const summaryForm = prepareSubmission(form);
    let txt = `════════════════════════════════════════════
  ${BRAND.name.toUpperCase()} – SOLICITAÇÃO DE EVENTO
════════════════════════════════════════════

*1. DADOS DA EMPRESA E SOLICITANTE:*
• Empresa: ${summaryForm.companyName || '-'}
• CNPJ: ${summaryForm.cnpj || '-'}
• Solicitante: ${summaryForm.requesterName || '-'} | Cargo: ${summaryForm.requesterRole || '-'}
• E-mail: ${summaryForm.email || '-'}
• Telefone/WhatsApp: ${summaryForm.phone || '-'}
• Centro de Custo / Projeto: ${summaryForm.costCenterNotApplicable ? 'Não se aplica' : (summaryForm.costCenter || '-')}
• Forma de Pagamento Extras: ${summaryForm.extraBillingType || 'A definir'}

*2. VISÃO GERAL DO EVENTO:*
• Nome do Evento: ${summaryForm.eventName || '-'}
• Total de Participantes: ${participantCaption}
• Destino: ${summaryForm.destination || '-'}
• Período: ${periodCaption}
• Serviços Contratados: ${[
      summaryForm.svcAereo && 'Passagens Aéreas',
      summaryForm.svcHospedagem && 'Hospedagem',
      summaryForm.svcEspacoAlimentacao && 'Salas de Eventos & Alimentação (A&B)',
      summaryForm.svcTransfers && 'Transfer'
    ].filter(Boolean).join(', ') || 'Nenhum'}`;

    if (summaryForm.svcAereo) {
      txt += `

*3. TRANSPORTE AÉREO:*
• Companhia Aérea: ${summaryForm.airlinePreference || 'A definir'}${summaryForm.specificAirline ? ` (Cia: ${summaryForm.specificAirline})` : ''}${summaryForm.restrictedAirline ? ` (Restrição: ${summaryForm.restrictedAirline})` : ''}
• Horários de Ida: ${summaryForm.departureTimes.join(', ') || 'A definir'}
• Horários de Volta: ${summaryForm.returnTimes.join(', ') || 'A definir'}
• Classe da Cabine: ${summaryForm.cabinClass || 'A definir'}${summaryForm.cabinClassNotes ? ` (${summaryForm.cabinClassNotes})` : ''}
• Conexões: ${summaryForm.flightConnection || 'A definir'}${summaryForm.maxLayoverHours ? ` (máx ${summaryForm.maxLayoverHours}h)` : ''}
• Franquia de Bagagem: ${summaryForm.baggageType || 'A definir'}
• Observações do Aéreo: ${summaryForm.aereoNotes || 'Nenhuma'}`;
    }

    if (summaryForm.svcHospedagem) {
      txt += `

*4. HOSPEDAGEM & ROOMING LIST:*
• Padrão do Hotel: ${summaryForm.hotelStandard || 'A definir'}
• Localização: ${summaryForm.hotelLocationPref || 'A definir'}${summaryForm.eventAddress ? ` [Endereço: ${summaryForm.eventAddress}]` : ''}${summaryForm.hotelLocationOther ? ` (${summaryForm.hotelLocationOther})` : ''}
• Distribuição de Quartos:
  - Single: ${summaryForm.roomsSingle || 'A definir'}
  - Double Twin: ${summaryForm.roomsDoubleTwin || 'A definir'}
  - Double Casal: ${summaryForm.roomsDoubleCasal || 'A definir'}
  - Triplo: ${summaryForm.roomsTriple || 'A definir'}
• Distribuição: ${roomsCaption}
• Regime de Alimentação: ${summaryForm.mealRegime || 'A definir'}
• Rooming List Preliminar: ${summaryForm.roomingList || 'A definir / não informada'}
• Observações de Hospedagem: ${summaryForm.hospedagemNotes || 'Nenhuma'}`;
    }

    if (summaryForm.svcEspacoAlimentacao) {
      txt += `

*5. SALAS DE EVENTOS & ALIMENTAÇÃO (A&B):*
• Quantidade de Pessoas na Sala: ${summaryForm.plenaryCapacity || 'A definir'}
• Formato da Sala: ${summaryForm.roomLayout || 'A definir'}${summaryForm.roomLayoutOther ? ` (${summaryForm.roomLayoutOther})` : ''}
• Salas de Apoio: ${summaryForm.breakoutRoomsCount || 'A definir'}
• Equipamentos AV: ${summaryForm.avServices.length ? summaryForm.avServices.join(', ') : 'A definir'}${summaryForm.avOtherNotes ? ` (${summaryForm.avOtherNotes})` : ''}
• Alimentos & Bebidas: ${summaryForm.cateringServices.length ? summaryForm.cateringServices.join(', ') : 'A definir'}${summaryForm.cateringServices.includes('Coffee Break') ? ` (Coffee: ${coffeeCaption(summaryForm.coffeeBreakPerDay)})` : ''}
• Observações de Espaços e alimentação: ${summaryForm.espacoAlimentacaoNotes || 'Nenhuma'}`;
    }

    if (summaryForm.svcTransfers) {
      txt += `

*6. TRANSFER:*
• Trechos Solicitados: ${summaryForm.transferTypes.length ? summaryForm.transferTypes.join(', ') : 'A definir'}
• Tipo de Veículo: ${summaryForm.vehicleType || 'A definir'}
• Veículo à Disposição: ${summaryForm.dedicatedVehicleHoursDays || 'A definir'}
• Observações de Transfer: ${summaryForm.transfersNotes || 'Nenhuma'}`;
    }

    txt += `

*OBSERVAÇÕES GERAIS:*
${summaryForm.generalNotes || 'Nenhuma observação geral adicional.'}

────────────────────────────────────────────
*Atendimento:* ${OPERATION.contactEmail || OPERATION.contactLabel}
*Prazo de cotação:* ${OPERATION.quoteDeadline} ${OPERATION.deadlineCondition}.`;

    const guidance = [['svcAereo','aereoGuidance','aéreo'],['svcHospedagem','hospedagemGuidance','hospedagem'],['svcEspacoAlimentacao','espacoGuidance','salas e alimentação'],['svcTransfers','transfersGuidance','transfers']].filter(([service,flag])=>summaryForm[service]&&summaryForm[flag]).map(([, ,label])=>label);
    if (guidance.length) txt += '\nOrientação solicitada: ' + guidance.join(', ') + '.';
    return txt;
  };

  /* ───── AÇÕES DE TRANSMISSÃO REAIS ───── */
  const handleSendBackground = (channel) => {
    if (channel === 'whatsapp') {
      const opened = window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(generateSummaryText()), '_blank');
      if (opened) opened.opener = null;
      setToast({type: opened ? 'success' : 'error',msg: opened ? 'WhatsApp aberto. Escolha o destinatário e confirme o envio no aplicativo.' : 'O navegador bloqueou a janela. Permita pop-ups ou copie o resumo.'});
    } else {
      const subject = encodeURIComponent(`Solicitação de Evento: ${form.eventName || 'Novo Evento'} - ${form.companyName || 'Cliente'}`);
      window.location.href = `mailto:${encodeURIComponent(OPERATION.contactEmail)}?subject=${subject}&body=${encodeURIComponent(generateSummaryText())}`;
      setToast({type:'success',msg:'Abertura do aplicativo de e-mail solicitada. Revise e confirme o envio por lá.'});
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateSummaryText());
      setToast({ type: 'success', msg: '📋 Resumo copiado para a área de transferência!' });
    } catch {
      setToast({ type: 'error', msg: 'Não foi possível copiar automaticamente.' });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDERIZAÇÃO DAS ETAPAS DO WIZARD
     ═══════════════════════════════════════════════════════════ */
  const renderCurrentStep = () => {
    if (!currentStep) return null;

    switch (currentStep.id) {

    /* ────────────────────────────────────────────────────────
       ETAPA 1: DADOS DA EMPRESA & SOLICITANTE
       ──────────────────────────────────────────────────────── */
    case 'empresa': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="building-2" className="w-5 h-5"></i></span>
            Quem está organizando esse encontro?
          </h2>
          <p className="text-sm text-slate-500 mt-1">{DEMO_USER ? 'A empresa está vinculada à sua conta. Confira o contato responsável por este evento.' : 'Informe a empresa e o contato responsável por este evento.'}</p>
        </div>

        {DEMO_USER && <section className="account-company" aria-label="Empresa vinculada à conta"><span>EMPRESA DA SUA CONTA</span><strong>{DEMO_USER.companyName}</strong><p>{DEMO_USER.companyCnpj ? 'CNPJ: ' + formatCNPJ(DEMO_USER.companyCnpj) : 'CNPJ não informado no cadastro da empresa.'}</p></section>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!DEMO_USER && <React.Fragment>
          <div>
            <label htmlFor="company-name" className="block text-xs font-bold text-slate-700 mb-1">
              Razão Social / Empresa
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input
              id="company-name"
              autoComplete="organization" value={form.companyName} readOnly={!!DEMO_USER}
              onChange={e => set('companyName', e.target.value)}
              placeholder="Nome da empresa contratante"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.companyName ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
          </div>

          <div>
            <label htmlFor="brief-field-1" className="block text-xs font-bold text-slate-700 mb-1">
              CNPJ
            </label>
            <input id="brief-field-1"
              inputMode="numeric" value={form.cnpj}
              onChange={e => set('cnpj', formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.cnpj ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.cnpj && <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>}
          </div>
          </React.Fragment>}

          <div>
            <label htmlFor="brief-field-2" className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Solicitante
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input id="brief-field-2"
              autoComplete="name" value={form.requesterName}
              onChange={e => set('requesterName', e.target.value)}
              placeholder="Nome completo do responsável"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.requesterName ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.requesterName && <p className="text-xs text-red-500 mt-1">{errors.requesterName}</p>}
          </div>

          <div>
            <label htmlFor="brief-field-3" className="block text-xs font-bold text-slate-700 mb-1">
              Cargo / Função
            </label>
            <input id="brief-field-3"
              value={form.requesterRole}
              onChange={e => set('requesterRole', e.target.value)}
              placeholder="Ex: Gerente de Compras, RH, Secretária Executiva"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.requesterRole ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.requesterRole && <p className="text-xs text-red-500 mt-1">{errors.requesterRole}</p>}
          </div>

          <div>
            <label htmlFor="brief-field-4" className="block text-xs font-bold text-slate-700 mb-1">
              E-mail Corporativo
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input id="brief-field-4"
              type="email"
              autoComplete="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="seunome@empresa.com.br"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.email ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="brief-field-5" className="block text-xs font-bold text-slate-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input id="brief-field-5"
              autoComplete="tel" inputMode="tel" value={form.phone}
              onChange={e => set('phone', formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.phone ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>
        </div>

        {/* Centro de Custo / Projeto – REDESIGN DO BOTÃO "NÃO SE APLICA" */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Centro de Custo / Projeto
            </label>

            {/* BOTÃO REDESENHADO (Clean, profissional, sem cores estranhas) */}
            <button
              type="button"
              onClick={() => {
                const nextState = !form.costCenterNotApplicable;
                setForm(prev => ({
                  ...prev,
                  costCenterNotApplicable: nextState,
                  costCenter: nextState ? '' : prev.costCenter
                }));
                if (errors.costCenter) setErrors(prev => ({ ...prev, costCenter: null }));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border
                ${form.costCenterNotApplicable
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 hover:border-slate-400'}`}
            >
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] font-bold
                ${form.costCenterNotApplicable ? 'bg-white text-slate-800 border-white' : 'border-slate-400'}`}>
                {form.costCenterNotApplicable ? '✓' : ''}
              </span>
              <span>Não se aplica</span>
            </button>
          </div>

          <input
            disabled={form.costCenterNotApplicable}
            value={form.costCenterNotApplicable ? 'Não se aplica' : form.costCenter}
            onChange={e => set('costCenter', e.target.value)}
            placeholder={form.costCenterNotApplicable ? 'Opção "Não se aplica" ativada' : 'Informe o código do Centro de Custo ou Nome do Projeto'}
            className={`w-full px-4 py-2.5 text-sm border rounded-xl transition-colors
              ${form.costCenterNotApplicable
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-slate-300 font-medium'
                : errors.costCenter
                ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400'
                : 'bg-white border-slate-300'}`}
          />
          {errors.costCenter && <p className="text-xs text-red-500 mt-1">{errors.costCenter}</p>}
        </div>

        {/* Faturamento de Extras */}
        <div>
          <SectionTitle title="Pagamento de extras" subtitle="Opcional. Se não escolher, ficará a definir com o consultor. Indique quem pagará os consumos extras." />
          <div className="flex flex-wrap gap-2.5">
            {['Faturamento total de Extras', 'Pagamento direto pelo viajante/convidado'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('extraBillingType', opt)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all
                  ${form.extraBillingType === opt
                    ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA 2: VISÃO GERAL DO EVENTO & SELEÇÃO DE SERVIÇOS
       ──────────────────────────────────────────────────────── */
    case 'evento': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="calendar-check" className="w-5 h-5"></i></span>
            Vamos definir seu próximo evento
          </h2>
          <p className="text-sm text-slate-500 mt-1">Comece pelo destino, pelas datas e pelos serviços que seu grupo precisa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="desired-budget" className="block text-xs font-bold text-slate-700 mb-1">Faixa de investimento desejada (opcional)</label>
            <input id="desired-budget" value={form.desiredBudget || ''} maxLength={150}
              onChange={e => set('desiredBudget', e.target.value)}
              className="w-full px-4 py-2.5 text-sm border rounded-xl bg-white border-slate-300" />
            {DEMO_USER?.preferences?.criteria && <p className="text-sm text-slate-600 mt-2">{DEMO_USER.preferences.criteria}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="event-name" className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Evento / Projeto
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input
              id="event-name"
              value={form.eventName}
              onChange={e => set('eventName', e.target.value)}
              placeholder="Ex.: Encontro de lideranças 2026"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.eventName ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.eventName && <p className="text-xs text-red-500 mt-1">{errors.eventName}</p>}
          </div>

          <div>
            <label htmlFor="participants" className="block text-xs font-bold text-slate-700 mb-1">
              Número de participantes
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input
              type="number"
              min="1"
              id="participants"
              disabled={form.participantsUnknown}
              value={form.participantsUnknown ? '' : form.totalPassengers}
              onChange={e => set('totalPassengers', e.target.value)}
              placeholder="Ex: 40"
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.totalPassengers ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            <PlanningOption checked={form.participantsUnknown} onChange={value => {set('participantsUnknown',value); if(value)set('participantsEstimated',false);}}>Ainda não sei a quantidade</PlanningOption>
            <PlanningOption checked={form.participantsEstimated} disabled={form.participantsUnknown} onChange={value => set('participantsEstimated',value)}>Esta quantidade é uma estimativa</PlanningOption>
            {errors.totalPassengers && <p className="text-xs text-red-500 mt-1">{errors.totalPassengers}</p>}
          </div>

          <div>
            <label htmlFor="event-destination" className="block text-xs font-bold text-slate-700 mb-1">
              Destino do Evento (Cidade / UF ou País)
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <CityAutocomplete inputId="event-destination"
              value={form.destination}
              onChange={text => set('destination', text)}
              hasError={!!errors.destination}
            />
            {errors.destination && <p className="text-xs text-red-500 mt-1">{errors.destination}</p>}
          </div>

          {/* DATAS COM BLOQUEIO DE DATAS PASSADAS (min={todayStr}) */}
          <div>
            <label htmlFor="event-period" className="block text-xs font-bold text-slate-700 mb-1">
              Data de início
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input
              type="date"
              min={todayStr}
              id="event-period"
              disabled={form.datesUnknown}
              value={form.datesUnknown ? '' : form.departureDate}
              onChange={e => set('departureDate', e.target.value)}
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.departureDate ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.departureDate && <p className="text-xs text-red-500 mt-1">{errors.departureDate}</p>}
          </div>

          <div>
            <label htmlFor="brief-field-6" className="block text-xs font-bold text-slate-700 mb-1">
              Data de término
             <span className="required-mark" aria-label="obrigatório">*</span></label>
            <input id="brief-field-6"
              disabled={form.datesUnknown}
              type="date"
              min={form.departureDate || todayStr}
              value={form.datesUnknown ? '' : form.returnDate}
              onChange={e => set('returnDate', e.target.value)}
              className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-white
                ${errors.returnDate ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-300'}`}
            />
            {errors.returnDate && <p className="text-xs text-red-500 mt-1">{errors.returnDate}</p>}
          </div>
        </div>

        <div className="planning-flexibility">
          <PlanningOption checked={form.datesUnknown} onChange={value => {set('datesUnknown',value);if(value)set('datesFlexible',false);}}>Ainda não defini as datas</PlanningOption>
          <PlanningOption checked={form.datesFlexible} disabled={form.datesUnknown} onChange={value => set('datesFlexible',value)}>Tenho flexibilidade nas datas informadas</PlanningOption>
          <p>Você pode registrar o pedido com datas ou quantidade a definir. Esses detalhes serão necessários para concluir a cotação.</p>
        </div>
        {tripDays && (
          <div className="flex items-center gap-2 text-sm font-bold text-pt-blue1 bg-pt-blue1/5 border border-pt-blue1/10 px-4 py-3 rounded-xl">
            <span className="text-pt-blue1"><i data-lucide="clock" className="w-4 h-4"></i></span>
            <span>Duração total do evento: <strong className="text-pt-blue3">{tripDays}</strong></span>
          </div>
        )}

        {/* SELEÇÃO DE SERVIÇOS */}
        <div id="event-services" className="pt-5 border-t border-slate-100">
          <SectionTitle
            title="O que vamos planejar?"
            subtitle="Você pode selecionar mais de um serviço. As próximas etapas se adaptam à sua escolha."
            icon="check-square"
          />

          {errors.services && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
              <span className="flex-shrink-0"><i data-lucide="alert-circle" className="w-4 h-4"></i></span>
              <span>{errors.services}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <ServiceCard
              icon="plane"
              title="Aéreo"
              desc="Cotação e emissão de voos de grupo com melhores tarifas e malha aérea."
              selected={form.svcAereo}
              onClick={() => {
                set('svcAereo', !form.svcAereo);
                if (errors.services) setErrors(prev => ({ ...prev, services: null }));
              }}
            />
            <ServiceCard
              icon="hotel"
              title="Hospedagem"
              desc="Hotéis corporativos, cálculo dinâmico de quartos e opções de alimentação."
              selected={form.svcHospedagem}
              onClick={() => {
                set('svcHospedagem', !form.svcHospedagem);
                if (errors.services) setErrors(prev => ({ ...prev, services: null }));
              }}
            />
            <ServiceCard
              icon="presentation"
              title="Salas e A&B"
              desc="Salas com layouts específicos, equipamentos audiovisuais e catering (coffee breaks, refeições)."
              selected={form.svcEspacoAlimentacao}
              onClick={() => {
                set('svcEspacoAlimentacao', !form.svcEspacoAlimentacao);
                if (errors.services) setErrors(prev => ({ ...prev, services: null }));
              }}
            />
            <ServiceCard
              icon="bus"
              title="Transfers"
              desc="Traslados organizados: aeroporto ↔ hotel, hotel ↔ evento e veículos à disposição."
              selected={form.svcTransfers}
              onClick={() => {
                set('svcTransfers', !form.svcTransfers);
                if (errors.services) setErrors(prev => ({ ...prev, services: null }));
              }}
            />
          </div>
        </div>
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA: TRANSPORTE AÉREO (DESTAQUE MÁXIMO)
       ──────────────────────────────────────────────────────── */
    case 'aereo': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="plane" className="w-5 h-5"></i></span>
            Como o grupo vai viajar?
          </h2>
          <p className="text-sm text-slate-500 mt-1">Defina suas companhias aéreas e horários de voo prioritários.</p>
        </div>

        {guidanceOption('aereoGuidance', 'o aéreo')}
        {/* BLOCO 1: COMPANHIA AÉREA */}
        <div className="form-section space-y-5">
          <div className="flex items-center justify-between border-b-2 border-pt-yellow1 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pt-blue1 text-pt-yellow1 flex items-center justify-center font-extrabold text-sm shadow-xs">
                <i data-lucide="plane" className="w-4 h-4"></i>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-pt-blue1 uppercase tracking-wide">
                  Preferência de Companhia Aérea
                </h3>
                <p className="text-xs text-slate-500">Defina se há exclusividade ou foco na melhor malha/tarifa:</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-pt-yellow1/20 text-pt-dark rounded-full border border-pt-yellow1/40">
              Prioridade 1
            </span>
          </div>

          <div className="space-y-3">
            {[
              { id: GUIDANCE, title: GUIDANCE, badge: 'A definir', subtitle: 'Nossa equipe poderá ajudar a escolher a melhor opção.' },
              {
                id: 'Qualquer Companhia Aérea (Foco em Menor Tarifa e Melhor Malha)',
                title: 'Qualquer Companhia Aérea',
                badge: 'Recomendado',
                subtitle: 'Foco na melhor tarifa disponível e menor tempo de viagem (LATAM, Gol, Azul, etc.)'
              },
              {
                id: 'Somente Companhia Específica',
                title: 'Somente Companhia Específica',
                badge: 'Exclusiva',
                subtitle: 'Sua empresa exige viajar apenas por uma companhia específica'
              },
              {
                id: 'Restrição de Companhia Aérea por Política Interna',
                title: 'Restrição / Companhia Proibida',
                badge: 'Restrição',
                subtitle: 'Existe alguma companhia que não pode ser cotada por política da empresa'
              }
            ].map(opt => (
              <label
                key={opt.id}
                className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${form.airlinePreference === opt.id
                    ? 'border-pt-blue1 bg-pt-blue1/5 shadow-sm ring-2 ring-pt-blue1/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}`}
              >
                <input
                  type="radio"
                  name="airline"
                  checked={form.airlinePreference === opt.id}
                  onChange={() => set('airlinePreference', opt.id)}
                  className="mt-1 w-4 h-4 accent-pt-blue1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">{opt.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase
                      ${form.airlinePreference === opt.id ? 'bg-pt-blue1 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">{opt.subtitle}</span>
                </div>
              </label>
            ))}
          </div>

          {form.airlinePreference === 'Somente Companhia Específica' && (
            <div className="pt-2">
              <label htmlFor="brief-field-7" className="block text-xs font-bold text-pt-blue1 mb-1">Qual companhia aérea você prefere? <span className="required-mark" aria-label="obrigatório">*</span></label>
              <input id="brief-field-7"
                value={form.specificAirline}
                onChange={e => set('specificAirline', e.target.value)}
                placeholder="Ex: Apenas voos LATAM ou Azul"
                className="w-full px-4 py-2.5 text-sm border-2 border-pt-blue1/40 rounded-xl bg-white focus:border-pt-blue1"
              />
            </div>
          )}

          {form.airlinePreference === 'Restrição de Companhia Aérea por Política Interna' && (
            <div className="pt-2">
              <label htmlFor="brief-field-8" className="block text-xs font-bold text-red-600 mb-1">Qual companhia aérea é restrita / proibida? <span className="required-mark" aria-label="obrigatório">*</span></label>
              <input id="brief-field-8"
                value={form.restrictedAirline}
                onChange={e => set('restrictedAirline', e.target.value)}
                placeholder="Ex: Não cotar determinada companhia"
                className="w-full px-4 py-2.5 text-sm border-2 border-red-300 rounded-xl bg-white focus:border-red-500"
              />
            </div>
          )}
        </div>

        {/* BLOCO 2: JANELAS DE HORÁRIOS PREFERENCIAIS */}
        <div className="form-section space-y-5">
          <div className="flex items-center justify-between border-b-2 border-pt-yellow1 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pt-blue1 text-pt-yellow1 flex items-center justify-center font-extrabold text-sm shadow-xs">
                <i data-lucide="clock" className="w-4 h-4"></i>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-pt-blue1 uppercase tracking-wide">
                  Horários Preferenciais de Voo
                </h3>
                <p className="text-xs text-slate-500">Selecione uma ou mais janelas ideais para embarque e retorno:</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-pt-yellow1/20 text-pt-dark rounded-full border border-pt-yellow1/40">
              Prioridade 2
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* IDA */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-emerald-600"><i data-lucide="plane-takeoff" className="w-4 h-4"></i></span>
                  Horários Preferenciais – IDA
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Embarque</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Manhã (06h–12h)', 'Tarde (12h–18h)', 'Noite (18h–00h)', 'Qualquer Horário'].map(h => (
                  <PillOption
                    key={h}
                    label={h}
                    checked={(form.departureTimes || []).includes(h)}
                    onClick={() => toggleArr('departureTimes', h)}
                  />
                ))}
              </div>
            </div>

            {/* VOLTA */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-pt-blue1 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-pt-blue1"><i data-lucide="plane-landing" className="w-4 h-4"></i></span>
                  Horários Preferenciais – VOLTA
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Retorno</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Manhã (06h–12h)', 'Tarde (12h–18h)', 'Noite (18h–00h)', 'Qualquer Horário'].map(h => (
                  <PillOption
                    key={h}
                    label={h}
                    checked={(form.returnTimes || []).includes(h)}
                    onClick={() => toggleArr('returnTimes', h)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* POLÍTICAS COMPLEMENTARES DE VOO */}
        <details className="advanced-options bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5"><summary>Preferências de cabine, conexão e bagagem <span>Opcional</span></summary>
          <SectionTitle
            title="Políticas Complementares de Viagem"
            subtitle="Parâmetros de cabine, escalas e bagagem"
            icon="sliders"
          />

          {/* Classe da Cabine */}
          <div>
            <SectionTitle title="Classe da Cabine" />
            <div className="flex flex-wrap gap-2">
              {[GUIDANCE, 'Econômica (Padrão corporativo)', 'Premium Economy', 'Executiva / Business', 'Misto / Por Cargo'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('cabinClass', c)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5
                    ${form.cabinClass === c
                      ? 'border-pt-blue1 bg-pt-blue1/10 text-pt-blue1 shadow-xs ring-1 ring-pt-blue1/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                >
                  {form.cabinClass === c && <span className="text-pt-blue1 font-bold">✓</span>}
                  <span>{c}</span>
                </button>
              ))}
            </div>
            {form.cabinClass === 'Misto / Por Cargo' && (
              <div><label htmlFor="cabin-notes">Distribuição das cabines <span aria-label="obrigatório">*</span></label><input id="cabin-notes"
                value={form.cabinClassNotes}
                onChange={e => set('cabinClassNotes', e.target.value)}
                placeholder="Ex: Diretoria em Executiva, demais colaboradores em Econômica"
                className="mt-2 w-full px-4 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              />{errors.cabinClassNotes && <p role="alert">{errors.cabinClassNotes}</p>}</div>
            )}
          </div>

          {/* Conexões e Bagagem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div>
              <SectionTitle title="Conexões / Escalas" />
              <div className="flex flex-wrap gap-2">
                {[GUIDANCE, 'Apenas Voo Direto', 'Aceita Conexão'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set('flightConnection', opt)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5
                      ${form.flightConnection === opt
                        ? 'border-pt-blue1 bg-pt-blue1/10 text-pt-blue1 shadow-xs ring-1 ring-pt-blue1/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    {form.flightConnection === opt && <span className="text-pt-blue1 font-bold">✓</span>}
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
              {form.flightConnection === 'Aceita Conexão' && (
                <input id="layover-hours"
                  type="number"
                  min="1"
                  value={form.maxLayoverHours}
                  onChange={e => set('maxLayoverHours', e.target.value)}
                  placeholder="Tempo máx. de conexão (horas)"
                  className="mt-2 w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                />
              )}
            </div>

            <div>
              <SectionTitle title="Franquia de Bagagem" />
              <div className="flex flex-wrap gap-2">
                {[GUIDANCE, 'Apenas Mala de Mão (10kg)', 'Com Bagagem Despachada (23kg)'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set('baggageType', opt)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5
                      ${form.baggageType === opt
                        ? 'border-pt-blue1 bg-pt-blue1/10 text-pt-blue1 shadow-xs ring-1 ring-pt-blue1/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    {form.baggageType === opt && <span className="text-pt-blue1 font-bold">✓</span>}
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        <NotesField
          value={form.aereoNotes}
          onChange={v => set('aereoNotes', v)}
          label="Observações Adicionais do Transporte Aéreo"
          placeholder="Ex: Cidades de origem diversas, necessidade de bloqueio de assentos juntos, etc."
        />
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA: HOSPEDAGEM & ROOMING LIST
       ──────────────────────────────────────────────────────── */
    case 'hospedagem': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="hotel" className="w-5 h-5"></i></span>
            Como vamos acomodar os participantes?
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configure o padrão do hotel, distribuição dos quartos e capacidade de participantes.</p>
        </div>

        {guidanceOption('hospedagemGuidance', 'a hospedagem')}
        {/* Padrão com título em destaque */}
        <div>
          <SectionTitle title="Padrão de Hotelaria Desejado"  />
          <div className="flex flex-wrap gap-2.5">
            {[GUIDANCE, 'Hotel 3 ou 4 estrelas – Padrão Corporativo', 'Luxo 5 estrelas', 'Resort / Centro de Convenções'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('hotelStandard', opt)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all
                  ${form.hotelStandard === opt
                    ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Localização com título em destaque */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <SectionTitle title="Preferência de Localização do Hotel"  />
          <div className="flex flex-wrap gap-2">
            {[GUIDANCE, 'Próximo ao Local do Evento', 'Próximo ao Aeroporto', 'Outro'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('hotelLocationPref', opt)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all
                  ${form.hotelLocationPref === opt
                    ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>

          {form.hotelLocationPref === 'Próximo ao Local do Evento' && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Endereço ou Local onde será realizado o Evento <span className="text-slate-400 font-normal">(se já definido)</span>
              </label>
              <input
                value={form.eventAddress}
                onChange={e => set('eventAddress', e.target.value)}
                placeholder="Ex: Expo Center Norte, Rua Frei Caneca 569, ou bairro desejado"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>
          )}

          {form.hotelLocationPref === 'Outro' && (
            <div className="pt-2">
              <label htmlFor="brief-field-9" className="block text-xs font-bold text-slate-700 mb-1">Especifique a localização desejada <span className="required-mark" aria-label="obrigatório">*</span></label>
              <input id="brief-field-9"
                value={form.hotelLocationOther}
                onChange={e => set('hotelLocationOther', e.target.value)}
                placeholder="Ex: Beira-mar, centro financeiro, etc."
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>
          )}
        </div>

        {/* Distribuição de Quartos com título em destaque */}
        <div id="rooms-distribution">
          <SectionTitle title="Distribuição de Quartos" subtitle="Informe a quantidade de quartos por tipologia:" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'roomsSingle', label: 'Single', desc: '1 pessoa / 1 cama' },
              { key: 'roomsDoubleTwin', label: 'Double Twin', desc: '2 pessoas / 2 camas solteiro' },
              { key: 'roomsDoubleCasal', label: 'Double Casal', desc: '2 pessoas / 1 cama casal' },
              { key: 'roomsTriple', label: 'Triplo', desc: '3 pessoas' },
            ].map(room => (
              <div key={room.key} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-900 block">{room.label}</span>
                <span className="text-[11px] text-slate-500 block mb-2">{room.desc}</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form[room.key]}
                    onChange={e => set(room.key, e.target.value)}
                    className="w-full text-sm font-bold px-3 py-1.5 border rounded-lg border-slate-300"
                  />
                  <span className="text-xs text-slate-500 ml-2 font-medium">qts</span>
                </div>
              </div>
            ))}
          </div>

          {/* Calculador de Capacidade */}
          {accommodationCalc.totalRooms > 0 && (
            <div className={`mt-3.5 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border
              ${capacityDiff !== null && capacityDiff < 0
                ? 'bg-red-50 text-red-700 border-red-200'
                : capacityDiff !== null && capacityDiff > 0
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
            >
              <span className="flex-shrink-0">
                <i data-lucide={capacityDiff !== null && capacityDiff < 0 ? 'alert-triangle' : 'check-circle-2'} className="w-5 h-5"></i>
              </span>
              <div>
                <strong>{accommodationCalc.totalRooms} quartos</strong> = Capacidade para <strong>{accommodationCalc.totalCapacity} pessoas</strong>.
                {capacityDiff !== null && capacityDiff < 0 && (
                  <span className="block text-xs font-bold mt-1 text-red-600">
                    Atenção: faltam vagas para {Math.abs(capacityDiff)} pessoa(s). Os quartos selecionados acomodam apenas {accommodationCalc.totalCapacity} das {form.totalPassengers} pessoas.
                  </span>
                )}
                {capacityDiff !== null && capacityDiff > 0 && (
                  <span className="block text-xs font-bold mt-1 text-amber-700">
                    Atenção: você colocou quartos a mais do que o necessário (está sobrando vaga para {capacityDiff} pessoa(s)).
                  </span>
                )}
                {capacityDiff !== null && capacityDiff === 0 && (
                  <span className="block text-xs font-bold mt-1 text-emerald-700">
                    Perfeito! Todos os {form.totalPassengers} participantes estão acomodados.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Regime de Alimentação com título em destaque */}
        <div>
          <SectionTitle title="Refeições no hotel" subtitle="Refeições incluídas na diária do hotel" />
          <div className="flex flex-wrap gap-2">
            {[GUIDANCE, 'Apenas Café da Manhã', 'Meia Pensão (Café + Jantar)', 'Pensão Completa'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('mealRegime', opt)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all
                  ${form.mealRegime === opt
                    ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Rooming List com título em destaque */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <SectionTitle title="Lista preliminar de hóspedes" icon="clipboard-list" />
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
              Não obrigatório
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-2">Caso já tenha uma lista de hóspedes ou distribuição por quarto, cole aqui:</p>
          <textarea
            value={form.roomingList}
            onChange={e => set('roomingList', e.target.value)}
            rows={3}
            placeholder="Exemplo:&#10;Quarto 1 (Single): Carlos Silva&#10;Quarto 2 (Double Twin): Roberto Mendes e Lucas Prado"
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl resize-none bg-white placeholder:text-slate-400"
          />
        </div>

        <NotesField
          value={form.hospedagemNotes}
          onChange={v => set('hospedagemNotes', v)}
          label="Observações Adicionais de Hospedagem"
          placeholder="Ex: Camas extras, necessidade de quartos acessíveis (PCD), andares próximos, etc."
        />
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA: SALAS DE EVENTOS & ALIMENTAÇÃO (A&B)
       ──────────────────────────────────────────────────────── */
    case 'espaco': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="presentation" className="w-5 h-5"></i></span>
            O que seu encontro precisa?
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configure o espaço para reuniões, formato da sala, equipamentos e serviços gastronômicos.</p>
        </div>

        {guidanceOption('espacoGuidance', 'os espaços e a alimentação')}
        {/* SALAS & FORMATO */}
        <div className="form-section space-y-5">
          <SectionTitle title="Espaço de Reuniões & Infraestrutura" icon="layout" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="brief-field-10" className="block text-xs font-bold text-slate-700 mb-1">
                Quantidade de Pessoas na Sala Principal
              </label>
              <input id="brief-field-10"
                type="number"
                min="0"
                value={form.plenaryCapacity}
                onChange={e => set('plenaryCapacity', e.target.value)}
                placeholder={form.totalPassengers ? `Padrão: ${form.totalPassengers} pessoas` : 'Ex: 50 pessoas'}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div>
              <label htmlFor="brief-field-11" className="block text-xs font-bold text-slate-700 mb-1">
                Salas de Apoio / Breakout Rooms (Quantidade)
              </label>
              <input id="brief-field-11"
                type="number"
                min="0"
                value={form.breakoutRoomsCount}
                onChange={e => set('breakoutRoomsCount', e.target.value)}
                placeholder="Ex: 2 salas de apoio"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>
          </div>

          {/* FORMATO DA SALA */}
          <div>
            <SectionTitle title="Formato / Montagem da Sala Principal"  />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {[
                { id: 'Auditório (fileiras de cadeiras)', label: 'Auditório', desc: 'Fileiras de cadeiras' },
                { id: 'Escolar / Sala de Aula (mesas e cadeiras)', label: 'Escolar', desc: 'Mesas + cadeiras' },
                { id: 'Formato U / Ferradura', label: 'Formato U', desc: 'Mesa contínua em U' },
                { id: 'Banquete (mesas redondas)', label: 'Banquete', desc: 'Mesas redondas' },
                { id: 'Espinha de Peixe', label: 'Espinha de Peixe', desc: 'Mesas anguladas' },
                { id: 'Coquetel / Lounge', label: 'Coquetel', desc: 'Sem assentos fixos' },
                { id: 'A definir / Não sei ainda / Tanto faz', label: 'A Definir', desc: 'Ainda não decidido' },
              ].map(layout => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => set('roomLayout', layout.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all
                    ${form.roomLayout === layout.id
                      ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm ring-1 ring-pt-blue1'
                      : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="text-xs font-bold block">{layout.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${form.roomLayout === layout.id ? 'text-slate-200' : 'text-slate-400'}`}>
                    {layout.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* EQUIPAMENTOS AV */}
          <div>
            <SectionTitle title="Equipamentos Audiovisuais (AV)"  />
            <div className="flex flex-wrap gap-2">
              {['Projetor & Telão', 'Microfones Sem Fio', 'Sonorização Completa', 'Iluminação Cênica', 'Tradução Simultânea', 'Gravação / Transmissão Online'].map(av => (
                <PillOption
                  key={av}
                  label={av}
                  checked={(form.avServices || []).includes(av)}
                  onClick={() => toggleArr('avServices', av)}
                />
              ))}
            </div>
            <input
              value={form.avOtherNotes}
              onChange={e => set('avOtherNotes', e.target.value)}
              placeholder="Outras necessidades técnicas de som, luz ou informática"
              className="mt-2 w-full px-4 py-2 text-xs border border-slate-300 rounded-xl bg-white"
            />
          </div>
        </div>

        {/* ALIMENTOS & BEBIDAS */}
        <div className="form-section space-y-5">
          <SectionTitle title="Alimentos & Bebidas (Gastronomia)" icon="utensils" />

          <div>
            <SectionTitle title="Serviços de alimentação"  />
            <div className="flex flex-wrap gap-2">
              {['Coffee Break', 'Almoço Servido / Buffet', 'Jantar de Confraternização', 'Coquetel de Boas-Vindas', 'Welcome Drink'].map(catering => (
                <PillOption
                  key={catering}
                  label={catering}
                  checked={(form.cateringServices || []).includes(catering)}
                  onClick={() => toggleArr('cateringServices', catering)}
                />
              ))}
            </div>
          </div>

          {(form.cateringServices || []).includes('Coffee Break') && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label htmlFor="brief-field-12" className="block text-xs font-bold text-slate-800 mb-1">
                Frequência de Coffee Break por dia
              </label>
              <select id="brief-field-12"
                value={form.coffeeBreakPerDay}
                onChange={e => set('coffeeBreakPerDay', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="">A definir</option>
                <option value="Preciso de orientação">Preciso de orientação</option>
                <option value="1">1x por dia (Ex: Coffee da tarde)</option>
                <option value="2">2x por dia (Manhã e Tarde)</option>
                <option value="3">3x por dia (Boas-vindas, Manhã e Tarde)</option>
              </select>
            </div>
          )}
        </div>

        <NotesField
          value={form.espacoAlimentacaoNotes}
          onChange={v => set('espacoAlimentacaoNotes', v)}
          label="Observações Adicionais de Salas e Alimentação"
          placeholder="Ex: Restrições alimentares (vegetarianos, celíacos), horários específicos dos coffees, montagens especiais, etc."
        />
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA: TRANSFER
       ──────────────────────────────────────────────────────── */
    case 'transfers': return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-pt-blue1"><i data-lucide="bus" className="w-5 h-5"></i></span>
            Como o grupo vai se deslocar?
          </h2>
          <p className="text-sm text-slate-500 mt-1">Defina os trajetos de translado e tipo de transporte para os participantes.</p>
        </div>

        {guidanceOption('transfersGuidance', 'os transfers')}
        <div className="form-section space-y-5">
          <div>
            <SectionTitle title="Trechos de Transfer Solicitados"  />
            <div className="flex flex-wrap gap-2.5">
              {[
                'Aeroporto ↔ Hotel',
                'Hotel ↔ Local do Evento',
                'Hotel ↔ Jantar / Restaurante Externo',
                'Veículo Exclusivo à Disposição'
              ].map(tr => (
                <PillOption
                  key={tr}
                  label={tr}
                  checked={(form.transferTypes || []).includes(tr)}
                  onClick={() => toggleArr('transferTypes', tr)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <SectionTitle title="Tipo de Veículo Desejado" />
              <div className="flex flex-wrap gap-2">
                {[GUIDANCE, 'Van (até 15 pax)', 'Micro-ônibus (até 25 pax)', 'Ônibus Executivo (até 46 pax)', 'Carro Executivo Sedã'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('vehicleType', v)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all
                      ${form.vehicleType === v
                        ? 'border-pt-blue1 bg-pt-blue1 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {(form.transferTypes || []).includes('Veículo Exclusivo à Disposição') && (
              <div>
                <SectionTitle title="Tempo / Dias do Veículo à Disposição" />
                <input
                  value={form.dedicatedVehicleHoursDays}
                  onChange={e => set('dedicatedVehicleHoursDays', e.target.value)}
                  placeholder="Ex: 8h por dia durante 3 dias"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                />
              </div>
            )}
          </div>
        </div>

        <NotesField
          value={form.transfersNotes}
          onChange={v => set('transfersNotes', v)}
          label="Observações Adicionais de Transfer"
          placeholder="Ex: Coordenador no aeroporto com placa, horários de chegada divididos por voo, bagagens volumosas, etc."
        />
      </div>
    );

    /* ────────────────────────────────────────────────────────
       ETAPA: REVISÃO & TRANSMISSÃO (PADRÃO EXECUTIVO CATEGORIZADO COMPLETO)
       ──────────────────────────────────────────────────────── */
    case 'revisao': {
      const reviewForm = prepareSubmission(form);
      return (
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 id="section-heading" className="font-serif font-semibold text-2xl text-pt-blue1 tracking-tight flex items-center gap-2.5">
            <span className="text-emerald-600"><i data-lucide="check-circle-2" className="w-5 h-5"></i></span>
            Seu briefing, pronto para revisar
          </h2>
          <p className="text-sm text-slate-500 mt-1">Confira os detalhes do encontro. Você pode editar cada seção e voltar diretamente para esta revisão.</p>
        </div>

        <section className={"review-checklist " + (issues.length ? 'has-issues' : 'is-ready')} aria-labelledby="review-pending-heading">
          <h3 id="review-pending-heading">{issues.length ? `Faltam ${issues.length} ajustes para registrar a solicitação` : 'Informações mínimas preenchidas'}</h3>
          <p>{issues.length ? 'Você pode continuar explorando o formulário. Antes de registrar, confira os pontos abaixo.' : 'Confira as preferências. Informações a definir serão tratadas como pendências de planejamento, sem escolhas automáticas.'}</p>
          {issues.length > 0 && <ul>{issues.map((issue,index) => <li key={issue.field + index}><button type="button" onClick={() => locateIssue(issue)}>{issue.message}<span aria-hidden="true"> </span></button></li>)}</ul>}
          {guidanceLabels.length > 0 && <p>Orientação solicitada: {guidanceLabels.join(', ')}.</p>}
          {legacyDraft && <div className="legacy-draft-note"><p>Este rascunho veio da versão anterior. Confira as preferências: algumas opções podiam estar pré-selecionadas.</p><button className="confirm-legacy" type="button" onClick={() => setLegacyDraft(false)}>Conferi as preferências anteriores</button></div>}
        </section>
        {/* ═══ RELATÓRIO CATEGORIZADO COMPLETO (PADRÃO ORIGINAL EXECUTIVO) ═══ */}
        <div className="brief-document bg-white space-y-6">
          {/* Header do Relatório */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-pt-blue1 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <img src={BRAND.logoDark} alt={BRAND.name} className="h-8" />
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block">{BRAND.name}</span>
                <span className="text-sm font-extrabold text-pt-blue1">SOLICITAÇÃO DE GRUPOS E EVENTOS</span>
              </div>
            </div>
            <div className="text-left sm:text-right text-[11px] text-slate-600">
              <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
              <p><strong>Cotação:</strong> {OPERATION.quoteDeadline} {OPERATION.deadlineCondition}</p>
              <p><strong>Atendimento:</strong> {OPERATION.contactEmail || OPERATION.contactLabel}</p>
            </div>
          </div>

          {/* Bloco 2: Briefing do Evento */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1">
              <span>O EVENTO</span>{editLink("evento", "dados do evento")}
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="sm:col-span-2"><strong>Nome do Evento / Projeto:</strong> {reviewForm.eventName || '-'}</div>
              <div><strong>Destino:</strong> {reviewForm.destination || '-'}</div>
              <div><strong>Total de Participantes:</strong> {participantCaption}</div>
              <div><strong>Data de Ida / Início:</strong> {reviewForm.datesUnknown ? 'A definir' : formatBriefDate(reviewForm.departureDate)}</div>
              <div><strong>Data de Volta / Término:</strong> {reviewForm.datesUnknown ? 'A definir' : formatBriefDate(reviewForm.returnDate)} {tripDays && `(${tripDays})`} {reviewForm.datesFlexible && '(datas flexíveis)'}</div>
            </div>
          </div>

          {/* Bloco 3: Transporte Aéreo */}
          {reviewForm.svcAereo ? (
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1">
                <span>AÉREO</span>{editLink("aereo", "transporte aéreo")}
              </div>
              <div className="p-3.5 text-xs space-y-2">
                <div>
                  <strong>Preferência de Cia Aérea:</strong> {reviewForm.airlinePreference || 'A definir'}
                  {reviewForm.specificAirline && ` (Cia: ${reviewForm.specificAirline})`}
                  {reviewForm.restrictedAirline && ` [Restrição: ${reviewForm.restrictedAirline}]`}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><strong>Horários Ida:</strong> {reviewForm.departureTimes.join(', ') || 'A definir'}</div>
                  <div><strong>Horários Volta:</strong> {reviewForm.returnTimes.join(', ') || 'A definir'}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><strong>Classe Cabine:</strong> {reviewForm.cabinClass || 'A definir'} {reviewForm.cabinClassNotes && `(${reviewForm.cabinClassNotes})`}</div>
                  <div><strong>Conexões:</strong> {reviewForm.flightConnection || 'A definir'} {reviewForm.maxLayoverHours && `(máx ${reviewForm.maxLayoverHours}h)`}</div>
                  <div><strong>Bagagem:</strong> {reviewForm.baggageType || 'A definir'}</div>
                </div>
                {reviewForm.aereoNotes && <div><strong>Observações do Aéreo:</strong> {reviewForm.aereoNotes}</div>}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs text-slate-500">
              ✈️ <strong>Transporte Aéreo:</strong> Não solicitado para este evento.
            </div>
          )}

          {/* Bloco 4: Hospedagem & Rooming List */}
          {reviewForm.svcHospedagem ? (
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1 flex items-center justify-between">
                <span>HOSPEDAGEM & ROOMING</span>{editLink("hospedagem", "hospedagem")}
                <span className="font-normal text-[10px]">{roomsCaption}</span>
              </div>
              <div className="p-3.5 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><strong>Padrão Hotel:</strong> {reviewForm.hotelStandard || 'A definir'}</div>
                  <div><strong>Localização:</strong> {reviewForm.hotelLocationPref || 'A definir'} {reviewForm.eventAddress && `[${reviewForm.eventAddress}]`} {reviewForm.hotelLocationOther && `(${reviewForm.hotelLocationOther})`}</div>
                  <div><strong>Alimentação:</strong> {reviewForm.mealRegime || 'A definir'}</div>
                </div>

                {/* Tabela de Quartos */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">Single (1 pax)</th>
                        <th className="p-2 border-r border-slate-300">Double Twin (2 camas)</th>
                        <th className="p-2 border-r border-slate-300">Double Casal (1 cama)</th>
                        <th className="p-2 border-r border-slate-300">Triplo (3 pax)</th>
                        <th className="p-2 bg-slate-100 font-bold">Total Vagas</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border-r border-slate-300">{reviewForm.roomsSingle || 'A definir'} quartos</td>
                        <td className="p-2 border-r border-slate-300">{reviewForm.roomsDoubleTwin || 'A definir'} quartos</td>
                        <td className="p-2 border-r border-slate-300">{reviewForm.roomsDoubleCasal || 'A definir'} quartos</td>
                        <td className="p-2 border-r border-slate-300">{reviewForm.roomsTriple || 'A definir'} quartos</td>
                        <td className="p-2 font-bold text-pt-blue1 bg-slate-50">{roomsProvided ? accommodationCalc.totalCapacity + ' pessoas' : 'A definir'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {reviewForm.roomingList && (
                  <div>
                    <strong>Rooming List Preliminar:</strong>
                    <pre className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 whitespace-pre-wrap font-sans text-xs">{reviewForm.roomingList}</pre>
                  </div>
                )}
                {reviewForm.hospedagemNotes && <div><strong>Observações Hospedagem:</strong> {reviewForm.hospedagemNotes}</div>}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs text-slate-500">
              🏨 <strong>Hospedagem:</strong> Não solicitada para este evento.
            </div>
          )}

          {/* Bloco 5: Salas de Eventos & Alimentação */}
          {reviewForm.svcEspacoAlimentacao ? (
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1">
                <span>SALAS E A&B</span>{editLink("espaco", "salas e alimentação")}
              </div>
              <div className="p-3.5 text-xs space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><strong>Capacidade da Sala:</strong> {reviewForm.plenaryCapacity ? reviewForm.plenaryCapacity + ' pessoas' : 'A definir'}</div>
                  <div><strong>Formato da Sala:</strong> {reviewForm.roomLayout || 'A definir'}</div>
                  <div><strong>Salas de Apoio:</strong> {reviewForm.breakoutRoomsCount || 'A definir'} sala(s)</div>
                  <div><strong>Equipamentos AV:</strong> {reviewForm.avServices.length ? reviewForm.avServices.join(', ') : 'A definir'} {reviewForm.avOtherNotes && `(${reviewForm.avOtherNotes})`}</div>
                  <div className="sm:col-span-2">
                    <strong>Alimentos & Bebidas:</strong> {reviewForm.cateringServices.length ? reviewForm.cateringServices.join(', ') : 'A definir'}
                    {reviewForm.cateringServices.includes('Coffee Break') && ` (Coffee: ${coffeeCaption(reviewForm.coffeeBreakPerDay)})`}
                  </div>
                </div>
                {reviewForm.espacoAlimentacaoNotes && <div><strong>Observações Espaços e alimentação:</strong> {reviewForm.espacoAlimentacaoNotes}</div>}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs text-slate-500">
              🏛️ <strong>Salas e Alimentação:</strong> Não solicitadas para este evento.
            </div>
          )}

          {/* Bloco 6: Transfer */}
          {reviewForm.svcTransfers ? (
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1">
                <span>TRANSFERS</span>{editLink("transfers", "transfers")}
              </div>
              <div className="p-3.5 text-xs space-y-2">
                <div><strong>Trechos Solicitados:</strong> {reviewForm.transferTypes.length ? reviewForm.transferTypes.join(', ') : 'A definir'}</div>
                <div><strong>Tipo de Veículo:</strong> {reviewForm.vehicleType || 'A definir'}</div>
                {reviewForm.dedicatedVehicleHoursDays && <div><strong>Tempo à Disposição:</strong> {reviewForm.dedicatedVehicleHoursDays}</div>}
                {reviewForm.transfersNotes && <div><strong>Observações Transfer:</strong> {reviewForm.transfersNotes}</div>}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs text-slate-500">
              🚐 <strong>Transfer:</strong> Não solicitado para este evento.
            </div>
          )}

          {/* Bloco 1: Dados da Empresa e Solicitante */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="brief-section-heading bg-slate-100 px-4 py-2 border-b border-slate-300 font-bold text-xs text-pt-blue1 flex items-center justify-between">
              <span>EMPRESA & SOLICITANTE</span>{editLink("empresa", "empresa e solicitante")}
              
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div><strong>Razão Social / Empresa:</strong> {reviewForm.companyName || '-'}</div>
              <div><strong>CNPJ:</strong> {reviewForm.cnpj || '-'}</div>
              <div><strong>Solicitante:</strong> {reviewForm.requesterName || '-'} {reviewForm.requesterRole ? `(${reviewForm.requesterRole})` : ''}</div>
              <div><strong>E-mail Corporativo:</strong> {reviewForm.email || '-'}</div>
              <div><strong>Telefone / WhatsApp:</strong> {reviewForm.phone || '-'}</div>
              <div><strong>Centro de Custo / Projeto:</strong> {reviewForm.costCenterNotApplicable ? 'Não se aplica' : (reviewForm.costCenter || '-')}</div>
              <div className="sm:col-span-2"><strong>Forma de Faturamento Extras:</strong> {reviewForm.extraBillingType || 'A definir'}</div>
            </div>
          </div>

          {/* Observações Gerais */}
          <div>
            <SectionTitle title="Observações do evento" />
            <textarea
              value={reviewForm.generalNotes}
              onChange={e => set('generalNotes', e.target.value)}
              rows={2}
              placeholder="Alguma exigência especial ou instrução corporativa complementar?"
              className="w-full px-4 py-2 text-xs border border-slate-300 rounded-xl resize-none bg-white"
            />
          </div>
        </div>

        <section className="registration-panel" aria-labelledby="register-heading">
          <h3 id="register-heading">Finalizar solicitação</h3>
          <p>{apiStatus === 'ready' ? 'Ao finalizar, você receberá um protocolo e poderá acompanhar a solicitação no seu painel. Nenhum e-mail real será enviado.' : apiStatus === 'checking' ? 'Verificando o registro local…' : 'Este arquivo funciona para preencher e exportar. Para gerar protocolo e salvar no banco local, abra a versão iniciada pelo servidor local.'}</p>
          <button type="button" className="register-button" onClick={registerRequest} disabled={isSending || apiStatus !== 'ready' || issues.length > 0}>{isSending ? 'Registrando…' : 'Finalizar solicitação'}</button>
          {issues.length > 0 && <p>Resolva os ajustes destacados acima para liberar o registro.</p>}
          {submitError && <p role="alert" className="submission-error">{submitError}</p>}
        </section>
        <div className="demo-export-actions">
          <button type="button" className="confirmation-back" onClick={handlePrintPDF}>Imprimir / salvar PDF</button>
          <button type="button" className="confirmation-back" onClick={handleCopySummary}>Copiar resumo</button>
        </div>
      </div>
    );
    }

    default: return null;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     LAYOUT GERAL
     ═══════════════════════════════════════════════════════════ */
  if (creatingBriefing) {
    const hasExistingDraft = form.eventName || form.destination ||
      form.svcAereo || form.svcHospedagem || form.svcEspacoAlimentacao || form.svcTransfers;
    const finishCreation = () => {
      const url = new URL(location.href);
      url.searchParams.delete('novo');
      history.replaceState(null, '', url);
      setCreatingBriefing(false);
    };
    const createBriefing = event => {
      event.preventDefault();
      const name = newEventName.trim();
      if (!name) { setCreationError('Informe o nome do evento.'); return; }
      if (hasExistingDraft && !window.confirm('Substituir o preenchimento deste navegador por uma nova cotação? O rascunho salvo na sua conta continuará disponível no painel.')) return;
      const next = { ...INITIAL_STATE, eventName: name, companyName: DEMO_USER.companyName,
        cnpj: DEMO_USER.companyCnpj || '', requesterName: DEMO_USER.name, email: DEMO_USER.email };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        sessionStorage.removeItem(ATTEMPT_KEY);
      } catch {
        setCreationError('Não foi possível salvar o início do briefing neste navegador. Tente novamente.');
        return;
      }
      submissionAttempt.current = null;
      setLegacyDraft(false);
      setForm(next);
      setStepIdx(0);
      finishCreation();
    };
    return (
      <div className="briefing-create-shell">
        <header><img src={BRAND.logoDark} alt={BRAND.name} /><span>{DEMO_USER.companyName}</span></header>
        <main className="briefing-create-panel">
          <a href="/portal.html">Voltar às minhas cotações</a>
          <h1>Vamos começar seu evento</h1>
          <p>Dê um nome ao pedido. A seguir, você poderá escolher os serviços e preencher o briefing.</p>
          <form onSubmit={createBriefing}>
            <label htmlFor="new-event-name">Nome do evento</label>
            <input id="new-event-name" value={newEventName} onChange={event => {setNewEventName(event.target.value);setCreationError('');}}
              required maxLength={180} autoFocus placeholder="Ex. Convenção comercial 2027"
              aria-describedby={creationError ? 'briefing-creation-error' : undefined} />
            <p>Aéreo, hospedagem, salas e alimentação, transfers. Selecione somente o que precisar na próxima etapa.</p>
            <button type="submit">Continuar para o briefing</button>
            {hasExistingDraft && <button type="button" className="briefing-resume" onClick={finishCreation}>Retomar preenchimento anterior{form.eventName ? ' · ' + form.eventName : ''}</button>}
            <p id="briefing-creation-error" role="alert">{creationError}</p>
          </form>
        </main>
      </div>
    );
  }
  if (!started) return (
    <div className={"hero-scene welcome-scene nexo-light-entry min-h-screen relative overflow-hidden" + (launching ? " is-launching" : "")}>
      <div className="welcome-page">
        <header className="welcome-header">
          <img src={BRAND.logoDark} alt={BRAND.name} />
          {apiStatus === 'ready' && <a className="welcome-portal-link" href="./portal.html">Minhas cotações</a>}
        </header>
        <main className="welcome-main">
          <section className="welcome-copy hero-enter" aria-labelledby="welcome-title">
            
            <h1 id="welcome-title">Cotações para eventos corporativos</h1>
            <p className="welcome-description">Solicite aéreo, hospedagem, espaços, alimentação e transporte em um único briefing. Acompanhe seu pedido até a proposta.</p>
            <button onClick={startQuote} disabled={launching} className="welcome-cta">
              <span>Iniciar cotação</span>
            </button>
            <p className="welcome-reassurance">Você pode revisar tudo antes de enviar.</p>
          </section>
          <div className="welcome-preview">
            <img src={BRAND.heroImage} alt="Participantes chegando a um evento corporativo" fetchPriority="high" width="1672" height="941" />
          </div>

        </main>

      </div>
      {launching && <div className="launch-overlay" aria-hidden="true" />}
    </div>
  );

  if (registration) return (
    <main className="confirmation-shell">
      <img src={BRAND.logoLight} alt={BRAND.name} className="confirmation-logo" />
      <section className="confirmation-card" aria-labelledby="confirmation-heading">
        <p className="confirmation-eyebrow">BRIEFING ENVIADO</p>
        <h1 id="confirmation-heading">Solicitação registrada.</h1>
        <p>A equipe recebeu seu briefing. Você pode acompanhar a análise e responder a pedidos de informação pelo portal.</p>
        <div className="confirmation-protocol"><span>Protocolo</span><strong>#{String(registration.protocol).padStart(6,'0')}</strong></div>
        <dl><div><dt>Situação</dt><dd>{REQUEST_STATUS_LABELS[registration.status] || 'Registrada'}</dd></div><div><dt>Registro (Brasília)</dt><dd>{new Date(registration.createdAt).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})}</dd></div></dl>
        <div className="confirmation-notice"><strong>Acompanhe pelo seu painel.</strong><p>Se a equipe precisar de mais informações, a pendência aparecerá na cotação.</p></div>
        <div className="confirmation-actions"><a className="register-button" href={'/portal.html?cotacao=' + encodeURIComponent(registration.id)}>Acompanhar esta cotação</a><button type="button" className="confirmation-refresh" onClick={checkRegistration} disabled={checkingRegistration}>{checkingRegistration ? 'Atualizando…' : 'Atualizar status'}</button></div>
        {submitError && <p className="submission-error" role="alert">{submitError}</p>}
      </section>
    </main>
  );

  return (
    <React.Fragment>
      <div className="quote-shell">
      <header className="planning-header">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={BRAND.logoLight} alt={BRAND.name} className="h-7 sm:h-8" />
          </div>

          <div className="quote-deadline flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <span className="font-medium">
              Cotação: <strong className="font-semibold">{OPERATION.quoteDeadline}</strong> após briefing completo
            </span>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="quote-main">
        <aside className="live-summary" aria-label="Resumo do planejamento">
          <a className="summary-home" href="/portal.html"> Minhas cotações</a>
          
          <span className="quote-eyebrow font-sans text-[10px] font-bold tracking-[.18em] uppercase text-pt-yellow1 border-pt-yellow1/30">
            {BRAND.name.toUpperCase()} / {BRAND.category.toUpperCase()}
          </span>
          <div className="briefing-progress">
            <p className="summary-progress">Etapa {safeStepIdx + 1} de {steps.length} · {currentStep.label}</p>
            <progress aria-label="Progresso do briefing" max={steps.length} value={safeStepIdx + 1} />
          </div><div className="summary-heading">
            <span className="font-bold tracking-[.14em] uppercase text-[10px] text-slate-300">SEU PLANEJAMENTO</span>
            <span className="summary-tag font-semibold text-[10px]">{currentStep.id === 'revisao' ? 'Em revisão' : 'Rascunho'}</span>
          </div>
          <h1 className="font-serif font-normal text-3xl sm:text-4xl text-white tracking-tight mt-3 mb-2">
            {form.eventName || 'Seu próximo encontro'}
          </h1>

          <button className="summary-toggle" type="button" aria-expanded={summaryOpen} aria-controls="planning-details" onClick={() => setSummaryOpen(open => !open)}>{summaryOpen ? 'Recolher resumo −' : 'Ver e editar resumo +'}</button>
          <div id="planning-details" className="summary-body" data-open={summaryOpen}>
            <button type="button" className="summary-item" onClick={() => editStep('evento', 'event-destination', 'Destino')}><span>Destino <small>Editar <PencilIcon /></small></span><strong>{form.destination || 'Onde será o encontro?'}</strong></button>
            <button type="button" className="summary-item" onClick={() => editStep('evento', 'event-period', 'Período')}><span>Período <small>Editar <PencilIcon /></small></span><strong>{periodCaption}</strong></button>
            <button type="button" className="summary-item" onClick={() => editStep('evento', 'participants', 'Participantes')}><span>Participantes <small>Editar <PencilIcon /></small></span><strong>{participantCaption}</strong></button>
            <div className="summary-services">
              <div className="summary-section-label font-bold text-xs">Serviços <button type="button" onClick={() => editStep('evento', 'event-services', 'Serviços')}>Alterar <PencilIcon /></button></div>
              {selectedServices.length ? selectedServices.map(service => (
                <button type="button" className="summary-service" data-active={currentStep.id === service.id} aria-current={currentStep.id === service.id ? 'step' : undefined} key={service.id} onClick={() => editStep(service.id)}><span>{service.label}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
              )) : <p>Selecione os serviços para personalizar o planejamento.</p>}
              {form.svcHospedagem && accommodationCalc.totalRooms > 0 && <p className="text-[11px] text-pt-yellow4/90 font-medium mt-2">{accommodationCalc.totalRooms} quartos · capacidade para {accommodationCalc.totalCapacity} pessoas</p>}
            </div>
            <button type="button" className="summary-item" onClick={() => editStep('empresa')}><span>Organização <small>Editar <PencilIcon /></small></span><strong>{form.companyName || 'Empresa a informar'}</strong>{form.requesterName && <em>{form.requesterName}</em>}</button>
          </div>

          {/* Foto Editorial do Brandbook: Triângulo como Luz Arquitetônica Real */}
          <div className="quote-editorial mt-5 rounded-2xl overflow-hidden relative shadow-md border border-white/10 hidden sm:block">
            <img src={BRAND.editorialImage} alt={BRAND.name} className="w-full h-36 object-cover object-top opacity-85 hover:scale-105 transition duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-pt-dark/95 via-pt-dark/40 to-transparent flex items-end p-3.5 pointer-events-none">
              <span className="text-[11px] text-white font-serif italic tracking-wide">
                Cada encontro começa com uma nova perspectiva.
              </span>
            </div>
          </div>

          <div className="summary-signature mt-4"><img src={BRAND.symbol} alt="" /><span>{BRAND.tagline}</span></div>
        </aside>        <div className="quote-content">
        <span className="sr-only" role="status" aria-live="polite">{focusMessage}</span>

        {DEMO_USER && <section className="account-draft-actions" aria-label="Salvar rascunho na conta"><button type="button" onClick={saveAccountDraft} disabled={remoteDraftSaving}>{remoteDraftSaving?'Salvando…':'Salvar rascunho na conta'}</button><p role="status">{remoteDraftMessage}</p></section>}
        <div className="draft-feedback" role="status" aria-live="polite">
          <span>{draftStatus === 'saved' ? 'Rascunho salvo neste navegador' : draftStatus === 'saving' ? 'Salvando rascunho…' : 'Não foi possível salvar o rascunho. Mantenha esta página aberta.'}</span>
          <small>{apiStatus === 'ready' ? 'Ambiente demo • e-mail real desativado' : 'Preenchimento e exportação • sem registro em servidor'}</small>
        </div>
        {/* CARD PRINCIPAL DA ETAPA */}
        <div ref={quoteCardRef} style={{"--slide-from": slideDirection > 0 ? "18px" : "-18px", "--slide-out": slideDirection > 0 ? "-8px" : "8px"}} className="quote-card bg-white overflow-hidden" onBlurCapture={e=>{const issue=issues.find(x=>x.fieldId===e.target.id);if(issue)setErrors(prev=>({...prev,[issue.field]:issue.message}));}}> 
          <div key={currentStep.id} className={"step-content step-enter p-5 sm:p-7" + (stepLeaving ? " is-leaving" : "")}>
            {renderCurrentStep()}
          </div>

          {safeStepIdx < steps.length - 1 && <p className="next-step-hint">A seguir: <strong>{editingFromReview ? 'Revisão do briefing' : steps[safeStepIdx + 1].label}</strong></p>}
          {/* BOTÕES DE NAVEGAÇÃO INFERIOR */}
          <div className="planning-navigation flex items-center justify-between px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-100">
            <button
              type="button"
              onClick={goPrev}
              disabled={safeStepIdx === 0 && !editingFromReview}
              style={safeStepIdx === 0 && !editingFromReview ? {visibility: 'hidden'} : undefined}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition
                ${safeStepIdx === 0 && !editingFromReview
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-700 hover:bg-slate-200 active:bg-slate-300'}`}
            >
              <i data-lucide="arrow-left" className="w-4 h-4"></i>
              {editingFromReview ? "Voltar à revisão" : "Voltar"}
            </button>

            {safeStepIdx < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="quote-next px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-pt-blue1 text-white flex items-center gap-2 hover:bg-pt-blue2 active:bg-pt-blue3 transition shadow-md hover:shadow-lg"
              >
                <span>{editingFromReview ? "Concluir edição" : currentStep.id === "empresa" ? "Revisar briefing" : "Avançar"}</span>
                <i data-lucide="arrow-right" className="w-4 h-4"></i>
              </button>
            ) : (
              <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <i data-lucide="check-circle" className="w-4 h-4"></i>
                Revise antes de enviar
              </div>
            )}
          </div>
        </div>
      </div></main>
      {/* ── FOOTER ── */}
      <footer className="bg-pt-dark text-slate-400 py-4 text-center text-xs border-t-2 border-pt-yellow1/30 mt-auto">
        <div className="flex items-center justify-center gap-2">
          <img src={BRAND.symbol} alt="" className="h-4 opacity-80" />
          <span>© {new Date().getFullYear()} {BRAND.name} — Gestão de Grupos e Eventos</span>
          {apiStatus === 'ready' && <a className="team-entry" href="./portal.html">Acessar meu painel</a>}
        </div>
      </footer>

      </div>
      {/* ── ÁREA DE IMPRESSÃO EXECUTIVA / RELATÓRIO PDF ── */}
      <div id="printable-report" className="p-8 font-sans text-black">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--theme-primary)', paddingBottom: '12px', marginBottom: '20px' }}>
          <div>
            <img src={BRAND.logoDark} alt={BRAND.name} style={{ height: '36px', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', color: '#666' }}>Briefing Oficial de Grupos e Eventos Corporativos</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#444' }}>
            <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            <div><strong>Prazo Cotação:</strong> {OPERATION.quoteDeadline}</div>
            <div><strong>Atendimento:</strong> {OPERATION.contactEmail || OPERATION.contactLabel}</div>
          </div>
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--theme-primary)', marginBottom: '16px' }}>
          {form.eventName || 'Briefing de Evento'}
        </h2>

        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '11px', lineHeight: '1.6', background: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
          {generateSummaryText()}
        </pre>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════
   INICIALIZAÇÃO DO REACT COM ERROR BOUNDARY
   ═══════════════════════════════════════════════════════════ */
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

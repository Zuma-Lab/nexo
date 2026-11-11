(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BriefingRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const serviceFields = {
    svcAereo: ['airlinePreference','specificAirline','restrictedAirline','departureTimes','returnTimes','cabinClass','cabinClassNotes','flightConnection','maxLayoverHours','baggageType','aereoNotes','aereoGuidance'],
    svcHospedagem: ['hotelStandard','hotelLocationPref','eventAddress','hotelLocationOther','roomsSingle','roomsDoubleTwin','roomsDoubleCasal','roomsTriple','mealRegime','roomingList','hospedagemNotes','hospedagemGuidance'],
    svcEspacoAlimentacao: ['plenaryCapacity','roomLayout','roomLayoutOther','breakoutRoomsCount','avServices','avOtherNotes','cateringServices','coffeeBreakPerDay','espacoAlimentacaoNotes','espacoGuidance'],
    svcTransfers: ['transferTypes','vehicleType','dedicatedVehicleHoursDays','transfersNotes','transfersGuidance']
  };
  const arrayFields = ['departureTimes','returnTimes','avServices','cateringServices','transferTypes'];
  const flags = [...Object.keys(serviceFields),'costCenterNotApplicable','datesUnknown','datesFlexible','participantsUnknown','participantsEstimated','aereoGuidance','hospedagemGuidance','espacoGuidance','transfersGuidance'];
  const basicFields = ['companyName','cnpj','requesterName','requesterRole','email','phone','costCenter','extraBillingType','eventName','totalPassengers','destination','departureDate','returnDate','desiredBudget','generalNotes'];
  const keys = [...new Set([...basicFields,...flags,...Object.values(serviceFields).flat()])];
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  function todayInBrazil() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(p=>p.type===type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  const isBlank = value => value === undefined || value === null || String(value).trim() === '';
  const integer = (value,min=0) => !isBlank(value) && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value)>=min && Number(value)<=100000;
  function collectIssues(input, today = todayInBrazil()) {
    const f = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const result=[];
    const add=(step,field,fieldId,label,message)=>result.push({step,field,fieldId,label,message});
    const required=(field,step,id,label)=>{if(typeof f[field]!=='string'||!f[field].trim())add(step,field,id,label,'Informe '+label.toLowerCase()+'.');};
    for(const flag of flags) if(f[flag]!==undefined && typeof f[flag]!=='boolean') add('evento',flag,'section-heading','Opções do briefing','Revise as opções selecionadas.');
    for(const field of keys) {
      if(flags.includes(field)||f[field]===undefined)continue;
      if(arrayFields.includes(field)) {
        if(!Array.isArray(f[field])||f[field].length>30||f[field].some(x=>typeof x!=='string'||x.length>300))add('evento',field,'section-heading','Seleções','Revise as opções selecionadas.');
      } else if(!['string','number'].includes(typeof f[field]) || String(f[field]).length>10000) add('evento',field,'section-heading','Informações','Revise o formato ou o tamanho das informações.');
    }
    required('eventName','evento','event-name','Nome do evento');
    required('destination','evento','event-destination','Destino');
    if(f.participantsUnknown!==true && !integer(f.totalPassengers,1)) add('evento','totalPassengers','participants','Participantes','Informe um número inteiro de participantes ou marque que ainda não sabe.');
    if(f.datesUnknown!==true) {
      if(!validDate(f.departureDate)) add('evento','departureDate','event-period','Data de início','Informe a data de início ou marque que as datas estão indefinidas.');
      else if(f.departureDate<today) add('evento','departureDate','event-period','Data de início','A data de início não pode estar no passado.');
      if(!validDate(f.returnDate)) add('evento','returnDate','brief-field-6','Data de término','Informe a data de término.');
      else if(validDate(f.departureDate)&&f.returnDate<f.departureDate)add('evento','returnDate','brief-field-6','Data de término','O término deve ser na data de início ou depois.');
    }
    if(!Object.keys(serviceFields).some(k=>f[k]===true))add('evento','services','event-services','Serviços','Selecione pelo menos um serviço.');
    required('companyName','empresa','company-name','Empresa');
    required('requesterName','empresa','brief-field-2','Nome do solicitante');
    if(!validEmail(f.email))add('empresa','email','brief-field-4','E-mail','Informe um e-mail válido para contato.');
    if(!isBlank(f.phone)&&!/^\d{10,11}$/.test(String(f.phone).replace(/\D/g,'')))add('empresa','phone','brief-field-5','Telefone','Informe telefone com DDD (10 ou 11 dígitos) ou deixe em branco.');
    if(!isBlank(f.cnpj)&&String(f.cnpj).replace(/\D/g,'').length!==14)add('empresa','cnpj','brief-field-1','CNPJ','Confira o CNPJ: informe os 14 dígitos ou deixe em branco.');
    if(f.svcAereo===true) {
      if(f.airlinePreference==='Somente Companhia Específica')required('specificAirline','aereo','brief-field-7','Companhia aérea');
      if(f.airlinePreference==='Restrição de Companhia Aérea por Política Interna')required('restrictedAirline','aereo','brief-field-8','Companhia restrita');
      if(f.cabinClass==='Misto / Por Cargo')required('cabinClassNotes','aereo','cabin-notes','Distribuição das cabines');
      if(f.flightConnection==='Aceita Conexão'&&!isBlank(f.maxLayoverHours)&&(!Number.isFinite(Number(f.maxLayoverHours))||Number(f.maxLayoverHours)<=0))add('aereo','maxLayoverHours','layover-hours','Tempo de conexão','Informe um tempo de conexão maior que zero.');
    }
    if(f.svcHospedagem===true) {
      if(f.hotelLocationPref==='Outro')required('hotelLocationOther','hospedagem','brief-field-9','Localização do hotel');
      for(const field of ['roomsSingle','roomsDoubleTwin','roomsDoubleCasal','roomsTriple'])if(!isBlank(f[field])&&!integer(f[field]))add('hospedagem',field,'rooms-distribution','Quartos','As quantidades de quartos devem ser inteiras e não negativas.');
    }
    if(f.svcEspacoAlimentacao===true) {
      for(const [field,id] of [['plenaryCapacity','brief-field-10'],['breakoutRoomsCount','brief-field-11']])if(!isBlank(f[field])&&!integer(f[field]))add('espaco',field,id,'Quantidade de salas e participantes','Informe uma quantidade inteira e não negativa.');
      if(Array.isArray(f.cateringServices)&&f.cateringServices.includes('Coffee Break')&&!['','1','2','3','Preciso de orientação',undefined].includes(f.coffeeBreakPerDay))add('espaco','coffeeBreakPerDay','brief-field-12','Coffee break','Selecione uma frequência válida.');
    }
    return result;
  }
  function prepareSubmission(input) {
    const source=input||{}, f={};
    for(const field of keys) {
      if(flags.includes(field)) f[field]=source[field]===true;
      else if(arrayFields.includes(field)) f[field]=Array.isArray(source[field])?source[field].filter(x=>typeof x==='string'):[];
      else f[field]=source[field]===undefined?'':String(source[field]).trim();
    }
    for(const [flag,fields] of Object.entries(serviceFields)) if(!f[flag])for(const key of fields) f[key]=flags.includes(key)?false:arrayFields.includes(key)?[]:'';
    if(f.datesUnknown){f.departureDate='';f.returnDate='';f.datesFlexible=false;}
    if(f.participantsUnknown){f.totalPassengers='';f.participantsEstimated=false;}
    if(f.costCenterNotApplicable)f.costCenter='';
    if(f.airlinePreference!=='Somente Companhia Específica')f.specificAirline='';
    if(f.airlinePreference!=='Restrição de Companhia Aérea por Política Interna')f.restrictedAirline='';
    if(f.cabinClass!=='Misto / Por Cargo')f.cabinClassNotes='';
    if(f.flightConnection!=='Aceita Conexão')f.maxLayoverHours='';
    if(f.hotelLocationPref!=='Outro')f.hotelLocationOther='';
    if(f.hotelLocationPref!=='Próximo ao Local do Evento')f.eventAddress='';
    if(!f.cateringServices.includes('Coffee Break'))f.coffeeBreakPerDay='';
    if(!f.transferTypes.includes('Veículo Exclusivo à Disposição'))f.dedicatedVehicleHoursDays='';
    return f;
  }
  return {collectIssues,prepareSubmission,validEmail,todayInBrazil};
});

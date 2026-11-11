(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BriefingView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const groups=[
    ['event','Evento',null,{eventName:'Nome do evento',destination:'Destino',departureDate:'Início',returnDate:'Término',datesUnknown:'Datas a definir',datesFlexible:'Datas flexíveis',totalPassengers:'Participantes',participantsUnknown:'Participantes a definir',participantsEstimated:'Quantidade estimada'}],
    ['company','Empresa e solicitante',null,{companyName:'Empresa',cnpj:'CNPJ',requesterName:'Solicitante',requesterRole:'Cargo',email:'E-mail',phone:'Telefone',costCenter:'Centro de custo / projeto',costCenterNotApplicable:'Centro de custo não se aplica',extraBillingType:'Pagamento de extras'}],
    ['air','Aéreo','svcAereo',{airlinePreference:'Preferência de companhia',specificAirline:'Companhia específica',restrictedAirline:'Companhia com restrição',departureTimes:'Horários de ida',returnTimes:'Horários de volta',cabinClass:'Cabine',cabinClassNotes:'Detalhes da cabine',flightConnection:'Conexões',maxLayoverHours:'Conexão máxima (horas)',baggageType:'Bagagem',aereoNotes:'Observações',aereoGuidance:'Orientação solicitada'}],
    ['hotel','Hospedagem','svcHospedagem',{hotelStandard:'Padrão do hotel',hotelLocationPref:'Localização',eventAddress:'Endereço do evento',hotelLocationOther:'Outra localização',roomsSingle:'Quartos single',roomsDoubleTwin:'Quartos duplos twin',roomsDoubleCasal:'Quartos duplos casal',roomsTriple:'Quartos triplos',mealRegime:'Regime de alimentação',roomingList:'Rooming list preliminar',hospedagemNotes:'Observações',hospedagemGuidance:'Orientação solicitada'}],
    ['venue','Salas e alimentação','svcEspacoAlimentacao',{plenaryCapacity:'Capacidade da sala',roomLayout:'Formato da sala',roomLayoutOther:'Outro formato',breakoutRoomsCount:'Salas de apoio',avServices:'Equipamentos',avOtherNotes:'Outros equipamentos',cateringServices:'Alimentação',coffeeBreakPerDay:'Coffee breaks por dia',espacoAlimentacaoNotes:'Observações',espacoGuidance:'Orientação solicitada'}],
    ['transfer','Transfer','svcTransfers',{transferTypes:'Trechos',vehicleType:'Veículo',dedicatedVehicleHoursDays:'Veículo à disposição',transfersNotes:'Observações',transfersGuidance:'Orientação solicitada'}],
    ['notes','Observações gerais',null,{desiredBudget:'Investimento desejado',generalNotes:'Observações'}]
  ];
  function sections(form){
    if(!form||typeof form!=='object'||Array.isArray(form))return [];
    const services=groups.filter(([, ,flag])=>flag&&form[flag]===true).map(([,title])=>title);
    const result=groups.filter(([, ,flag])=>!flag||form[flag]===true).map(([id,title,,fields])=>({id,title,fields:Object.entries(fields).flatMap(([key,label])=>{
      const value=form[key];if(value===undefined||value===null||value===''||value===false||Array.isArray(value)&&!value.length)return [];
      if(typeof value==='object'&&!Array.isArray(value))return [];
      const display=value===true?'Sim':Array.isArray(value)?value.filter(x=>typeof x==='string').join(', '):String(value);
      return [{key,label,value:display}];
    })})).filter(s=>s.fields.length||groups.find(g=>g[0]===s.id)[2]);
    const event=result.find(s=>s.id==='event');if(event&&services.length)event.fields.push({key:'services',label:'Serviços solicitados',value:services.join(', ')});
    for(const section of result)if(!section.fields.length)section.fields.push({key:'preferences',label:'Preferências adicionais',value:'A definir com a equipe'});
    return result;
  }
  return {sections};
});

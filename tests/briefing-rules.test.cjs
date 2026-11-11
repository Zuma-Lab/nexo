const test = require('node:test');
const assert = require('node:assert/strict');
const { collectIssues, prepareSubmission } = require('../briefing-rules.js');

const TODAY = '2030-01-01';
function valid(overrides = {}) {
  return {
    companyName: 'Empresa de Teste',
    requesterName: 'Solicitante Silva',
    email: 'solicitante@empresa.com.br',
    eventName: 'Encontro de lideranças',
    destination: 'São Paulo - SP',
    totalPassengers: '40',
    departureDate: '2030-01-10',
    returnDate: '2030-01-12',
    svcAereo: true,
    ...overrides,
  };
}
const issues = (overrides = {}) => collectIssues(valid(overrides), TODAY);
const hasIssue = (result, field) => result.some(issue => issue.field === field);

test('empty, missing and array payloads produce actionable essential-field issues', () => {
  for (const input of [{}, undefined, null, []]) {
    const result = collectIssues(input, TODAY);
    for (const field of ['companyName', 'requesterName', 'email', 'eventName', 'destination', 'totalPassengers', 'departureDate', 'returnDate', 'services']) {
      assert.ok(hasIssue(result, field), `missing issue for ${field}`);
    }
    for (const issue of result) {
      for (const key of ['step', 'field', 'fieldId', 'label', 'message']) assert.ok(issue[key]);
    }
  }
});

test('valid briefing accepts an email containing s and a normal numeric participant count', () => {
  assert.deepEqual(issues(), []);
});

test('emails accept plus aliases and reject whitespace, missing host and missing at-sign', () => {
  assert.ok(!hasIssue(issues({ email: 'silva+eventos@empresa.com.br' }), 'email'));
  for (const email of ['nome sobrenome@empresa.com', 'nome@empresa .com', 'nome@', 'nomeempresa.com', 'nome@@empresa.com']) {
    assert.ok(hasIssue(issues({ email }), 'email'), email);
  }
});

test('blank required strings and numeric company or contact names remain invalid', () => {
  for (const field of ['companyName', 'requesterName', 'eventName', 'destination']) {
    for (const value of ['  ', '', 123]) assert.ok(hasIssue(issues({ [field]: value }), field));
  }
});

test('dates accept real leap days, today and a same-day event', () => {
  assert.ok(!hasIssue(issues({ departureDate: '2032-02-29', returnDate: '2032-02-29' }), 'departureDate'));
  assert.ok(!hasIssue(issues({ departureDate: TODAY, returnDate: TODAY }), 'departureDate'));
  assert.ok(!hasIssue(issues({ departureDate: TODAY, returnDate: TODAY }), 'returnDate'));
});

test('dates reject impossible calendar dates and malformed ISO strings', () => {
  for (const date of ['2030-02-29', '2030-04-31', '2030-13-01', '2030-00-10', '2030-01-00', '2030-1-10', '10/01/2030']) {
    assert.ok(hasIssue(issues({ departureDate: date }), 'departureDate'), date);
    assert.ok(hasIssue(issues({ returnDate: date }), 'returnDate'), date);
  }
});

test('dates reject a past start and an end before the start', () => {
  assert.ok(hasIssue(issues({ departureDate: '2029-12-31' }), 'departureDate'));
  assert.ok(hasIssue(issues({ returnDate: '2030-01-09' }), 'returnDate'));
});

test('flexibility still requires valid reference dates', () => {
  const result = issues({ datesFlexible: true, departureDate: '', returnDate: '' });
  assert.ok(hasIssue(result, 'departureDate'));
  assert.ok(hasIssue(result, 'returnDate'));
  assert.ok(!hasIssue(issues({ datesFlexible: true }), 'departureDate'));
});

test('unknown dates and participants dispense with those requirements and clear contradictory payload values', () => {
  const input = valid({ datesUnknown: true, datesFlexible: true, departureDate: '2020-01-01', returnDate: 'bad-date', participantsUnknown: true, participantsEstimated: true, totalPassengers: '-1' });
  const result = collectIssues(input, TODAY);
  assert.ok(!hasIssue(result, 'departureDate'));
  assert.ok(!hasIssue(result, 'returnDate'));
  assert.ok(!hasIssue(result, 'totalPassengers'));
  const prepared = prepareSubmission(input);
  assert.equal(prepared.departureDate, '');
  assert.equal(prepared.returnDate, '');
  assert.equal(prepared.datesFlexible, false);
  assert.equal(prepared.totalPassengers, '');
  assert.equal(prepared.participantsEstimated, false);
});

test('participants accept integers only, including when estimated', () => {
  for (const count of ['1', '40', 25, '100000']) assert.ok(!hasIssue(issues({ totalPassengers: count }), 'totalPassengers'), String(count));
  for (const count of ['', '0', '-1', '1.5', '1e2', 'abc', '100001', Number.MAX_SAFE_INTEGER]) {
    assert.ok(hasIssue(issues({ totalPassengers: count, participantsEstimated: true }), 'totalPassengers'), String(count));
  }
});

test('at least one strict boolean service selection is required', () => {
  assert.ok(hasIssue(issues({ svcAereo: false }), 'services'));
  for (const selected of ['true', 1, {}]) {
    const result = issues({ svcAereo: selected });
    assert.ok(hasIssue(result, 'svcAereo'));
    assert.ok(hasIssue(result, 'services'));
  }
});

test('specific or restricted airlines require the appropriate conditional text', () => {
  assert.ok(hasIssue(issues({ airlinePreference: 'Somente Companhia Específica' }), 'specificAirline'));
  assert.ok(!hasIssue(issues({ airlinePreference: 'Somente Companhia Específica', specificAirline: 'LATAM' }), 'specificAirline'));
  assert.ok(hasIssue(issues({ airlinePreference: 'Restrição de Companhia Aérea por Política Interna' }), 'restrictedAirline'));
  assert.ok(!hasIssue(issues({ airlinePreference: 'Restrição de Companhia Aérea por Política Interna', restrictedAirline: 'Companhia X' }), 'restrictedAirline'));
  assert.ok(!hasIssue(issues({ svcAereo: false, svcTransfers: true, airlinePreference: 'Somente Companhia Específica' }), 'specificAirline'));
});

test('mixed cabins and optional connection duration validate only active conditions', () => {
  assert.ok(hasIssue(issues({ cabinClass: 'Misto / Por Cargo' }), 'cabinClassNotes'));
  assert.ok(!hasIssue(issues({ cabinClass: 'Misto / Por Cargo', cabinClassNotes: 'Diretoria executiva, equipe econômica' }), 'cabinClassNotes'));
  for (const maxLayoverHours of ['0', '-2', 'texto']) assert.ok(hasIssue(issues({ flightConnection: 'Aceita Conexão', maxLayoverHours }), 'maxLayoverHours'));
  assert.ok(!hasIssue(issues({ flightConnection: 'Aceita Conexão', maxLayoverHours: '' }), 'maxLayoverHours'));
  assert.ok(!hasIssue(issues({ flightConnection: 'Aceita Conexão', maxLayoverHours: '1.5' }), 'maxLayoverHours'));
  assert.ok(!hasIssue(issues({ flightConnection: 'Apenas Voo Direto', maxLayoverHours: '-2' }), 'maxLayoverHours'));
});

test('room counts and room-related capacities require nonnegative integers when provided', () => {
  for (const field of ['roomsSingle', 'roomsDoubleTwin', 'roomsDoubleCasal', 'roomsTriple']) {
    for (const value of ['0', '2', 3]) assert.ok(!hasIssue(issues({ svcHospedagem: true, [field]: value }), field));
    for (const value of ['-1', '0.5', 'NaN']) assert.ok(hasIssue(issues({ svcHospedagem: true, [field]: value }), field));
  }
  for (const field of ['plenaryCapacity', 'breakoutRoomsCount']) {
    assert.ok(!hasIssue(issues({ svcEspacoAlimentacao: true, [field]: '10' }), field));
    assert.ok(hasIssue(issues({ svcEspacoAlimentacao: true, [field]: '-1' }), field));
  }
});

test('alternative hotel location requires details but undefined event address does not', () => {
  assert.ok(hasIssue(issues({ svcHospedagem: true, hotelLocationPref: 'Outro' }), 'hotelLocationOther'));
  assert.ok(!hasIssue(issues({ svcHospedagem: true, hotelLocationPref: 'Outro', hotelLocationOther: 'Centro' }), 'hotelLocationOther'));
  assert.ok(!hasIssue(issues({ svcHospedagem: true, hotelLocationPref: 'Próximo ao Local do Evento', eventAddress: '' }), 'eventAddress'));
});

test('formatted phone and optional CNPJ accept valid lengths and reject malformed entries', () => {
  assert.ok(!hasIssue(issues({ phone: '(11) 99999-9999' }), 'phone'));
  assert.ok(!hasIssue(issues({ phone: '(11) 3333-4444' }), 'phone'));
  assert.ok(hasIssue(issues({ phone: '123' }), 'phone'));
  assert.ok(!hasIssue(issues({ cnpj: '12.345.678/0001-90' }), 'cnpj'));
  assert.ok(hasIssue(issues({ cnpj: '123456' }), 'cnpj'));
});

test('coffee break frequency is checked only while coffee break is selected', () => {
  assert.ok(hasIssue(issues({ svcEspacoAlimentacao: true, cateringServices: ['Coffee Break'], coffeeBreakPerDay: '9' }), 'coffeeBreakPerDay'));
  assert.ok(!hasIssue(issues({ svcEspacoAlimentacao: true, cateringServices: ['Coffee Break'], coffeeBreakPerDay: '2' }), 'coffeeBreakPerDay'));
  assert.ok(!hasIssue(issues({ svcEspacoAlimentacao: true, cateringServices: [], coffeeBreakPerDay: '9' }), 'coffeeBreakPerDay'));
});

test('tampered flag types, field shapes and arrays are rejected', () => {
  for (const field of ['datesUnknown', 'datesFlexible', 'participantsUnknown', 'participantsEstimated', 'aereoGuidance', 'costCenterNotApplicable']) {
    assert.ok(hasIssue(issues({ [field]: 'true' }), field));
  }
  for (const value of [null, {}, [], true]) assert.ok(hasIssue(issues({ companyName: value }), 'companyName'));
  for (const value of ['text', [1], [{}], new Array(31).fill('x'), ['x'.repeat(301)]]) assert.ok(hasIssue(issues({ departureTimes: value }), 'departureTimes'));
  assert.ok(hasIssue(issues({ generalNotes: 'x'.repeat(10001) }), 'generalNotes'));
});

test('preparation trims strings, preserves source and excludes unregistered fields', () => {
  const input = valid({ companyName: '  Empresa  ', totalPassengers: 25, departureTimes: ['Manhã'], injectedAdmin: true });
  const before = structuredClone(input);
  const prepared = prepareSubmission(input);
  assert.equal(prepared.companyName, 'Empresa');
  assert.equal(prepared.totalPassengers, '25');
  assert.deepEqual(prepared.departureTimes, ['Manhã']);
  assert.equal(Object.hasOwn(prepared, 'injectedAdmin'), false);
  assert.deepEqual(input, before);
});

test('inactive service fields and their guidance flags are cleared', () => {
  const prepared = prepareSubmission(valid({ svcAereo: false, svcHospedagem: false, svcEspacoAlimentacao: false, svcTransfers: true, specificAirline: 'LATAM', departureTimes: ['Manhã'], aereoGuidance: true, hotelStandard: 'Luxo', roomsSingle: '8', hospedagemGuidance: true, cateringServices: ['Coffee Break'], coffeeBreakPerDay: '3', espacoGuidance: true, transferTypes: ['Aeroporto ↔ Hotel'] }));
  assert.equal(prepared.specificAirline, '');
  assert.deepEqual(prepared.departureTimes, []);
  assert.equal(prepared.aereoGuidance, false);
  assert.equal(prepared.hotelStandard, '');
  assert.equal(prepared.roomsSingle, '');
  assert.equal(prepared.hospedagemGuidance, false);
  assert.deepEqual(prepared.cateringServices, []);
  assert.equal(prepared.coffeeBreakPerDay, '');
  assert.equal(prepared.espacoGuidance, false);
  assert.deepEqual(prepared.transferTypes, ['Aeroporto ↔ Hotel']);
});

test('hidden branches are cleared even if their service remains active', () => {
  const prepared = prepareSubmission(valid({ svcHospedagem: true, svcEspacoAlimentacao: true, svcTransfers: true, airlinePreference: 'Qualquer Companhia Aérea (Foco em Menor Tarifa e Melhor Malha)', specificAirline: 'LATAM', restrictedAirline: 'X', cabinClass: 'Econômica (Padrão corporativo)', cabinClassNotes: 'old', flightConnection: 'Apenas Voo Direto', maxLayoverHours: '8', hotelLocationPref: 'Próximo ao Aeroporto', eventAddress: 'old address', hotelLocationOther: 'old area', cateringServices: ['Jantar'], coffeeBreakPerDay: '3', transferTypes: ['Aeroporto ↔ Hotel'], dedicatedVehicleHoursDays: '8h', costCenterNotApplicable: true, costCenter: '123' }));
  for (const field of ['specificAirline', 'restrictedAirline', 'cabinClassNotes', 'maxLayoverHours', 'eventAddress', 'hotelLocationOther', 'coffeeBreakPerDay', 'dedicatedVehicleHoursDays', 'costCenter']) assert.equal(prepared[field], '', field);
});

test('active conditional branches are preserved during preparation', () => {
  const prepared = prepareSubmission(valid({ svcHospedagem: true, svcEspacoAlimentacao: true, svcTransfers: true, airlinePreference: 'Somente Companhia Específica', specificAirline: ' LATAM ', cabinClass: 'Misto / Por Cargo', cabinClassNotes: ' Equipe econômica ', flightConnection: 'Aceita Conexão', maxLayoverHours: '2', hotelLocationPref: 'Outro', hotelLocationOther: ' Centro ', cateringServices: ['Coffee Break'], coffeeBreakPerDay: '2', transferTypes: ['Veículo Exclusivo à Disposição'], dedicatedVehicleHoursDays: ' 8 horas ' }));
  assert.equal(prepared.specificAirline, 'LATAM');
  assert.equal(prepared.cabinClassNotes, 'Equipe econômica');
  assert.equal(prepared.maxLayoverHours, '2');
  assert.equal(prepared.hotelLocationOther, 'Centro');
  assert.equal(prepared.coffeeBreakPerDay, '2');
  assert.equal(prepared.dedicatedVehicleHoursDays, '8 horas');
});

test('preparation treats flags as strict booleans and normalizes malformed arrays', () => {
  const prepared = prepareSubmission(valid({ svcAereo: 'true', svcTransfers: true, datesUnknown: 'true', participantsUnknown: 1, departureTimes: 'Manhã', transferTypes: ['Aeroporto ↔ Hotel', 1, null], transfersGuidance: 'true' }));
  assert.equal(prepared.svcAereo, false);
  assert.equal(prepared.datesUnknown, false);
  assert.equal(prepared.participantsUnknown, false);
  assert.equal(prepared.transfersGuidance, false);
  assert.deepEqual(prepared.departureTimes, []);
  assert.deepEqual(prepared.transferTypes, ['Aeroporto ↔ Hotel']);
  assert.equal(prepared.departureDate, '2030-01-10');
});

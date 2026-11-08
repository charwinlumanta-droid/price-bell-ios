// Pure alert rules shared by the installable iPhone web app and its tests.
// Storage and notification side effects belong to app.js, after a successful save.
export const QUEUE_LIMIT = 20;
export const HISTORY_LIMIT = 500;
export const CATEGORIES = Object.freeze({
  general: Object.freeze({name:'Price alert', color:'#eac77c'}),
  sl: Object.freeze({name:'Stop loss', color:'#ff8390'}),
  tp: Object.freeze({name:'Take profit', color:'#72ebc6'}),
  be: Object.freeze({name:'Break even', color:'#80bdff'}),
  poi: Object.freeze({name:'Approaching POI', color:'#c49aff'})
});
const MODES = new Set(['cross', 'above', 'below']);
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 100;

export function initialState() {
  return {schema:1, provider:'Deriv', symbol:'stpRNG', volume:85, alerts:[], history:[]};
}
export function validateMarket(provider, symbol) {
  if (typeof symbol !== 'string') return false;
  return provider === 'Deriv' ? /^[A-Za-z0-9_]{1,40}$/.test(symbol)
    : provider === 'Binance' && /^[A-Z0-9]{3,30}$/.test(symbol);
}
export function hit(alert, price, previous) {
  if (!finiteNumber(alert?.target) || !finiteNumber(price)) return false;
  if (alert.mode === 'above') return price >= alert.target;
  if (alert.mode === 'below') return price <= alert.target;
  if (alert.mode !== 'cross') return false;
  return price === alert.target || (finiteNumber(previous) &&
    ((previous < alert.target && price > alert.target) ||
     (previous > alert.target && price < alert.target)));
}

function decimalNumber(raw) {
  if (finiteNumber(raw)) return raw;
  if (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
// A null result means the packet is not a matching fresh price tick.
// Control packets are ignored; provider rejections are surfaced to the caller.
export function decodeTick(provider, symbol, raw, now = Date.now(), previousAt) {
  if (!validateMarket(provider, symbol) || !finiteNumber(now)) return null;
  let body;
  try { body = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.error) throw new Error('Provider rejected this market. Refresh symbols or choose another market.');
  const tick = provider === 'Deriv' ? body.tick : body;
  if (!tick || typeof tick !== 'object' || Array.isArray(tick)) return null;
  if ((provider === 'Deriv' ? tick.symbol : tick.s) !== symbol) return null;
  const value = provider === 'Deriv' ? tick.quote : tick.p;
  const stamp = provider === 'Deriv' ? tick.epoch : tick.T;
  if (!finiteNumber(stamp) || stamp <= 0) return null;
  const price = decimalNumber(value);
  if (price === null) return null;
  const at = provider === 'Deriv' ? stamp * 1000 : stamp;
  if (!finiteNumber(at) || now - at > 30000 || at - now > 10000 ||
      (finiteNumber(previousAt) && at < previousAt)) return null;
  return {price, at};
}

function cleanAlert(alert) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert) ||
      !validId(alert.id) || !validateMarket(alert.provider, alert.symbol) ||
      !Object.hasOwn(CATEGORIES, alert.category) || !MODES.has(alert.mode) ||
      !finiteNumber(alert.target) || (alert.armed !== undefined && typeof alert.armed !== 'boolean')) {
    throw new Error('Saved alert data is invalid. Keep your backup and review the imported file.');
  }
  const clean = {id:alert.id, provider:alert.provider, symbol:alert.symbol,
    category:alert.category, mode:alert.mode, target:alert.target, armed:alert.armed !== false};
  if (validId(alert.sourceId)) clean.sourceId = alert.sourceId;
  return clean;
}
function cleanHistory(alert) {
  const clean = cleanAlert(alert);
  if (!finiteNumber(alert.firedAt) || alert.firedAt <= 0 || !finiteNumber(alert.firedPrice)) {
    throw new Error('Saved history data is invalid. Keep your backup and review the imported file.');
  }
  return {...clean, armed:false, firedAt:alert.firedAt, firedPrice:alert.firedPrice};
}
function orderedHistory(history) {
  const unique = new Map();
  for (const alert of history) if (!unique.has(alert.id)) unique.set(alert.id, {...alert});
  return [...unique.values()].sort((a,b) => b.firedAt - a.firedAt).slice(0,HISTORY_LIMIT);
}
// Normalizes this web app's schema and imports legacy fired queue entries once.
// Invalid/future data is rejected rather than silently overwriting saved levels.
export function migrateState(input) {
  if (input === undefined || input === null) return initialState();
  if (typeof input !== 'object' || Array.isArray(input) ||
      (input.schema !== undefined && input.schema !== 1)) throw new Error('Unsupported Price Bell backup format.');
  const defaults = initialState();
  const provider = input.provider ?? defaults.provider;
  const symbol = input.symbol ?? (provider === 'Binance' ? 'BTCUSDT' : defaults.symbol);
  const volume = input.volume ?? defaults.volume;
  if (!validateMarket(provider,symbol) || !Number.isInteger(volume) || volume < 10 || volume > 100 ||
      (input.alerts !== undefined && !Array.isArray(input.alerts)) ||
      (input.history !== undefined && !Array.isArray(input.history))) throw new Error('Saved Price Bell settings are invalid.');
  const history = (input.history || []).map(cleanHistory), alerts = [], queuedIds = new Set();
  for (const item of input.alerts || []) {
    if (item?.armed === false && finiteNumber(item.firedAt) && item.firedAt > 0) {
      history.push(cleanHistory(item));
    } else {
      const alert = cleanAlert(item);
      if (queuedIds.has(alert.id)) throw new Error('The saved queue contains duplicate alert IDs.');
      queuedIds.add(alert.id); alerts.push(alert);
    }
  }
  if (alerts.length > QUEUE_LIMIT) throw new Error('This backup contains more than 20 queued alerts.');
  return {schema:1, provider, symbol, volume, alerts, history:orderedHistory(history)};
}
export function archiveTick(state, key, quote, previous) {
  const alerts = state.alerts.map(alert => ({...alert}));
  const fired = [];
  if (!quote || !finiteNumber(quote.price) || !finiteNumber(quote.at) || quote.at <= 0) {
    return {state:{...state, alerts, history:state.history.map(alert => ({...alert}))}, fired};
  }
  for (const alert of alerts) {
    if (alert.armed && alert.provider + ':' + alert.symbol === key && hit(alert,quote.price,previous)) {
      fired.push({...alert, armed:false, firedAt:quote.at, firedPrice:quote.price});
    }
  }
  const ids = new Set(fired.map(alert => alert.id));
  return {state:{...state, alerts:alerts.filter(alert => !ids.has(alert.id)),
    history:orderedHistory([...fired,...state.history])}, fired};
}
export function rearmHistory(state, id, newId) {
  const source = state.history.find(alert => alert.id === id);
  if (!source) throw new Error('This history entry is no longer available.');
  if (state.alerts.length >= QUEUE_LIMIT) throw new Error('Your queue holds 20 alerts. Remove one before rearming.');
  if (!validId(newId) || state.alerts.some(alert => alert.id === newId) || state.history.some(alert => alert.id === newId)) {
    throw new Error('A new unique alert ID is required.');
  }
  const clean = cleanHistory(source);
  const alert = {id:newId, provider:clean.provider, symbol:clean.symbol,
    category:clean.category, mode:clean.mode, target:clean.target, armed:true, sourceId:clean.id};
  return {...state, alerts:[alert,...state.alerts.map(item => ({...item}))],
    history:state.history.map(item => ({...item}))};
}


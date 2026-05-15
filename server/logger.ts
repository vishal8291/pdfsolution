const IS_PROD = process.env.NODE_ENV === 'production';
function writeLog(level: string, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (IS_PROD) { process.stdout.write(JSON.stringify({ ts, level, msg, ...meta }) + '
'); }
  else {
    const c = level==='ERROR'?'[31m':level==='WARN'?'[33m':'[36m';
    console.log(c+'['+level+'][0m '+ts+' '+msg+(meta?' '+JSON.stringify(meta):''));
  }
}
export const log = {
  info:  (msg: string, meta?: Record<string, unknown>) => writeLog('INFO',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => writeLog('WARN',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeLog('ERROR', msg, meta),
};

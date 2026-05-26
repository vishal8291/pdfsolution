const IS_PROD = process.env.NODE_ENV === 'production';
function writeLog(level: string, msg: string, meta?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    if (IS_PROD) { process.stdout.write(JSON.stringify({ ts, level, msg, ...meta }) + '\n'); }
    else {
          const c = level==='ERROR'?'\x1b[31m':level==='WARN'?'\x1b[33m':'\x1b[36m';
          console.log(c+'['+level+']\x1b[0m '+ts+' '+msg+(meta?' '+JSON.stringify(meta):''));
    }
}
export const log = {
    info:  (msg: string, meta?: Record<string, unknown>) => writeLog('INFO',  msg, meta),
    warn:  (msg: string, meta?: Record<string, unknown>) => writeLog('WARN',  msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => writeLog('ERROR', msg, meta),
};

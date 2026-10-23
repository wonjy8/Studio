// Only the standalone entry point installs process-level signal handlers.
export function installGracefulShutdown(server, {signals=process,timeoutMs=8000,onFailure=()=>{process.exitCode=1;}}={}) {
  let closing=false,forced=false,timer;
  const stop=()=>{
    if(closing)return;
    closing=true;
    timer=setTimeout(()=>{
      forced=true;
      onFailure();
      server.closeAllConnections();
    },timeoutMs);
    timer.unref();
    // Existing server 'close' listeners release integrations, the worker and DB
    // after the last HTTP connection drains. Do not close SQLite mid-request.
    server.close(error=>{
      clearTimeout(timer);
      if(error&&!forced)onFailure();
      dispose();
    });
    server.closeIdleConnections();
  };
  const drainResponse=(_request,response)=>response.once("finish",()=>{if(closing)setImmediate(()=>server.closeIdleConnections());});
  server.on("request",drainResponse);
  const dispose=()=>{
    clearTimeout(timer);
    server.removeListener('request',drainResponse);
    signals.removeListener('SIGTERM',stop);
    signals.removeListener('SIGINT',stop);
  };
  signals.on('SIGTERM',stop);
  signals.on('SIGINT',stop);
  return dispose;
}

// Failures outside a per-account sync (e.g. the initial DB query) must not
// become unhandled rejections from a timer and terminate the HTTP process.
export function backgroundInterval(task, milliseconds, {label='integration',now=Date.now,report=message=>console.error(message)}={}) {
  let reportedAt=null;
  const timer=setInterval(()=>{
    Promise.resolve().then(task).catch(()=>{
      const time=now();
      if(reportedAt!==null&&time-reportedAt<60000)return;
      reportedAt=time;
      // Static label only: never log provider errors, tokens or account data.
      try {report('Studio '+label+' background cycle failed; retrying next interval.');} catch { /* Logging must not crash the service. */ }
    });
  },milliseconds);
  timer.unref();
  return timer;
}

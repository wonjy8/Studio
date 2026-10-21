// Date inputs require ISO calendar dates regardless of the browser's locale pattern.
export function calendarDateRange(timeZone,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
 const today=`${parts.year}-${parts.month}-${parts.day}`,start=today.slice(0,7)+'-01',next=new Date(Date.UTC(Number(parts.year),Number(parts.month),1));
 return {today,start,end:next.toISOString().slice(0,10)};
}

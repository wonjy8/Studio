// The grid uses local Date constructors, so its default month must also be local.
export function localCalendarMonth(now=new Date()){
 return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

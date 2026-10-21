const key=namespace=>'studio.bibleVersions.v1:'+namespace;
export function readBibleVersionPreferences(namespace){try{const value=JSON.parse(localStorage.getItem(key(namespace)));return value&&typeof value.primary==='string'&&value.primary.length<=200&&typeof value.secondary==='string'&&value.secondary.length<=200?value:null;}catch{return null;}}
export function saveBibleVersionPreferences(namespace,value){try{localStorage.setItem(key(namespace),JSON.stringify(value));}catch{}}

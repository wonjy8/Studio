// Range rows can span days; canonical identity deduplicates each displayed day,
// while the provider locator also reconciles older minimal display snapshots.
export function mergeGoogleProjectEvents(originals,linked,{sourceVisible,googleSource,activeAccountId='',membershipsVerified=false}){
 const result=[],byCanonical=new Map(),byLocator=new Map();
 for(const [rows,original] of [[originals,true],[linked,false]])for(const event of rows){
  const account=event.providerAccountId||activeAccountId,locator=JSON.stringify([account,event.calendarId,event.id,event.date]),canonical=event.canonicalId?JSON.stringify([event.canonicalId,event.date]):null;
  let row=canonical&&byCanonical.get(canonical)||byLocator.get(locator);
  if(!row){row={...event,providerAccountId:account,linkedProjectIds:[],original:false};result.push(row);}else if(original)Object.assign(row,event);
  row.original ||= original;row.linkedProjectIds=[...new Set([...row.linkedProjectIds,...((original&&membershipsVerified)?[]:event.linkedProjectIds||[])])];
  byLocator.set(locator,row);if(canonical)byCanonical.set(canonical,row);
 }
 return result.map(row=>{const googleId=googleSource(row.calendarId),fromGoogle=row.original&&(!activeAccountId||row.providerAccountId===activeAccountId)&&sourceVisible(googleId),project=row.linkedProjectIds.find(id=>sourceVisible('project:'+id));return {...row,sourceId:fromGoogle?googleId:project?'project:'+project:googleId,visible:!!fromGoogle||!!project};});
}

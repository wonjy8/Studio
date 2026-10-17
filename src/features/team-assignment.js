// Whole-membership PUTs are serialized per member. Intermediate selections coalesce
// while a request is in flight; a failed older request never rolls back newer intent.
export function createTeamAssignmentQueue({initial=new Map(),save,onState=()=>{}}){
 const members=new Map([...initial].map(([id,teamIds])=>[id,{confirmed:[...teamIds],desired:[...teamIds],version:0,running:false,promise:null}]));
 const emit=(memberId,state,pending,error=null)=>onState({memberId,teamIds:[...state.desired],confirmed:[...state.confirmed],pending,error});
 async function drain(memberId,state){
  for(;;){const version=state.version,teamIds=[...state.desired];let error=null;
   try{await save(memberId,teamIds);state.confirmed=teamIds;}catch(failure){error=failure;}
   if(version!==state.version){emit(memberId,state,true,error);continue;}
   if(error)state.desired=[...state.confirmed];
   state.running=false;emit(memberId,state,false,error);return;
  }
 }
 return {
  select(memberId,teamIds){let state=members.get(memberId);if(!state){state={confirmed:[],desired:[],version:0,running:false,promise:null};members.set(memberId,state);}state.desired=[...new Set(teamIds)];state.version++;emit(memberId,state,true);if(!state.running){state.running=true;state.promise=drain(memberId,state);}return state.promise;},
  async idle(){do{await Promise.all([...members.values()].map(state=>state.promise));}while([...members.values()].some(state=>state.running));}
 };
}

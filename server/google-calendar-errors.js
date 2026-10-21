// Never expose Google's raw message, request URL, project metadata or credentials.
const messages={
 API_DISABLED:'Studio가 사용하는 Google Cloud 프로젝트에서 Calendar API가 활성화되지 않았습니다. 해당 프로젝트의 Google Calendar API 활성화 상태를 관리자에게 확인하세요.',
 SCOPE_INSUFFICIENT:'이 Google 연결의 Calendar 조회 권한 범위가 부족합니다. 설정 → 연결에서 현재 허용된 Calendar 권한을 확인하세요.',
 TOKEN_REVOKED:'Google이 기존 연결의 토큰 갱신을 거절했습니다. 설정 → 연결에서 이 Google 연결을 다시 승인해야 합니다.',
 ACCESS_TOKEN_INVALID:'Google이 Calendar 접근 토큰을 거절했습니다. 자동 갱신 후에도 실패했습니다. 설정 → 연결에서 연결 상태를 확인하세요.',
 RATE_LIMITED:'Google Calendar 요청 한도를 초과했습니다. 잠시 후 일정 조회를 다시 시도하세요.',
 CALENDAR_FORBIDDEN:'이 캘린더의 일정 조회가 거절되었습니다. 다른 캘린더를 선택하거나 해당 캘린더의 공유·읽기 권한을 확인하세요.',
 CALENDAR_NOT_FOUND:'선택한 캘린더를 찾거나 읽을 수 없습니다. 다른 캘린더를 선택해 주세요.',
 POLICY_BLOCKED:'Google 조직 정책에서 Calendar 접근을 제한했습니다. Google Workspace 관리자에게 앱의 Calendar 접근 정책을 확인하세요.',
 PROVIDER_FORBIDDEN:'Google이 Calendar 요청을 거절했습니다. 원인이 구분되지 않은 403 응답입니다. 아래 진단 코드와 실패 단계를 확인하세요.',
 PROVIDER_UNAVAILABLE:'Google Calendar 응답이 일시적으로 실패했습니다. 잠시 후 일정 조회를 다시 시도하세요.',
 OAUTH_CLIENT_ERROR:'Google OAuth 클라이언트 확인에 실패했습니다. Studio 관리자가 기존 OAuth 클라이언트 설정을 확인해야 합니다.',
 PROVIDER_ERROR:'Google Calendar 요청에 실패했습니다. 진단 코드와 실패 단계를 확인하세요.'
};
const reasons=new Set(['accessNotConfigured','serviceDisabled','SERVICE_DISABLED','API_DISABLED','insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT','invalid_grant','authError','rateLimitExceeded','userRateLimitExceeded','quotaExceeded','dailyLimitExceeded','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED','forbidden','notFound','domainPolicy','ORG_RESTRICTION_VIOLATION','invalid_client','unauthorized_client']);
export function calendarOperation(url,method='GET'){
 const path=new URL(url).pathname;
 if(path==='/token')return 'token-refresh';if(path.endsWith('/calendarList'))return 'calendar-list';
 if(/\/calendars\/[^/]+\/events$/.test(path)&&method==='GET')return 'event-list';
 if(path.includes('/calendars/'))return 'project-publish';return 'oauth-profile';
}
export function googleCalendarError(httpStatus,data,operation){
 const raw=[data?.error,...(Array.isArray(data?.error?.errors)?data.error.errors:[]).map(item=>item?.reason),...(Array.isArray(data?.error?.details)?data.error.details:[]).filter(item=>item?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo').map(item=>item.reason)].filter(value=>typeof value==='string');
 const has=(...values)=>values.some(value=>raw.includes(value));let code;
 if(has('accessNotConfigured','serviceDisabled','SERVICE_DISABLED','API_DISABLED'))code='API_DISABLED';
 else if(has('insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'))code='SCOPE_INSUFFICIENT';
 else if(has('invalid_grant'))code='TOKEN_REVOKED';
 else if(has('invalid_client','unauthorized_client'))code='OAUTH_CLIENT_ERROR';
 else if(has('domainPolicy','ORG_RESTRICTION_VIOLATION'))code='POLICY_BLOCKED';
 else if(httpStatus===429||has('rateLimitExceeded','userRateLimitExceeded','quotaExceeded','dailyLimitExceeded','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED'))code='RATE_LIMITED';
 else if(httpStatus===401)code='ACCESS_TOKEN_INVALID';
 else if(operation==='event-list'&&httpStatus===404)code='CALENDAR_NOT_FOUND';
 else if(operation==='event-list'&&httpStatus===403&&has('forbidden'))code='CALENDAR_FORBIDDEN';
 else if(httpStatus===403)code='PROVIDER_FORBIDDEN';
 else if(httpStatus>=500)code='PROVIDER_UNAVAILABLE';else code='PROVIDER_ERROR';
 const providerReason=raw.find(value=>reasons.has(value))||'unclassified',status=code==='TOKEN_REVOKED'?401:httpStatus;
 return Object.assign(Error(messages[code]),{status,calendarDiagnostic:{code,operation,httpStatus,providerReason,retryable:['RATE_LIMITED','PROVIDER_UNAVAILABLE'].includes(code)}});
}
export function publicCalendarDiagnostic(error){
 const value=error?.calendarDiagnostic;if(!value||!Object.hasOwn(messages,value.code))return null;
 if(!['token-refresh','calendar-list','event-list','project-publish','oauth-profile'].includes(value.operation))return null;
 return {code:value.code,operation:value.operation,httpStatus:Number(value.httpStatus)||0,providerReason:reasons.has(value.providerReason)?value.providerReason:'unclassified',retryable:Boolean(value.retryable)};
}
export function calendarScopeInfo(scopes){
 if(!Array.isArray(scopes))return {known:false,eventRead:null,calendarList:null,eventWrite:null};
 const has=(...names)=>names.some(name=>scopes.includes('https://www.googleapis.com/auth/'+name));
 return {known:true,eventRead:has('calendar','calendar.readonly','calendar.events','calendar.events.readonly'),calendarList:has('calendar','calendar.readonly','calendar.calendarlist','calendar.calendarlist.readonly'),eventWrite:has('calendar','calendar.events')};
}

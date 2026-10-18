// Only classify transport/stage facts; never reveal whether an account exists.
export function loginFailureMessage(error,stage='login'){
 const status=error?.status;
 if(status===401&&stage==='session')return '로그인 후 접속 상태를 유지하지 못했습니다. 같은 주소에서 브라우저 쿠키가 허용되는지 확인해 주세요.';
 if(status===401)return '로그인 정보를 확인해 주세요. 사용자 이름은 가입한 대소문자대로 입력해 주세요.';
 if(status===403)return '현재 접속 주소에서는 로그인 요청이 허용되지 않습니다. 기본 서비스 주소로 접속해 주세요.';
 if(status===429)return '로그인 요청이 많아 잠시 제한됐습니다. 잠시 후 다시 시도해 주세요.';
 if(status>=500)return '로그인 서버가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.';
 if(status===400)return '사용자 이름과 비밀번호 입력을 확인해 주세요.';
 if(error?.code==='INVALID_RESPONSE')return '서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
 if(!status)return '로그인 서버에 연결하지 못했습니다. 네트워크와 접속 주소를 확인해 주세요.';
 return '로그인 요청을 처리하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
}

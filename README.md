# Studio

Studio is a production planning and shoot-day command center: Workspace → Project → Shoot.

The NAS-hosted app provides local-account login, private persistent project data, PDF script preview/download, and reference image storage. Provision the first account on the NAS. The administrator can then invite members through signup links with 12/24/48-hour expiry and a positive integer or unlimited capacity in Settings. Public signup and in-app API-key AI remain disabled. External ChatGPT access is available through account-authorized MCP/OAuth; see [connection and deployment instructions](docs/NAS_DEPLOYMENT.md#connecting-chatgpt-as-a-private-mcp-app). Each account has an isolated workspace with multiple projects and configurable project icons.

Read [NAS deployment](docs/NAS_DEPLOYMENT.md) for the exact DSM update, account setup, backup, and acceptance checks. Existing Cloudflare Tunnel routes to `http://studio:8080`; no router forwarding is needed. Runtime data lives in the private `studio-data` Docker volume and never in Git or the image.

## Development

Node 24 is the production runtime. No third-party runtime packages are required.

```sh
npm test
npm run check
APP_ORIGIN=http://localhost:8080 COOKIE_SECURE=false npm start
```

In another terminal, provision a fictional local account using `npm run account -- demo-user` and supply a password through stdin. Do not put real passwords in command arguments or shell history. HTTP/insecure-cookie mode is local development only.

GitHub Actions checks pull requests, builds the container, then publishes `ghcr.io/wonjy8/studio:latest` and an immutable commit tag on main. The NAS pulls the image and retains its volume. See [authentication architecture](docs/AUTH_AND_SERVER.md), [product rules](docs/PRODUCT.md), and [security policy](SECURITY.md).

### Google 계정 및 Google Sheets 연결

설정 → 외부 앱 연결 → Google에서 계정을 연결합니다. 장비 관리에서 **시트 만들기**는 실제 Google 스프레드시트를 생성하고 현재 선택한 개인/조직 장비 목록을 연결합니다. **구글 시트 연결**은 URL의 `gid`에 해당하는 탭(없으면 첫 탭)을 연결합니다. **파일로 등록**은 기존 CSV/TSV 일괄 등록입니다.

배포 관리자는 먼저 다음 설정이 필요합니다.

1. Google Cloud 프로젝트에서 **Google Sheets API**를 활성화합니다.
2. Google Auth Platform에서 동의 화면과 대상을 설정합니다. 테스트 모드에서는 사용할 Google 계정을 테스트 사용자로 추가합니다.
3. OAuth 클라이언트를 **웹 애플리케이션** 유형으로 생성합니다. 승인된 리디렉션 URI는 `APP_ORIGIN` 뒤에 `/oauth/google/callback`을 붙인 정확한 주소입니다. 현재 서비스는 `https://studio.wonjongyou.com/oauth/google/callback`입니다.
4. 배포 호스트의 비공개 `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 설정한 뒤 compose 컨테이너를 다시 생성합니다. 저장소나 채팅에 비밀 값을 기록하지 않습니다. 이 값은 앱 전체의 OAuth 설정이며, Google 계정 연결은 사용자별로 따로 저장됩니다.
5. Google 계정 연결을 완료합니다. Sheets 읽기/쓰기 권한을 허용해야 합니다. 외부 테스트 앱의 오프라인 토큰은 일반적으로 7일 후 만료되므로, 공개 운영 전 게시 상태와 Google의 권한 검토 요구 사항을 확인합니다.

연결할 탭은 장비 전용으로 사용하세요. 첫 행의 열 순서는 다음과 같습니다.

`장비 ID, 장비명, 분류, 관리번호, 시리얼 번호, 모델, 관리 방식, 수량, 보관 장소, 상태, 관리자`

새 장비의 **장비 ID는 비워 두면** 첫 동기화에서 앱이 채웁니다. 기존 ID를 바꾸거나 다른 목록의 ID를 붙여 넣지 않습니다. 분류는 카메라/렌즈/조명/삼각대/SD 카드/음향/기타 장비 또는 내부 코드(camera/lens/lighting/tripod/sd/audio/other), 관리 방식은 개별/수량 또는 individual/bulk입니다. 개별 장비는 수량 1, 수량 관리 장비는 0 이상의 정수를 사용합니다. 최대 2,000개의 장비를 연결하며 A:K의 2,002행까지는 앱이 관리하므로 다른 자료를 넣지 않습니다. 수식으로 실행되지 않도록 앱은 RAW 모드로 기록합니다.

서버는 1분 간격 및 장비 변경 후 양방향 동기화를 실행합니다. 장비 화면은 작성 중인 폼이 없을 때 변경된 동기화 상태를 확인해 갱신하며, **지금 동기화**로 즉시 확인할 수도 있습니다. 서로 다른 필드 변경은 병합하고, 같은 필드의 서로 다른 변경이나 삭제/수정 충돌은 중단하여 연결 영역에 표시합니다. 앱과 시트 값을 일치시킨 뒤 다시 동기화하세요. 저장 응답이 유실되면 보관한 작업 결과와 시트를 대조해 재시도하여 중복 장비 생성을 막습니다. 미확인 저장 중 시트가 다시 변경된 경우에는 내용을 확인한 뒤 연결 해제·재연결이 필요할 수 있습니다. Google Sheets에는 원자적 셀 비교·교환 기능이 없어, 저장 직전 확인과 실제 쓰기 사이의 아주 짧은 동시 편집은 완전히 차단할 수 없습니다.

행 삭제는 장비를 앱의 현재 목록에서 숨깁니다. 원본 장비 ID와 반출·반납 이력은 유지되고, 반출 중인 장비의 삭제나 보호된 장비 정보 변경은 거부합니다. 조직 장비는 관리 권한이 있는 사용자가 연결하며, 연결한 사용자의 조직 권한이 해제되면 자동 동기화도 중단됩니다. 시트 편집 권한을 가진 사람은 해당 장비 목록을 수정할 수 있으므로 공유 권한을 확인하세요. 앱의 연결 해제는 자료를 지우지 않고 동기화만 중지합니다.

OAuth 토큰은 AES-256-GCM으로 암호화해 데이터베이스에 저장합니다. 암호화 키는 데이터 볼륨의 `google-tokens.key`(권한 0600)에 생성됩니다. 복구 가능한 백업에는 이 파일과 `studio.sqlite`를 함께 보관하세요. 키가 유실되면 Google 계정을 다시 연결해야 합니다. 서버의 외부 HTTPS 접근에는 `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com`, `sheets.googleapis.com`이 필요합니다.

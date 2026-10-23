import {createHash} from 'node:crypto';
export const documentFileContext=session=>createHash('sha256').update(JSON.stringify(['document-image-v1',session.user_id,session.token])).digest('base64url');

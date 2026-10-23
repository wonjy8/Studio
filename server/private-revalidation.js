import {createHash} from 'node:crypto';

// A cached private response grants no access: call only AFTER current session
// and resource authorization. Cookies and session-bound tags isolate accounts.
export function privateNotModified(req,res,session,resource,version) {
 if(!res)return false; // Internal content adapters do not expose HTTP caching.
 const tag='"'+createHash('sha256').update(JSON.stringify([session.user_id,session.token,resource,version])).digest('base64url')+'"';
 res.setHeader('Cache-Control','private, no-cache, must-revalidate');
 res.setHeader('Vary','Cookie');
 res.setHeader('ETag',tag);
 const supplied=String(req.headers['if-none-match']||'').split(',').map(value=>value.trim().replace(/^W\//,''));
 if(!supplied.includes(tag))return false;
 res.statusCode=304;
 res.end();
 return true;
}

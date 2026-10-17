export function validPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 256 && /[A-Z]/.test(password) && /[^\p{L}\p{N}\s]/u.test(password);
}

export const MIN_PASSWORD_LENGTH = 4;

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

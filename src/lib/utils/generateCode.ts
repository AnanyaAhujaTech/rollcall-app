const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length);
    result += CODE_ALPHABET[randomIndex];
  }
  return result;
}

export function generateInviteCode(prefix: string = 'TCH'): string {
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length);
    randomPart += CODE_ALPHABET[randomIndex];
  }
  return `${prefix}-${randomPart}`;
}

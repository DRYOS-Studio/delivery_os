/** Validação de CPF/CNPJ brasileiro (checksum). Entrada: só dígitos. */

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function cpfCheckDigits(digits: string): boolean {
  if (digits.length !== 11 || allSameDigits(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === Number(digits[10]);
}

function cnpjCheckDigits(digits: string): boolean {
  if (digits.length !== 14 || allSameDigits(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * w1[i]!;
  }
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (d1 !== Number(digits[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits[i]) * w2[i]!;
  }
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return d2 === Number(digits[13]);
}

export function stripDocumentDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidCpf(raw: string): boolean {
  const digits = stripDocumentDigits(raw);
  return cpfCheckDigits(digits);
}

export function isValidCnpj(raw: string): boolean {
  const digits = stripDocumentDigits(raw);
  return cnpjCheckDigits(digits);
}

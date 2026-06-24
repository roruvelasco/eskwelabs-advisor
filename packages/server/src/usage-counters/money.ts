import { HttpException } from '../common/http/http-exception';

const USD_SCALE = 1_000_000n;

function invalidUsdAmount(): never {
  throw new HttpException(500, 'Invalid USD amount', 'invalid_usd_amount');
}

export function usdToMicros(value: number | string) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    invalidUsdAmount();
  }

  const raw = typeof value === 'number' ? value.toFixed(6) : value.trim();
  if (!raw) {
    invalidUsdAmount();
  }
  if (
    !/^[+-]?\d*(\.\d*)?$/.test(raw) ||
    raw === '.' ||
    raw === '+.' ||
    raw === '-.'
  ) {
    invalidUsdAmount();
  }

  const sign = raw.startsWith('-') ? -1n : 1n;
  const unsigned = raw.replace(/^[+-]/, '');
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const micros = `${fraction}000000`.slice(0, 6);

  return sign * (BigInt(whole || '0') * USD_SCALE + BigInt(micros || '0'));
}

export function usdAmount(value: number | string) {
  const micros = usdToMicros(value);
  const sign = micros < 0 ? '-' : '';
  const absolute = micros < 0 ? -micros : micros;
  const whole = absolute / USD_SCALE;
  const fraction = (absolute % USD_SCALE).toString().padStart(6, '0');

  return `${sign}${whole}.${fraction}`;
}

export function usdGreaterThan(
  left: number | string | bigint,
  right: number | string | bigint
) {
  const leftMicros = typeof left === 'bigint' ? left : usdToMicros(left);
  const rightMicros = typeof right === 'bigint' ? right : usdToMicros(right);

  return leftMicros > rightMicros;
}

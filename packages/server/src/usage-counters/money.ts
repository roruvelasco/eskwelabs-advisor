const USD_SCALE = 1_000_000n;

export function usdToMicros(value: number | string) {
  const raw = typeof value === 'number' ? value.toFixed(6) : value.trim();
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

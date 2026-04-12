/**
 * Halbooking sider har typisk `<meta charset="iso-8859-1">`.
 * `fetch().text()` antager UTF-8 og giver mojibake (fx i stedet for æ).
 */
import { Buffer } from 'node:buffer';

export async function readHalbookingHtml(res) {
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('latin1');
}

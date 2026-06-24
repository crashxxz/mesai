function onlyAscii(value: string, max: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function field(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function crc16(value: string) {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function createPixCopyPaste(input: { key: string; recipient: string; city: string; amount: number }) {
  const key = input.key.trim();
  if (!key) return "";
  const merchantAccount = field("00", "BR.GOV.BCB.PIX") + field("01", key);
  const amount = Math.max(0, input.amount).toFixed(2);
  const payload = [
    field("00", "01"),
    field("26", merchantAccount),
    field("52", "0000"),
    field("53", "986"),
    field("54", amount),
    field("58", "BR"),
    field("59", onlyAscii(input.recipient || "RECEBEDOR", 25)),
    field("60", onlyAscii(input.city || "SAO PAULO", 15)),
    field("62", field("05", "***"))
  ].join("");
  return `${payload}6304${crc16(`${payload}6304`)}`;
}

/** Matches BoningerWorks.Utilities.IdGenerator.NewIdTimestamp. */
export function newIdTimestamp(timestampMs = Date.now()): string {
  const dataId = new Uint8Array(16);
  crypto.getRandomValues(dataId);

  const dataTimestamp = new Uint8Array(8);
  new DataView(dataTimestamp.buffer).setBigInt64(0, BigInt(timestampMs), true);

  dataId[0] = dataTimestamp[4];
  dataId[1] = dataTimestamp[5];
  dataId[2] = dataTimestamp[6];
  dataId[3] = dataTimestamp[7];
  dataId[4] = dataTimestamp[2];
  dataId[5] = dataTimestamp[3];
  dataId[6] = dataTimestamp[0];
  dataId[7] = dataTimestamp[1];

  return formatDotNetGuid(dataId);
}

function formatDotNetGuid(bytes: Uint8Array): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const seg = (start: number, len: number) =>
    Array.from(bytes.slice(start, start + len))
      .map(hex)
      .join('');

  return `${seg(0, 4)}-${seg(4, 2)}-${seg(6, 2)}-${seg(8, 2)}-${seg(10, 6)}`;
}

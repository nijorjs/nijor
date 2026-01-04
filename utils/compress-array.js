// ['hello', 'hi', 'ok', 'hi', 'no'] -> [['hello',1], ['hi',2], ['ok',1], ['no',1]]
export function compressArray(arr) {
  if (arr.length === 0) return [];

  const result = [];
  let current = arr[0];
  let count = 1;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === current) {
      count++;
    } else {
      result.push([current, count]);
      current = arr[i];
      count = 1;
    }
  }

  result.push([current, count]);

  return result;
}
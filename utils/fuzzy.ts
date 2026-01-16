
/**
 * Calculates the Levenshtein distance between two strings.
 */
export const getLevenshteinDistance = (a: string, b: string): number => {
  const tmp = [];
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

/**
 * Calculates similarity between 0 and 1.
 */
export const getSimilarity = (a: string, b: string): number => {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  
  const distance = getLevenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
};

/**
 * Determines if two values match based on the specified logic.
 */
export const isMatch = (val1: any, val2: any, threshold: number): boolean => {
  const s1 = String(val1 ?? '').trim();
  const s2 = String(val2 ?? '').trim();

  // Si ambos están vacíos, NO los consideramos iguales para evitar colapsar filas sin ID
  if (!s1 && !s2) return false;
  if (s1 === s2) return true;

  // Exact match for numbers
  const n1 = Number(s1);
  const n2 = Number(s2);
  if (!isNaN(n1) && !isNaN(n2) && s1 !== '' && s2 !== '') {
    return n1 === n2;
  }
  
  // Exact match for very short codes (less than 5 chars)
  if (s1.length < 5 || s2.length < 5) {
    return s1.toLowerCase() === s2.toLowerCase();
  }

  // Fuzzy match for longer text
  return getSimilarity(s1, s2) >= threshold;
};

export const sanitizeFilename = (name: string) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .slice(0, 150);
};

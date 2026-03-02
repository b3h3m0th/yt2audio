import path from "path";

export const getBinaryPath = (binary: string) => {
  return path.join(process.cwd(), "src", "bin", binary);
};

export function isSafePackagePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes(":")) {
    return false;
  }
  if (value.startsWith("/")) return false;
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

export function portablePathKey(value) {
  return typeof value === "string" ? value.normalize("NFC").toLowerCase() : "";
}

export function pathsConflict(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

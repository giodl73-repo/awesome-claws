export function isSafePackagePath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    /[<>:"|?*\p{Cc}]/u.test(value)
  ) {
    return false;
  }
  if (value.startsWith("/")) return false;
  return value.split("/").every(
    (segment) =>
      segment &&
      segment !== "." &&
      segment !== ".." &&
      !/[. ]$/u.test(segment) &&
      !/^(?:con|prn|aux|nul|com(?:[1-9]|\u00b9|\u00b2|\u00b3)|lpt(?:[1-9]|\u00b9|\u00b2|\u00b3))(?:\..*)?$/iu.test(
        segment,
      ),
  );
}

export function portablePathKey(value) {
  return typeof value === "string" ? value.normalize("NFKC").toLocaleLowerCase("und") : "";
}

export function pathsConflict(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

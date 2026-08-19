export const maintenanceStatuses = ["active", "needs-help", "retiring"];

const githubHandlePattern = /^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

export function maintenanceErrors(maintenance, { today = currentUtcDate() } = {}) {
  const errors = [];
  if (!maintenance || typeof maintenance !== "object" || Array.isArray(maintenance)) {
    return ["maintenance must be an object"];
  }
  const allowedKeys = ["lastVerified", "maintainers", "status"];
  const unknownKeys = Object.keys(maintenance).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    errors.push(`maintenance contains unknown fields: ${unknownKeys.join(", ")}`);
  }
  if (!maintenanceStatuses.includes(maintenance.status)) {
    errors.push(`maintenance.status must be one of ${maintenanceStatuses.join(", ")}`);
  }
  if (
    !Array.isArray(maintenance.maintainers) ||
    maintenance.maintainers.length === 0 ||
    maintenance.maintainers.some(
      (handle) =>
        typeof handle !== "string" ||
        !githubHandlePattern.test(handle) ||
        /(?:replace|placeholder|todo)/iu.test(handle),
    )
  ) {
    errors.push("maintenance.maintainers must contain real GitHub handles such as @octocat");
  } else if (
    new Set(maintenance.maintainers.map((handle) => handle.toLowerCase())).size !==
    maintenance.maintainers.length
  ) {
    errors.push("maintenance.maintainers must be unique");
  }
  if (
    typeof maintenance.lastVerified !== "string" ||
    !isoDatePattern.test(maintenance.lastVerified) ||
    Number.isNaN(Date.parse(`${maintenance.lastVerified}T00:00:00Z`))
  ) {
    errors.push("maintenance.lastVerified must be an ISO calendar date");
  } else if (maintenance.lastVerified > today) {
    errors.push("maintenance.lastVerified must not be in the future");
  }
  return errors;
}

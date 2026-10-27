const safeStatusCode = value => {
    const status = Number(value);
    return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  };
const safeErrorCode = value =>
    typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : undefined;
const safeKind = value =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : undefined;
const getCommentPostFailureDetails = error => {
    const result = error && error.result !== undefined ? error.result : error;
    const details = {};
    const statusCode = safeStatusCode(result && (result.status !== undefined ? result.status : result.httpStatus));
    const errorCode = safeErrorCode(result && result.errorCode);
    const kind = safeKind((error && error.kind) || (result && result.kind));
    const errorName = safeKind(result && result.name);
    const retryAfterMs = Number(result && result.retryAfterMs);
    if (statusCode !== undefined) { details.statusCode = statusCode; }
    if (errorCode !== undefined) { details.errorCode = errorCode; }
    if (kind !== undefined) { details.kind = kind; }
    if (errorName !== undefined && errorName !== kind) { details.errorName = errorName; }
    if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) { details.retryAfterMs = retryAfterMs; }
    return details;
  };

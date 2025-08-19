export const WS_CLOSE_TEXT = {
  //RFC close codes
  1000: 'Normal Closure',
  1001: 'Going Away',
  1002: 'Protocol Error',
  1003: 'Unsupported Data',
  1005: 'No Status Received (reserved)',
  1006: 'Abnormal Closure (no close frame)',
  1007: 'Invalid Payload',
  1008: 'Policy Violation',
  1009: 'Message Too Big',
  1010: 'Mandatory Extension',
  1011: 'Internal Error',
  1012: 'Service Restart',
  1013: 'Try Again Later',
  1015: 'TLS Handshake Failure',

  //graphql-transport-ws "GraphQL-WS" codes
  4400: 'Bad Request',
  4401: 'Unauthorized',
  4403: 'Forbidden',
  4404: 'Subscription Not Found',
  4409: 'Subscriber ID Not Unique',
  4429: 'Too Many Requests',
};

export function describeCloseText(code) {
  return WS_CLOSE_TEXT[code] || 'Not in WS_CLOSE_TEXT list';
}

export function prettyClose(code, reason, hint) {
  const reasonString = Buffer.isBuffer(reason)
    ? reason.toString()
    : (reason || '').trim();

  // preference order: server reason, then our hint, then the code text
  const why = reasonString || hint || describeCloseText(code);
  return `${code} (${describeCloseText(code)}) - ${why}`;
}

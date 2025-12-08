const crypto = require('crypto');

const secret = 'ZGRhZGFkMjUtNTQ2Yy00YjViLTgxNmUtMzJmYzIwNWQ3Njc0NTdlZTg2MjEtYTg1Mi00ZDk5LWJlMDMtZGY1NTczZTA4NDA0';

function base64url(source) {
  let encodedSource = Buffer.from(source).toString('base64');
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

function createJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64');
  
  const encodedSignature = signature
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

const anonPayload = {
  role: 'anon',
  iss: 'supabase-demo',
  iat: 1641769200,
  exp: 1799535600
};

const servicePayload = {
  role: 'service_role',
  iss: 'supabase-demo',
  iat: 1641769200,
  exp: 1799535600
};

const anonToken = createJWT(anonPayload, secret);
const serviceToken = createJWT(servicePayload, secret);

console.log('\n=== NEW JWT TOKENS ===\n');
console.log('JWT_SECRET:', secret);
console.log('\nANON_KEY:', anonToken);
console.log('\nSERVICE_ROLE_KEY:', serviceToken);
console.log('\n');

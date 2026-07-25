import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const projectDir = path.resolve(frontendDir, '..');
const nginxPath = path.join(projectDir, 'docs', 'goldenstudioplus-nginx-phase11.conf');
const nginx = fs.readFileSync(nginxPath, 'utf8');
const distDir = path.join(frontendDir, 'dist');

test('Phase 11 Nginx trusts only its own client address and proxies only to loopback', () => {
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:4000\/api\/;/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(nginx, /\$proxy_add_x_forwarded_for/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$scheme;/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Host \$host;/);
  assert.match(nginx, /client_max_body_size 9M;/);
  assert.match(nginx, /server_tokens off;/);
});

test('Phase 11 Nginx emits one consistent hardened header set on all statuses', () => {
  for (const header of [
    'Content-Security-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'Origin-Agent-Cluster',
    'Permissions-Policy',
    'Referrer-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-DNS-Prefetch-Control',
    'X-Download-Options',
    'X-Frame-Options',
    'X-Permitted-Cross-Domain-Policies',
    'X-XSS-Protection',
  ]) {
    assert.match(nginx, new RegExp(`add_header ${header} .* always;`));
  }

  assert.match(nginx, /add_header X-Frame-Options "DENY" always;/);
  assert.match(nginx, /add_header X-Content-Type-Options "nosniff" always;/);
  assert.match(nginx, /add_header Referrer-Policy "strict-origin-when-cross-origin" always;/);
  assert.match(nginx, /frame-ancestors 'none'/);
  assert.match(nginx, /object-src 'none'/);
  assert.match(nginx, /Permissions-Policy "camera=\(\), geolocation=\(\), microphone=\(\), payment=\(\), usb=\(\)"/);

  for (const upstreamHeader of [
    'Content-Security-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'Origin-Agent-Cluster',
    'Referrer-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-DNS-Prefetch-Control',
    'X-Download-Options',
    'X-Frame-Options',
    'X-Permitted-Cross-Domain-Policies',
    'X-XSS-Protection',
  ]) {
    assert.match(nginx, new RegExp(`proxy_hide_header ${upstreamHeader};`));
  }
});

test('CSP permits every generated JSON-LD block by hash without allowing arbitrary inline scripts', () => {
  const policy = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1];
  assert.ok(policy);
  const scriptPolicy = policy.match(/script-src ([^;]+)/)?.[1];
  assert.ok(scriptPolicy);
  assert.doesNotMatch(scriptPolicy, /'unsafe-inline'/);
  assert.doesNotMatch(scriptPolicy, /'unsafe-eval'/);

  const htmlFiles = fs.readdirSync(distDir).filter((name) => name.endsWith('.html'));
  let inlineBlockCount = 0;
  for (const name of htmlFiles) {
    const html = fs.readFileSync(path.join(distDir, name), 'utf8');
    const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .filter(Boolean);
    for (const block of blocks) {
      inlineBlockCount += 1;
      const hash = `'sha256-${crypto.createHash('sha256').update(block).digest('base64')}'`;
      assert.match(scriptPolicy, new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} CSP hash`);
    }
  }
  assert.ok(inlineBlockCount > 0);
});

test('static and uploaded files are read-only through Nginx', () => {
  assert.equal((nginx.match(/limit_except GET HEAD/g) ?? []).length, 2);
  assert.match(nginx, /location \/uploads\/ \{[\s\S]*autoindex off;/);
  assert.match(nginx, /error_page 404 \/404\.html;/);
});

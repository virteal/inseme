#!/usr/bin/env node
/**
 * Live smoke for https://jhn.baronsmariani.org — strict TLS, cert, SPA shell, bundle markers.
 * No secrets. Exit 0 = pass.
 */
import https from "node:https";
import tls from "node:tls";
import { URL } from "node:url";

const HOST = process.env.JHN_HOST || "jhn.baronsmariani.org";

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https
      .get(
        url,
        {
          servername: u.hostname,
          rejectUnauthorized: true,
          timeout: 25000,
          headers: { "user-agent": "jhn-live-smoke/1.0" },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            })
          );
        }
      )
      .on("error", reject);
  });
}

function certInfo(host) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(
      443,
      host,
      { servername: host, rejectUnauthorized: true },
      () => {
        const c = sock.getPeerCertificate();
        resolve({
          authorized: sock.authorized,
          subject: c.subject,
          issuer: c.issuer,
          valid_to: c.valid_to,
          alt: c.subjectaltname,
        });
        sock.end();
      }
    );
    sock.on("error", reject);
  });
}

const report = { host: HOST, ok: false, checks: {}, errors: [] };

try {
  const cert = await certInfo(HOST);
  report.checks.cert = {
    authorized: cert.authorized,
    cn: cert.subject?.CN || null,
    issuer: cert.issuer?.O || cert.issuer?.CN || null,
    valid_to: cert.valid_to,
    alt: cert.alt || null,
  };

  const home = await get(`https://${HOST}/`);
  const john = await get(`https://${HOST}/john`);
  report.checks.home_status = home.status;
  report.checks.john_status = john.status;
  report.checks.home_has_root = home.body.includes('id="root"');
  report.checks.home_has_module = /type="module"/.test(home.body);

  const jsMatch = home.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!jsMatch) {
    report.errors.push("index_js_not_found_in_html");
  } else {
    const js = await get(`https://${HOST}${jsMatch[1]}`);
    report.checks.js_status = js.status;
    report.checks.js_bytes = js.body.length;
    report.checks.bundle = {
      John: js.body.includes("John"),
      TwinRoot: js.body.includes("TwinRoot"),
      Parler: js.body.includes("Parler"),
      personal_twin: js.body.includes("personal-twin"),
      jhn_baronsmariani: js.body.includes("jhn.baronsmariani"),
      deployment_kind: js.body.includes("deployment_kind"),
    };
  }

  const b = report.checks.bundle || {};
  report.ok =
    report.checks.cert?.authorized === true &&
    report.checks.cert?.cn === HOST &&
    report.checks.home_status === 200 &&
    report.checks.john_status === 200 &&
    report.checks.home_has_root === true &&
    report.checks.js_status === 200 &&
    b.John &&
    b.TwinRoot &&
    b.personal_twin;
} catch (err) {
  report.errors.push(String(err.message || err));
  report.ok = false;
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

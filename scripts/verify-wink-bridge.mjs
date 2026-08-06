#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";

const EXPECTED_BRIDGE_VERSION = "9.0.1";
const EXPECTED_PROTOCOL_VERSION = 1;
const EXPECTED_SHA256 =
  "2c116572babd9d850f19a91ff68669395eb3c8cd268c34f85be3d13d5625e29c";
const EXPECTED_PARENT = "https://winkgames.papastudio.net";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const [artifact, lockText, configText, indexHtml] = await Promise.all([
  fs.readFile("public/wink-bridge.js"),
  fs.readFile("public/wink-bridge.lock.json", "utf8"),
  fs.readFile("public/wink-runtime-config.json", "utf8"),
  fs.readFile("index.html", "utf8"),
]);

const lock = JSON.parse(lockText);
const config = JSON.parse(configText);
const sha256 = crypto.createHash("sha256").update(artifact).digest("hex");
const configKeys = Object.keys(config).sort().join(",");

if (
  configKeys !==
    "allowedParentOrigins,bridgeVersion,environment,gameId,protocolVersion" ||
  !UUID_PATTERN.test(config.gameId) ||
  config.environment !== "prod" ||
  config.protocolVersion !== EXPECTED_PROTOCOL_VERSION ||
  config.bridgeVersion !== EXPECTED_BRIDGE_VERSION ||
  JSON.stringify(config.allowedParentOrigins) !== JSON.stringify([EXPECTED_PARENT]) ||
  lock.bridgeVersion !== EXPECTED_BRIDGE_VERSION ||
  lock.protocolVersion !== EXPECTED_PROTOCOL_VERSION ||
  lock.sha256 !== EXPECTED_SHA256 ||
  lock.bytes !== artifact.byteLength ||
  sha256 !== EXPECTED_SHA256 ||
  indexHtml.indexOf('<script src="/wink-bridge.js"></script>') < 0
) {
  throw new Error("Wink production bridge contract is invalid");
}

console.log(
  `wink bridge verified version=${config.bridgeVersion} protocol=${config.protocolVersion} bytes=${artifact.byteLength} sha256=${sha256} environment=${config.environment} gameId=${config.gameId}`,
);

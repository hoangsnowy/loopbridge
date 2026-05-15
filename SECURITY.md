# Security Policy

## Reporting a vulnerability

Please do **not** open public issues for security reports. Email the maintainer with details and a proof-of-concept; expect acknowledgement within 3 business days.

## Supported versions

| Version | Supported |
| ------- | --------- |
| latest  | yes       |
| older   | no        |

## Security model

loopbridge is a single-user desktop migration tool. It:

- Reads pages from a Confluence instance using a credential the user supplies.
- Writes converted HTML to the system clipboard for manual paste into Microsoft Loop.
- Stores credentials in the OS credential manager (Windows Credential Manager via keytar). Never in plain JSON.
- Stores audit/progress in a local SQLite database under the user-data directory.
- Sends no telemetry by default. Optional opt-in error reporting strips message bodies.

The renderer process is sandboxed (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`). All privileged operations live in the main process; IPC bridges expose only typed methods through `contextBridge`.

## Build provenance

Release builds are produced by the GitHub Actions release workflow on a tagged commit. They include:

- SBOM (CycloneDX)
- SLSA build provenance (in-toto attestation)
- Cosign signature on installer + manifests

Verify provenance:

```bash
cosign verify-blob --certificate-identity-regexp 'github.com/.+/loopbridge' \
                   --certificate-oidc-issuer https://token.actions.githubusercontent.com \
                   --bundle loopbridge-x.y.z-setup.exe.sigstore \
                   loopbridge-x.y.z-setup.exe
```

## Update channel integrity

Updates are served via `electron-updater` against a configured `feedUrl`. Verify:

- The feed URL is HTTPS only.
- `latest.yml` is signed (out-of-band public-key verification — recommended additional layer).
- Installer is code-signed; SmartScreen validates publisher identity.

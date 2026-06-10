# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2026-06-10

### Fixed
- Keep cached HomeKit accessories when VeSync discovery temporarily returns no devices.
- Avoid removing cached accessories until they are missing from multiple consecutive discoveries.

## [1.2.2] - 2026-06-08

### Fixed
- Prefer the current VeSync device snapshot for purifier power, mode and fan speed state.
- Keep HomeKit state stable after user commands while delayed VeSync status updates settle.
- Map the lowest Auto fan level to the lowest HomeKit rotation speed.
- Treat VeSync off-state fan speed sentinels as `0%` in HomeKit.

## [1.2.1] - 2026-06-08

### Changed
- Cleaned public package metadata and repository maintenance files.

## [1.2.0] - 2026-06-08

### Fixed
- Keep HomeKit air purifier power, current state and rotation speed in sync immediately after power changes.
- Clear HomeKit rotation speed to `0%` immediately when the purifier is turned off.
- Avoid an unnecessary forced VeSync refresh before manual speed changes when the purifier is already on.
- Turn the purifier on when Auto or Manual mode is selected from HomeKit while the purifier is inactive.
- Push refreshed VeSync device state to HomeKit periodically using the configured status refresh interval.
- Keep recently requested HomeKit states from being overwritten by stale VeSync status responses for two minutes.

## [1.1.1] - 2026-06-08

### Fixed
- Switch purifiers to manual mode when a HomeKit fan speed is selected manually.
- Refresh purifier state before fan speed changes to avoid unnecessary power-on commands from stale cached state.

## [1.1.0] - 2026-06-08

### Changed
- Require Node.js 22 or newer.
- Replace legacy ESLint config with ESLint flat config and add a stricter typecheck gate.
- Use npm-only dependency management with deterministic package contents.
- Add configurable device status refresh, rediscovery and device filters.

### Fixed
- Correct the Homebridge plugin name used at runtime.
- Propagate failed VeSync device commands instead of silently updating HomeKit state.
- Normalize HomeKit rotation speed values to valid VeSync speed levels.
- Align humidifier target humidity limits with the VeSync command range.
- Remove the display accessory state update bug.
- Bind persisted VeSync sessions to the configured account and country.

### Security
- Update runtime dependencies and keep npm audit checks in CI and publish gates.
- Harden persisted VeSync sessions with validation, allowed API endpoints and file mode `0600`.
- Validate persisted VeSync app and terminal identifiers before reuse.
- Clear expired persisted tokens before a fresh login.
- Redact authentication fields from debug JSON logs.
- Use cryptographically strong random IDs for persisted VeSync device identifiers.

## [1.0.5] - 2024-12-19

### Fixed
- Changelog now visible in Homebridge UI update dialog (added changelog field to package.json)

## [1.0.4] - 2024-12-19

### Fixed
- **Prevent "new device" login emails**: Device IDs (terminalId, appId) are now persisted and reused across logins, so VeSync recognizes the plugin as the same device
- **Fix undefined characteristic values**: Use nullish coalescing (??) instead of logical OR (||) to prevent undefined values when device properties are false
- **Active characteristic**: Always returns 0 or 1, never undefined

## [1.0.3] - 2024-12-19

### Added
- CHANGELOG.md for tracking release notes in Homebridge UI

## [1.0.2] - 2024-12-19

### Added
- Child Bridge recommendation in README

### Changed
- Simplified supported devices table in README

## [1.0.1] - 2024-12-19

### Changed
- Updated README with clearer documentation

## [1.0.0] - 2024-12-19

### Added
- Initial release as `homebridge-levoit-air-purifier-eu`
- New 2-step authentication flow (compatible with current VeSync accounts)
- EU endpoint support (automatic based on country code)
- Token persistence (session saved between restarts)
- Country code selection in plugin configuration

### Supported Devices
- Core 600S
- Core 400S / 400S Pro
- Core 300S / 300S Pro
- Core 200S
- Vital 100S / 200S

### Credits
- Forked from [homebridge-levoit-air-purifier](https://github.com/RaresAil/homebridge-levoit-air-purifier) by RaresAil
- Auth flow inspired by [homebridge-tsvesync](https://github.com/mickgiles/homebridge-tsvesync)

# Homebridge Levoit Air Purifier EU

[![npm](https://img.shields.io/npm/v/homebridge-levoit-air-purifier-eu?cacheSeconds=3600)](https://www.npmjs.com/package/homebridge-levoit-air-purifier-eu)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A Homebridge plugin for controlling Levoit air purifiers through the VeSync platform, with EU and US endpoint support.

This project is a fork of [homebridge-levoit-air-purifier](https://github.com/RaresAil/homebridge-levoit-air-purifier) by RaresAil.

## Requirements

- Node.js 22 or newer
- Homebridge 1.3.5 or newer

## Supported Devices

| Model | Speed Levels |
|-------|--------------|
| Core 600S / 601S / 602S | Sleep, 1-4 |
| Core 400S / 400S Pro / 401S | Sleep, 1-4 |
| Core 300S / 300S Pro | Sleep, 1-3 |
| Core 200S | Sleep, 1-3 |
| Vital 100S / 200S | Sleep, 1-3 |

Devices below the 200 series, such as the 131S, are not supported because they require the older VeSync API v1.

## Features

- Air quality display with PM2.5 as a separate sensor
- Filter life level and filter change indicator
- Child lock
- Auto, Manual and Sleep modes
- Speed control
- EU and US endpoint support
- Session persistence
- Configurable status refresh interval
- Optional device rediscovery
- Device include and exclude filters

### Experimental Features

- `DeviceDisplay`: Display control as a HomeKit light
- `Humidifiers`: Support for Levoit humidifiers, including Dual 200S

## Installation

### Via Homebridge UI

Search for **"levoit air purifier eu"** in the Homebridge Plugin search.

### Via npm

```bash
npm install -g homebridge-levoit-air-purifier-eu
```

### On the Official Homebridge Image (Raspberry Pi)

Open the **Terminal** in the Homebridge UI and run:

```bash
npm --prefix /var/lib/homebridge install --save homebridge-levoit-air-purifier-eu
```

Then **restart Homebridge**.

### Install from GitHub

```bash
npm --prefix /var/lib/homebridge install --save git+https://github.com/Karrypto/homebridge-levoit-air-purifier-eu.git#master
```

## Configuration

### Child Bridge

Running the plugin as a child bridge keeps it isolated from other Homebridge plugins.

1. Go to **Plugins** -> **Levoit Air Purifier EU**
2. Open **Bridge Settings**
3. Enable **Run as a separate child bridge**
4. Save and restart Homebridge

### Via Homebridge UI

1. Go to **Plugins** -> **Levoit Air Purifier EU** -> **Settings**
2. Enter your VeSync credentials
3. Select your **Country Code**, for example `DE` for Germany or `US` for the United States
4. Save and restart Homebridge

### Manual Configuration (config.json)

```json
{
  "platforms": [
    {
      "platform": "LevoitAirPurifiers",
      "name": "Levoit Air Purifiers",
      "email": "your@email.com",
      "password": "your-password",
      "countryCode": "DE"
    }
  ]
}
```

### Optional Settings

```json
{
  "platform": "LevoitAirPurifiers",
  "name": "Levoit Air Purifiers",
  "email": "your@email.com",
  "password": "your-password",
  "countryCode": "DE",
  "enableDebugMode": false,
  "refreshInterval": 5,
  "rediscoveryInterval": 0,
  "includeDevices": [],
  "excludeDevices": [],
  "experimentalFeatures": ["DeviceDisplay", "Humidifiers"]
}
```

- `refreshInterval`: Seconds between VeSync status refreshes per device. Minimum: `5`.
- `rediscoveryInterval`: Minutes between device rediscovery runs. Use `0` to disable. Minimum when enabled: `5`.
- `includeDevices`: Optional list of exact device names or UUIDs to expose.
- `excludeDevices`: Optional list of exact device names or UUIDs to hide. Exclusions take priority.

## Country Codes

| Country | Code | Endpoint |
|---------|------|----------|
| Germany | `DE` | EU |
| Austria | `AT` | EU |
| Switzerland | `CH` | EU |
| United Kingdom | `GB` | EU |
| France | `FR` | EU |
| Netherlands | `NL` | EU |
| United States | `US` | US |
| Canada | `CA` | US |
| Australia | `AU` | US |

EU accounts are automatically routed via `smartapi.vesync.eu`.

## HomeKit Control

### Speed (Rotation Speed)

HomeKit rotation speed values are normalized to the nearest supported device level. `0%` turns the device off. Values above `0%` turn the device on if needed.

**Core 200S / 300S / 300S Pro:**

| HomeKit | Mode |
|---------|------|
| 0% | Off |
| 25% | Sleep Mode |
| 50% | Level 1 |
| 75% | Level 2 |
| 100% | Level 3 |

**Core 400S / 400S Pro / 600S:**

| HomeKit | Mode |
|---------|------|
| 0% | Off |
| 20% | Sleep Mode |
| 40% | Level 1 |
| 60% | Level 2 |
| 80% | Level 3 |
| 100% | Level 4 |

### Target State

| HomeKit | Levoit Mode |
|---------|-------------|
| Auto | Automatic mode |
| Manual | Manual mode |

## Troubleshooting

### "Login failed: Invalid email or password"
- Verify your VeSync credentials in the VeSync app

### "Cross-region error"
- Select the correct **Country Code** for your region

### Device not appearing in HomeKit
- Enable **Debug Mode** in plugin settings
- Check if the device is online in the VeSync app
- Check `includeDevices` and `excludeDevices` if device filters are configured

### Session persistence

The plugin saves your VeSync session. After a restart you'll see:

```
Reusing persisted VeSync session
```

## Uninstall

```bash
npm --prefix /var/lib/homebridge uninstall homebridge-levoit-air-purifier-eu
```

## Fork Notes

This fork adds:

- Current VeSync two-step authentication
- EU endpoint routing based on country code
- Persisted VeSync sessions
- Command failure handling
- Configurable refresh and rediscovery intervals
- Device include and exclude filters

## Credits & License

**Original Plugin:** [homebridge-levoit-air-purifier](https://github.com/RaresAil/homebridge-levoit-air-purifier) by [RaresAil](https://github.com/RaresAil)

**Auth flow inspired by:** [homebridge-tsvesync](https://github.com/mickgiles/homebridge-tsvesync)

**License:** [Apache-2.0](LICENSE)

This project is a fork and is released under the same license as the original.

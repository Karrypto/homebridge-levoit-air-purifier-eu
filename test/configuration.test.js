const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createSessionOwnerHash,
  isValidSessionAppId,
  isValidSessionTerminalId,
  normalizeRefreshIntervalMs,
  resolveBaseURLForCountry
} = require('../dist/api/VeSync');
const { clamp } = require('../dist/util');
const { normalizeSteppedPercentage } = require('../dist/util');
const deviceTypes = require('../dist/api/deviceTypes').default;
const { humidifierDeviceTypes } = require('../dist/api/deviceTypes');
const VeSyncFan = require('../dist/api/VeSyncFan').default;
const { Mode } = require('../dist/api/VeSyncFan');
const Active = require('../dist/characteristics/Active').default;
const RotationSpeed = require('../dist/characteristics/RotationSpeed').default;
const TargetState = require('../dist/characteristics/TargetState').default;
const { getPurifierRotationSpeed } = require('../dist/characteristics/airPurifierState');

const purifierContext = (
  device,
  targetUpdates = [],
  stateUpdates = { active: [], current: [], speed: [] }
) => ({
  device,
  platform: {
    Characteristic: {
      Active: { ACTIVE: 1, INACTIVE: 0 },
      CurrentAirPurifierState: { INACTIVE: 0, PURIFYING_AIR: 2 },
      TargetAirPurifierState: { MANUAL: 1 }
    }
  },
  airPurifierActiveCharacteristic: {
    updateValue: (value) => stateUpdates.active.push(value)
  },
  airPurifierCurrentCharacteristic: {
    updateValue: (value) => stateUpdates.current.push(value)
  },
  airPurifierRotationSpeedCharacteristic: {
    updateValue: (value) => stateUpdates.speed.push(value)
  },
  airPurifierTargetCharacteristic: { updateValue: (value) => targetUpdates.push(value) }
});

const targetStateContext = (device, updates = { active: [], current: [], speed: [] }) => ({
  device,
  platform: {
    Characteristic: {
      Active: { ACTIVE: 1, INACTIVE: 0 },
      CurrentAirPurifierState: { INACTIVE: 0, PURIFYING_AIR: 2 },
      TargetAirPurifierState: { AUTO: 0, MANUAL: 1 }
    }
  },
  airPurifierActiveCharacteristic: {
    updateValue: (value) => updates.active.push(value)
  },
  airPurifierCurrentCharacteristic: {
    updateValue: (value) => updates.current.push(value)
  },
  airPurifierRotationSpeedCharacteristic: {
    updateValue: (value) => updates.speed.push(value)
  }
});

test('routes EU countries to the EU VeSync endpoint', () => {
  assert.equal(resolveBaseURLForCountry('DE'), 'https://smartapi.vesync.eu');
  assert.equal(resolveBaseURLForCountry('gb'), 'https://smartapi.vesync.eu');
});

test('routes non-EU countries to the default VeSync endpoint', () => {
  assert.equal(resolveBaseURLForCountry('US'), 'https://smartapi.vesync.com');
  assert.equal(resolveBaseURLForCountry('CA'), 'https://smartapi.vesync.com');
  assert.equal(resolveBaseURLForCountry(undefined), 'https://smartapi.vesync.com');
});

test('normalizes refresh intervals to the supported range', () => {
  assert.equal(normalizeRefreshIntervalMs(undefined), 5000);
  assert.equal(normalizeRefreshIntervalMs(1), 5000);
  assert.equal(normalizeRefreshIntervalMs(30), 30000);
  assert.equal(normalizeRefreshIntervalMs(1000), 300000);
});

test('binds session ownership to email and country', () => {
  const owner = createSessionOwnerHash('User@example.com ', 'de');

  assert.equal(owner, createSessionOwnerHash('user@example.com', 'DE'));
  assert.notEqual(owner, createSessionOwnerHash('other@example.com', 'DE'));
  assert.notEqual(owner, createSessionOwnerHash('user@example.com', 'US'));
});

test('validates persisted session device identifiers', () => {
  assert.equal(isValidSessionAppId('AbCd1234'), true);
  assert.equal(isValidSessionAppId('AbCd12345'), false);
  assert.equal(isValidSessionAppId('AbCd-234'), false);

  assert.equal(isValidSessionTerminalId('abcdef0123456789'), true);
  assert.equal(isValidSessionTerminalId('ABCDEF0123456789'), false);
  assert.equal(isValidSessionTerminalId('abcdef01234567890'), false);
});

test('clamps values to an inclusive range', () => {
  assert.equal(clamp(10, 30, 80), 30);
  assert.equal(clamp(50, 30, 80), 50);
  assert.equal(clamp(90, 30, 80), 80);
});

test('normalizes HomeKit percentages to valid VeSync speed levels', () => {
  assert.equal(normalizeSteppedPercentage(0, 25), 0);
  assert.equal(normalizeSteppedPercentage(12, 25), 1);
  assert.equal(normalizeSteppedPercentage(38, 25), 2);
  assert.equal(normalizeSteppedPercentage(88, 25), 4);
  assert.equal(normalizeSteppedPercentage(1000, 25), 4);
  assert.equal(normalizeSteppedPercentage('bad', 25), 0);
  assert.equal(normalizeSteppedPercentage(74, 50), 1);
  assert.equal(normalizeSteppedPercentage(75, 50), 2);
});

test('maps auto fan level one to the lowest HomeKit speed', () => {
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: true,
    mode: Mode.Auto,
    speed: 1
  };

  assert.equal(getPurifierRotationSpeed(device), 25);
});

test('keeps manual fan level one above sleep speed', () => {
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: true,
    mode: Mode.Manual,
    speed: 1
  };

  assert.equal(getPurifierRotationSpeed(device), 50);
});

test('recognizes supported purifier and humidifier model strings', () => {
  assert.equal(deviceTypes.some(({ isValid }) => isValid('Core 300S Pro')), true);
  assert.equal(deviceTypes.some(({ isValid }) => isValid('LAP-C601S-WEU')), true);
  assert.equal(humidifierDeviceTypes.some(({ isValid }) => isValid('Dual200S')), true);
});

test('manual HomeKit speed selection switches an auto purifier to manual state', async () => {
  const updates = [];
  const calls = [];
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: true,
    mode: Mode.Auto,
    speed: 2,
    updateInfo: async (force) => calls.push(['updateInfo', force]),
    setPower: async (power) => {
      calls.push(['setPower', power]);
      return true;
    },
    changeSpeed: async (level) => {
      calls.push(['changeSpeed', level]);
      device.mode = Mode.Manual;
      device.speed = level;
      return true;
    },
    changeMode: async (mode) => {
      calls.push(['changeMode', mode]);
      device.mode = mode;
      return true;
    }
  };

  await RotationSpeed.set.call(purifierContext(device, updates), 75);

  assert.deepEqual(calls, [
    ['changeSpeed', 2]
  ]);
  assert.deepEqual(updates, [1]);
});

test('speed selection refreshes purifier state before deciding to power on', async () => {
  const calls = [];
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: false,
    mode: Mode.Manual,
    speed: 1,
    updateInfo: async (force) => {
      calls.push(['updateInfo', force]);
      device.isOn = true;
    },
    setPower: async (power) => {
      calls.push(['setPower', power]);
      return true;
    },
    changeSpeed: async (level) => {
      calls.push(['changeSpeed', level]);
      device.speed = level;
      return true;
    }
  };

  await RotationSpeed.set.call(purifierContext(device), 75);

  assert.deepEqual(calls, [
    ['updateInfo', true],
    ['changeSpeed', 2]
  ]);
});

test('speed selection does not refresh state when purifier is already on', async () => {
  const calls = [];
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: true,
    mode: Mode.Manual,
    speed: 1,
    updateInfo: async (force) => calls.push(['updateInfo', force]),
    setPower: async (power) => {
      calls.push(['setPower', power]);
      return true;
    },
    changeSpeed: async (level) => {
      calls.push(['changeSpeed', level]);
      device.speed = level;
      return true;
    }
  };

  await RotationSpeed.set.call(purifierContext(device), 75);

  assert.deepEqual(calls, [
    ['changeSpeed', 2]
  ]);
});

test('zero speed turns purifier off and clears HomeKit state immediately', async () => {
  const calls = [];
  const updates = { active: [], current: [], speed: [] };
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: true,
    mode: Mode.Auto,
    speed: 2,
    setPower: async (power) => {
      calls.push(['setPower', power]);
      device.isOn = power;
      return true;
    }
  };

  await RotationSpeed.set.call(purifierContext(device, [], updates), 0);

  assert.deepEqual(calls, [
    ['setPower', false]
  ]);
  assert.deepEqual(updates, {
    active: [0],
    current: [0],
    speed: [0]
  });
});

test('active off clears purifier speed state immediately', async () => {
  const calls = [];
  const updates = { active: [], current: [], speed: [] };
  const device = {
    isOn: true,
    updateInfo: async () => undefined,
    setPower: async (power) => {
      calls.push(['setPower', power]);
      device.isOn = power;
      return true;
    }
  };

  await Active.set.call(purifierContext(device, [], updates), 0);

  assert.deepEqual(calls, [
    ['setPower', false]
  ]);
  assert.deepEqual(updates, {
    active: [0],
    current: [0],
    speed: [0]
  });
});

test('active on pushes purifier speed state immediately', async () => {
  const calls = [];
  const updates = { active: [], current: [], speed: [] };
  const device = {
    deviceType: { speedMinStep: 25 },
    isOn: false,
    mode: Mode.Manual,
    speed: 2,
    updateInfo: async () => undefined,
    setPower: async (power) => {
      calls.push(['setPower', power]);
      device.isOn = power;
      return true;
    }
  };

  await Active.set.call(purifierContext(device, [], updates), 1);

  assert.deepEqual(calls, [
    ['setPower', true]
  ]);
  assert.deepEqual(updates, {
    active: [1],
    current: [2],
    speed: [75]
  });
});

test('auto target state powers on an inactive purifier and updates HomeKit state', async () => {
  const calls = [];
  const updates = { active: [], current: [], speed: [] };
  const device = {
    deviceType: { hasAutoMode: true, speedMinStep: 25 },
    isOn: false,
    mode: Mode.Manual,
    speed: 2,
    setPower: async (power) => {
      calls.push(['setPower', power]);
      device.isOn = power;
      return true;
    },
    changeMode: async (mode) => {
      calls.push(['changeMode', mode]);
      device.mode = mode;
      return true;
    }
  };

  await TargetState.set.call(targetStateContext(device, updates), 0);

  assert.deepEqual(calls, [
    ['setPower', true],
    ['changeMode', Mode.Auto]
  ]);
  assert.deepEqual(updates, {
    active: [1],
    current: [2],
    speed: [75]
  });
});

test('target state changes mode without power command when purifier is already on', async () => {
  const calls = [];
  const updates = { active: [], current: [], speed: [] };
  const device = {
    deviceType: { hasAutoMode: true },
    isOn: true,
    mode: Mode.Manual,
    setPower: async (power) => {
      calls.push(['setPower', power]);
      return true;
    },
    changeMode: async (mode) => {
      calls.push(['changeMode', mode]);
      device.mode = mode;
      return true;
    }
  };

  await TargetState.set.call(targetStateContext(device, updates), 0);

  assert.deepEqual(calls, [
    ['changeMode', Mode.Auto]
  ]);
  assert.deepEqual(updates, {
    active: [],
    current: [],
    speed: []
  });
});

test('VeSync speed changes enter manual mode before setting fan level', async () => {
  const calls = [];
  const client = {
    sendCommand: async (_device, method, data) => {
      calls.push([method, data]);
      return true;
    }
  };
  const fan = new VeSyncFan(
    client,
    'Purifier',
    Mode.Auto,
    1,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  assert.equal(await fan.changeSpeed(2), true);
  assert.deepEqual(calls, [
    ['setPurifierMode', { mode: 'manual' }],
    ['setLevel', { level: 2, type: 'wind', id: 0 }]
  ]);
});

test('partial VeSync status responses do not overwrite known purifier state', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      getDeviceInfo: async () => ({
        result: {
          result: {
            filter_life: 90
          }
        }
      }),
      getDeviceSnapshot: async () => null,
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Auto,
    2,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  await fan.updateInfo(true);

  assert.equal(fan.isOn, true);
  assert.equal(fan.mode, Mode.Auto);
  assert.equal(fan.speed, 2);
});

test('VeSync status parser accepts string power and speed values', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      getDeviceInfo: async () => ({
        result: {
          result: {
            enabled: 'off',
            level: '3',
            mode: 'sleep'
          }
        }
      }),
      getDeviceSnapshot: async () => null,
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Auto,
    1,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  await fan.updateInfo(true);

  assert.equal(fan.isOn, false);
  assert.equal(fan.mode, Mode.Sleep);
  assert.equal(fan.speed, 3);
});

test('recent purifier commands are not overwritten by stale VeSync status', async () => {
  let status = {
    enabled: false,
    level: 1,
    mode: Mode.Manual
  };
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      sendCommand: async () => true,
      getDeviceInfo: async () => ({
        result: {
          result: status
        }
      }),
      getDeviceSnapshot: async () => null,
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Manual,
    1,
    'uuid',
    false,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  assert.equal(await fan.setPower(true), true);
  assert.equal(await fan.changeMode(Mode.Auto), true);
  assert.equal(await fan.changeSpeed(2), true);

  await fan.updateInfo(true);

  assert.equal(fan.isOn, true);
  assert.equal(fan.mode, Mode.Manual);
  assert.equal(fan.speed, 2);

  status = {
    enabled: true,
    level: 2,
    mode: Mode.Manual
  };

  await fan.updateInfo(true);

  assert.equal(fan.isOn, true);
  assert.equal(fan.mode, Mode.Manual);
  assert.equal(fan.speed, 2);
});

test('fresh VeSync device snapshot wins over stale purifier status', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      getDeviceInfo: async () => ({
        result: {
          result: {
            enabled: true,
            level: 1,
            mode: Mode.Auto
          }
        }
      }),
      getDeviceSnapshot: async () => ({
        deviceStatus: 'on',
        extension: {
          fanSpeedLevel: '2',
          mode: Mode.Manual
        }
      }),
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Auto,
    1,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  await fan.updateInfo(true);

  assert.equal(fan.isOn, true);
  assert.equal(fan.mode, Mode.Manual);
  assert.equal(fan.speed, 2);
});

test('off device snapshot suppresses stale purifier status power and sentinel speed', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      getDeviceInfo: async () => ({
        result: {
          result: {
            enabled: true,
            level: 2,
            mode: Mode.Manual
          }
        }
      }),
      getDeviceSnapshot: async () => ({
        deviceStatus: 'off',
        extension: {
          fanSpeedLevel: '255',
          mode: Mode.Manual
        }
      }),
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Manual,
    2,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  await fan.updateInfo(true);

  assert.equal(fan.isOn, false);
  assert.equal(fan.mode, Mode.Manual);
  assert.equal(fan.speed, 2);
});

test('recent display command is not overwritten by stale VeSync status', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      sendCommand: async () => true,
      getDeviceSnapshot: async () => null,
      getDeviceInfo: async () => ({
        result: {
          result: {
            display: false
          }
        }
      }),
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Manual,
    2,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  assert.equal(await fan.setDisplay(true), true);
  await fan.updateInfo(true);

  assert.equal(fan.screenVisible, true);
});

test('recent child lock command is not overwritten by stale VeSync status', async () => {
  const fan = new VeSyncFan(
    {
      deviceUpdateIntervalMs: 0,
      sendCommand: async () => true,
      getDeviceSnapshot: async () => null,
      getDeviceInfo: async () => ({
        result: {
          result: {
            child_lock: false
          }
        }
      }),
      log: { error: () => undefined },
      debugMode: { debug: () => undefined }
    },
    'Purifier',
    Mode.Manual,
    2,
    'uuid',
    true,
    1,
    'config',
    'cid',
    'eu',
    'Core 300S',
    'mac'
  );

  assert.equal(await fan.setChildLock(true), true);
  await fan.updateInfo(true);

  assert.equal(fan.childLock, true);
});

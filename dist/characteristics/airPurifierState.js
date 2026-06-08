"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePurifierPowerState = exports.getPurifierRotationSpeed = void 0;
const VeSyncFan_1 = require("../api/VeSyncFan");
const getPurifierRotationSpeed = (device) => {
    let speed = (device.speed + 1) * device.deviceType.speedMinStep;
    if (device.mode === VeSyncFan_1.Mode.Sleep) {
        speed = device.deviceType.speedMinStep;
    }
    else if (device.mode === VeSyncFan_1.Mode.Auto && device.speed <= 1) {
        speed = device.deviceType.speedMinStep;
    }
    return device.isOn ? speed : 0;
};
exports.getPurifierRotationSpeed = getPurifierRotationSpeed;
const updatePurifierPowerState = (context, isOn, rotationSpeed) => {
    var _a, _b, _c;
    (_a = context.airPurifierActiveCharacteristic) === null || _a === void 0 ? void 0 : _a.updateValue(isOn
        ? context.platform.Characteristic.Active.ACTIVE
        : context.platform.Characteristic.Active.INACTIVE);
    (_b = context.airPurifierCurrentCharacteristic) === null || _b === void 0 ? void 0 : _b.updateValue(isOn
        ? context.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
        : context.platform.Characteristic.CurrentAirPurifierState.INACTIVE);
    if (!isOn || rotationSpeed !== undefined) {
        (_c = context.airPurifierRotationSpeedCharacteristic) === null || _c === void 0 ? void 0 : _c.updateValue(isOn ? (rotationSpeed !== null && rotationSpeed !== void 0 ? rotationSpeed : 0) : 0);
    }
};
exports.updatePurifierPowerState = updatePurifierPowerState;
//# sourceMappingURL=airPurifierState.js.map
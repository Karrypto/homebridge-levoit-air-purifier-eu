"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAccessoryInformation = exports.requireService = exports.normalizeSteppedPercentage = exports.clamp = exports.assertCommandSuccess = exports.delay = void 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.delay = delay;
const assertCommandSuccess = (success, action) => {
    if (!success) {
        throw new Error(`${action} failed`);
    }
};
exports.assertCommandSuccess = assertCommandSuccess;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
exports.clamp = clamp;
const normalizeSteppedPercentage = (value, minStep, maxValue = 100) => {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }
    const safeStep = Math.max(1, Math.round(minStep));
    const maxStep = Math.max(1, Math.floor(maxValue / safeStep));
    const clampedValue = (0, exports.clamp)(numericValue, 0, maxValue);
    if (clampedValue === 0) {
        return 0;
    }
    return (0, exports.clamp)(Math.round(clampedValue / safeStep), 1, maxStep);
};
exports.normalizeSteppedPercentage = normalizeSteppedPercentage;
const requireService = (service, name) => {
    if (!service) {
        throw new Error(`${name} service is unavailable`);
    }
    return service;
};
exports.requireService = requireService;
const setAccessoryInformation = (service, characteristic, { manufacturer, model, serialNumber, firmwareRevision }) => {
    const accessoryInformation = service
        .setCharacteristic(characteristic.Manufacturer, manufacturer)
        .setCharacteristic(characteristic.Model, model)
        .setCharacteristic(characteristic.SerialNumber, serialNumber);
    if (firmwareRevision) {
        accessoryInformation.setCharacteristic(characteristic.FirmwareRevision, firmwareRevision);
    }
};
exports.setAccessoryInformation = setAccessoryInformation;
//# sourceMappingURL=util.js.map
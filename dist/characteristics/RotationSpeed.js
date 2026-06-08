"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VeSyncFan_1 = require("../api/VeSyncFan");
const util_1 = require("../util");
const airPurifierState_1 = require("./airPurifierState");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return (0, airPurifierState_1.getPurifierRotationSpeed)(this.device);
    },
    set: async function (value) {
        var _a, _b, _c, _d;
        const targetLevel = (0, util_1.normalizeSteppedPercentage)(value, this.device.deviceType.speedMinStep);
        if (targetLevel === 0) {
            if (this.device.isOn) {
                const success = await this.device.setPower(false);
                (0, util_1.assertCommandSuccess)(success, 'Set purifier power');
            }
            (0, airPurifierState_1.updatePurifierPowerState)(this, false);
            return;
        }
        if (!this.device.isOn) {
            await this.device.updateInfo(true);
        }
        const currentLevel = Math.round((0, airPurifierState_1.getPurifierRotationSpeed)(this.device) / this.device.deviceType.speedMinStep);
        if (!this.device.isOn) {
            const success = await this.device.setPower(true);
            (0, util_1.assertCommandSuccess)(success, 'Set purifier power');
            (0, airPurifierState_1.updatePurifierPowerState)(this, true, targetLevel * this.device.deviceType.speedMinStep);
        }
        if (targetLevel === currentLevel && this.device.mode === VeSyncFan_1.Mode.Manual) {
            return;
        }
        if (targetLevel === 1) {
            const success = await this.device.changeMode(VeSyncFan_1.Mode.Sleep);
            (0, util_1.assertCommandSuccess)(success, 'Set purifier sleep mode');
            (_a = this.airPurifierTargetCharacteristic) === null || _a === void 0 ? void 0 : _a.updateValue(this.platform.Characteristic.TargetAirPurifierState.MANUAL);
            (_b = this.airPurifierRotationSpeedCharacteristic) === null || _b === void 0 ? void 0 : _b.updateValue(this.device.deviceType.speedMinStep);
        }
        else {
            const success = await this.device.changeSpeed(targetLevel - 1);
            (0, util_1.assertCommandSuccess)(success, 'Set purifier speed');
            (_c = this.airPurifierTargetCharacteristic) === null || _c === void 0 ? void 0 : _c.updateValue(this.platform.Characteristic.TargetAirPurifierState.MANUAL);
            (_d = this.airPurifierRotationSpeedCharacteristic) === null || _d === void 0 ? void 0 : _d.updateValue(targetLevel * this.device.deviceType.speedMinStep);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RotationSpeed.js.map
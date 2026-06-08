"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const calculateSpeed = (device) => {
    const speed = (device.speed) * device.deviceType.speedMinStep;
    return device.isOn ? speed : 0;
};
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return calculateSpeed(this.device);
    },
    set: async function (value) {
        var _a, _b;
        const targetLevel = (0, util_1.normalizeSteppedPercentage)(value, this.device.deviceType.speedMinStep);
        if (targetLevel === 0) {
            if (this.device.isOn) {
                const success = await this.device.setPower(false);
                (0, util_1.assertCommandSuccess)(success, 'Set humidifier power');
            }
            (_a = this.currentStateChar) === null || _a === void 0 ? void 0 : _a.updateValue(this.device.currentState);
            return;
        }
        if (!this.device.isOn) {
            const success = await this.device.setPower(true);
            (0, util_1.assertCommandSuccess)(success, 'Set humidifier power');
            (_b = this.currentStateChar) === null || _b === void 0 ? void 0 : _b.updateValue(this.device.currentState);
        }
        if (targetLevel === this.device.speed) {
            return;
        }
        const success = await this.device.setSpeed(targetLevel);
        (0, util_1.assertCommandSuccess)(success, 'Set humidifier speed');
        if (success && this.modeChar) {
            await (0, util_1.delay)(10);
            this.modeChar.updateValue(0);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RotationSpeed.js.map
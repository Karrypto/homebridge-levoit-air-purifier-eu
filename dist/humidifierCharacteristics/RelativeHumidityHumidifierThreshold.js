"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.targetHumidity;
    },
    set: async function (value) {
        const newTarget = (0, util_1.clamp)(value, 30, 80);
        if (newTarget !== this.device.targetHumidity) {
            const success = await this.device.setTarget(newTarget);
            (0, util_1.assertCommandSuccess)(success, 'Set target humidity');
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RelativeHumidityHumidifierThreshold.js.map
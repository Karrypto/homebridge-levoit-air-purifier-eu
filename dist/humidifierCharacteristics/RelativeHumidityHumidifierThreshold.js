"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.targetHumidity;
    },
    set: async function (value) {
        let newTarget = value;
        if (newTarget < 30) {
            newTarget = 30;
        }
        if (newTarget > 80) {
            newTarget = 80;
        }
        if (newTarget !== this.device.targetHumidity) {
            this.device.setTarget(newTarget);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RelativeHumidityHumidifierThreshold.js.map
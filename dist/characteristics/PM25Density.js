"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        if (!this.device.deviceType.hasPM25) {
            return 0;
        }
        await this.device.updateInfo();
        return this.device.pm25;
    }
};
exports.default = characteristic;
//# sourceMappingURL=PM25Density.js.map
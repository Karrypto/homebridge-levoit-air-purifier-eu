"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        const { PURIFYING_AIR, INACTIVE } = this.platform.Characteristic.CurrentAirPurifierState;
        return this.device.isOn ? PURIFYING_AIR : INACTIVE;
    }
};
exports.default = characteristic;
//# sourceMappingURL=CurrentState.js.map
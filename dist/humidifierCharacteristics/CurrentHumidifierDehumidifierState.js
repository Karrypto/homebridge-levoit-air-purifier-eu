"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.currentState;
    }
};
exports.default = characteristic;
//# sourceMappingURL=CurrentHumidifierDehumidifierState.js.map
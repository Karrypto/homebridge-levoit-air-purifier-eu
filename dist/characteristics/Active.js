"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const airPurifierState_1 = require("./airPurifierState");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.isOn ? 1 : 0;
    },
    set: async function (value) {
        const boolValue = value === 1;
        if (boolValue !== this.device.isOn) {
            const success = await this.device.setPower(boolValue);
            (0, util_1.assertCommandSuccess)(success, 'Set purifier power');
        }
        else {
            await (0, util_1.delay)(10);
        }
        (0, airPurifierState_1.updatePurifierPowerState)(this, boolValue, boolValue ? (0, airPurifierState_1.getPurifierRotationSpeed)(this.device) : 0);
    }
};
exports.default = characteristic;
//# sourceMappingURL=Active.js.map